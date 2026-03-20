const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { getAgeCategory } = require('../lib/ageCategory');
const { decryptStudent } = require('../lib/encryption');

// No authMiddleware — public endpoint using token-based access

// GET /api/parent/:token
router.get('/:token', async (req, res) => {
  // Look up student by parent_access_token (exclude sensitive fields)
  const { data: rawStudent, error: stuErr } = await supabase
    .from('students')
    .select('id, name, date_of_birth, skill_level')
    .eq('parent_access_token', req.params.token)
    .single();
  if (stuErr?.code === 'PGRST116') return res.status(404).json({ error: 'Invalid link' });
  if (stuErr) return res.status(500).json({ error: stuErr.message });
  const student = decryptStudent(rawStudent);

  // Get all non-absent attendance with schedule info
  const { data: attendance, error: attErr } = await supabase
    .from('attendance')
    .select('id, status, free_reason, checked_in_at, schedule:schedules(id, date, time, location, age_category, fee)')
    .eq('student_id', student.id)
    .neq('status', 'absent');
  if (attErr) return res.status(500).json({ error: attErr.message });

  // Get payments
  const { data: payments, error: payErr } = await supabase
    .from('payments')
    .select('id, amount, payment_date, notes, created_at')
    .eq('student_id', student.id)
    .order('payment_date', { ascending: false });
  if (payErr) return res.status(500).json({ error: payErr.message });

  const sessions = (attendance || []).sort(
    (a, b) => new Date(b.schedule?.date) - new Date(a.schedule?.date)
  );
  const total_owed = sessions
    .filter(s => s.status === 'present')
    .reduce((sum, s) => sum + Number(s.schedule?.fee || 0), 0);
  const total_paid = (payments || []).reduce((sum, p) => sum + Number(p.amount), 0);

  res.json({
    student: { ...student, age_category: getAgeCategory(student.date_of_birth) },
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
