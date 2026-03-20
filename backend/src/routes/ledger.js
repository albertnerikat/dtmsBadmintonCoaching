const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const supabase = require('../lib/supabase');

router.use(authMiddleware);

// GET /api/students/:id/ledger
// This router is mounted at /api/students alongside studentRoutes.
// Express only matches /:id/ledger here — /:id alone is handled by studentRoutes.
router.get('/:id/ledger', async (req, res) => {
  const { data: student, error: stuErr } = await supabase
    .from('students')
    .select('id, name, date_of_birth, skill_level, status')
    .eq('id', req.params.id)
    .single();
  if (stuErr?.code === 'PGRST116') return res.status(404).json({ error: 'Student not found' });
  if (stuErr) return res.status(500).json({ error: stuErr.message });

  // Get all non-absent attendance with schedule info
  // Supabase join: 'schedule:schedules(...)' creates a nested 'schedule' object per row
  const { data: attendance, error: attErr } = await supabase
    .from('attendance')
    .select('id, status, free_reason, checked_in_at, schedule:schedules(id, date, time, location, age_category, fee)')
    .eq('student_id', req.params.id)
    .neq('status', 'absent');
  if (attErr) return res.status(500).json({ error: attErr.message });

  const { data: payments, error: payErr } = await supabase
    .from('payments')
    .select('*')
    .eq('student_id', req.params.id)
    .order('payment_date', { ascending: false });
  if (payErr) return res.status(500).json({ error: payErr.message });

  const sessions = (attendance || []).sort(
    (a, b) => new Date(b.schedule?.date) - new Date(a.schedule?.date)
  );

  // Only 'present' sessions are billed; 'free' sessions cost $0
  const total_owed = sessions
    .filter(s => s.status === 'present')
    .reduce((sum, s) => sum + Number(s.schedule?.fee || 0), 0);
  const total_paid = (payments || []).reduce((sum, p) => sum + Number(p.amount), 0);

  res.json({
    student,
    sessions,
    payments: payments || [],
    summary: {
      total_sessions: sessions.length,
      present_sessions: sessions.filter(s => s.status === 'present').length,
      free_sessions: sessions.filter(s => s.status === 'free').length,
      total_owed,
      total_paid,
      balance: total_owed - total_paid,
    },
  });
});

module.exports = router;
