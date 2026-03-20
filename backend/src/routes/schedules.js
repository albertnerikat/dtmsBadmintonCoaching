const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const supabase = require('../lib/supabase');
const { getAgeCategory } = require('../lib/ageCategory');

const REQUIRED_FIELDS = ['date', 'time', 'duration_minutes', 'location', 'age_category'];
const VALID_CATEGORIES = ['U9', 'U11', 'U13', 'U15', 'U17', 'U19', 'Adults', 'Mixed'];

router.use(authMiddleware);

// GET /api/schedules
router.get('/', async (req, res) => {
  const { status, age_category, date_from, date_to } = req.query;
  let query = supabase.from('schedules').select('*').order('date').order('time');
  if (status) query = query.eq('status', status);
  if (age_category) query = query.eq('age_category', age_category);
  if (date_from) query = query.gte('date', date_from);
  if (date_to) query = query.lte('date', date_to);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/schedules/:id
router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('schedules').select('*').eq('id', req.params.id).single();
  if (error?.code === 'PGRST116') return res.status(404).json({ error: 'Schedule not found' });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/schedules
router.post('/', async (req, res) => {
  const missing = REQUIRED_FIELDS.filter(f => !req.body[f]);
  if (missing.length) return res.status(400).json({ error: `Missing fields: ${missing.join(', ')}` });
  if (!VALID_CATEGORIES.includes(req.body.age_category)) {
    return res.status(400).json({ error: 'Invalid age_category' });
  }
  const { date, time, duration_minutes, location, age_category, fee = 20.00 } = req.body;
  const { data, error } = await supabase
    .from('schedules')
    .insert({ date, time, duration_minutes, location, age_category, fee })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// PUT /api/schedules/:id
router.put('/:id', async (req, res) => {
  const { date, time, duration_minutes, location, age_category, fee } = req.body;
  const { data, error } = await supabase
    .from('schedules')
    .update({ date, time, duration_minutes, location, age_category, fee })
    .eq('id', req.params.id)
    .neq('status', 'cancelled')
    .select().single();
  if (error?.code === 'PGRST116') return res.status(404).json({ error: 'Schedule not found or cancelled' });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/schedules/:id/cancel
router.post('/:id/cancel', async (req, res) => {
  const { reason } = req.body;
  const { data, error } = await supabase
    .from('schedules')
    .update({ status: 'cancelled', cancellation_reason: reason || null })
    .eq('id', req.params.id)
    .select().single();
  if (error?.code === 'PGRST116') return res.status(404).json({ error: 'Schedule not found' });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/schedules/:id/attendance
// Returns { schedule, students: [{ ...student, age_category, attendance: record | null }] }
router.get('/:id/attendance', async (req, res) => {
  const { data: schedule, error: schedErr } = await supabase
    .from('schedules').select('*').eq('id', req.params.id).single();
  if (schedErr?.code === 'PGRST116') return res.status(404).json({ error: 'Schedule not found' });
  if (schedErr) return res.status(500).json({ error: schedErr.message });

  const { data: students, error: stuErr } = await supabase
    .from('students').select('*').eq('status', 'active').order('name');
  if (stuErr) return res.status(500).json({ error: stuErr.message });

  const { data: records, error: attErr } = await supabase
    .from('attendance').select('*').eq('schedule_id', req.params.id);
  if (attErr) return res.status(500).json({ error: attErr.message });

  const relevant = students
    .map(s => ({ ...s, age_category: getAgeCategory(s.date_of_birth) }))
    .filter(s => schedule.age_category === 'Mixed' || s.age_category === schedule.age_category);

  res.json({
    schedule,
    students: relevant.map(s => ({
      ...s,
      attendance: records.find(r => r.student_id === s.id) || null,
    })),
  });
});

module.exports = router;
