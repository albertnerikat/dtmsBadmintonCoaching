const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const supabase = require('../lib/supabase');
const { decryptStudent } = require('../lib/encryption');

router.use(authMiddleware);

// GET /api/dashboard
router.get('/', async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const twoWeeksLater = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Upcoming scheduled sessions in the next 14 days
  const { data: upcoming, error: upErr } = await supabase
    .from('schedules')
    .select('*')
    .eq('status', 'scheduled')
    .gte('date', today)
    .lte('date', twoWeeksLater)
    .order('date').order('time');
  if (upErr) return res.status(500).json({ error: upErr.message });

  // Last 2 past sessions (any status)
  const { data: recent, error: recentErr } = await supabase
    .from('schedules')
    .select('*')
    .lt('date', today)
    .order('date', { ascending: false }).order('time', { ascending: false })
    .limit(2);
  if (recentErr) return res.status(500).json({ error: recentErr.message });

  // All present attendance with fees (for balance computation)
  const { data: attended, error: attErr } = await supabase
    .from('attendance')
    .select('student_id, schedule:schedules(fee)')
    .eq('status', 'present');
  if (attErr) return res.status(500).json({ error: attErr.message });

  // All payments
  const { data: payments, error: payErr } = await supabase
    .from('payments')
    .select('student_id, amount');
  if (payErr) return res.status(500).json({ error: payErr.message });

  // Compute per-student totals
  const owedMap = {};
  for (const a of attended || []) {
    owedMap[a.student_id] = (owedMap[a.student_id] || 0) + Number(a.schedule?.fee || 0);
  }
  const paidMap = {};
  for (const p of payments || []) {
    paidMap[p.student_id] = (paidMap[p.student_id] || 0) + Number(p.amount);
  }

  // Find active students with a non-zero balance
  const allIds = [...new Set([...Object.keys(owedMap), ...Object.keys(paidMap)])];
  let studentBalances = [];
  if (allIds.length > 0) {
    const { data: students, error: stuErr } = await supabase
      .from('students')
      .select('id, name')
      .in('id', allIds)
      .eq('status', 'active');
    if (stuErr) return res.status(500).json({ error: stuErr.message });

    studentBalances = (students || [])
      .map(decryptStudent)
      .map(s => ({
        id: s.id,
        name: s.name,
        total_owed: owedMap[s.id] || 0,
        total_paid: paidMap[s.id] || 0,
        balance: (owedMap[s.id] || 0) - (paidMap[s.id] || 0),
      }))
      .filter(s => s.balance !== 0)
      .sort((a, b) => b.balance - a.balance);
  }

  res.json({ upcoming_sessions: upcoming || [], recent_sessions: (recent || []).reverse(), student_balances: studentBalances });
});

module.exports = router;
