const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const supabase = require('../lib/supabase');

router.use(authMiddleware);

// POST /api/attendance/check-in
router.post('/check-in', async (req, res) => {
  const { schedule_id, student_id } = req.body;
  if (!schedule_id || !student_id) {
    return res.status(400).json({ error: 'schedule_id and student_id are required' });
  }
  const { data, error } = await supabase
    .from('attendance')
    .upsert(
      { schedule_id, student_id, status: 'present', checked_in_at: new Date().toISOString(), free_reason: null },
      { onConflict: 'schedule_id,student_id' }
    )
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/attendance/free
router.post('/free', async (req, res) => {
  const { schedule_id, student_id, free_reason } = req.body;
  if (!schedule_id || !student_id) {
    return res.status(400).json({ error: 'schedule_id and student_id are required' });
  }
  const { data, error } = await supabase
    .from('attendance')
    .upsert(
      { schedule_id, student_id, status: 'free', free_reason: free_reason || null, checked_in_at: new Date().toISOString() },
      { onConflict: 'schedule_id,student_id' }
    )
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// PATCH /api/attendance/:id/undo
router.patch('/:id/undo', async (req, res) => {
  const { data, error } = await supabase
    .from('attendance')
    .update({ status: 'absent', checked_in_at: null, free_reason: null })
    .eq('id', req.params.id)
    .select().single();
  if (error?.code === 'PGRST116') return res.status(404).json({ error: 'Attendance record not found' });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
