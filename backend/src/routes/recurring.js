const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const supabase = require('../lib/supabase');

const REQUIRED_FIELDS = ['days_of_week', 'time', 'duration_minutes', 'location', 'age_category', 'start_date'];
const VALID_CATEGORIES = ['U9', 'U11', 'U13', 'U15', 'U17', 'U19', 'Adults', 'Mixed'];

function generateSessionDates(daysOfWeek, startDate, endDate) {
  const dates = [];
  const start = new Date(startDate);
  const end = endDate
    ? new Date(endDate)
    : (() => { const d = new Date(startDate); d.setFullYear(d.getFullYear() + 1); return d; })();

  const current = new Date(start);
  while (current <= end) {
    if (daysOfWeek.includes(current.getDay())) {
      dates.push(current.toISOString().slice(0, 10));
    }
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

router.use(authMiddleware);

// GET /api/recurring
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('recurring_schedules').select('*').order('start_date');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/recurring — create template + generate sessions
router.post('/', async (req, res) => {
  const missing = REQUIRED_FIELDS.filter(f => req.body[f] === undefined || req.body[f] === null || req.body[f] === '');
  if (missing.length) return res.status(400).json({ error: `Missing fields: ${missing.join(', ')}` });
  if (!VALID_CATEGORIES.includes(req.body.age_category)) {
    return res.status(400).json({ error: 'Invalid age_category' });
  }
  if (!Array.isArray(req.body.days_of_week) || req.body.days_of_week.length === 0) {
    return res.status(400).json({ error: 'days_of_week must be a non-empty array' });
  }

  const { days_of_week, time, duration_minutes, location, age_category, fee = 20.00, start_date, end_date } = req.body;

  const { data: template, error: templateErr } = await supabase
    .from('recurring_schedules')
    .insert({ days_of_week, time, duration_minutes, location, age_category, fee, start_date, end_date })
    .select().single();
  if (templateErr) return res.status(500).json({ error: templateErr.message });

  const sessionDates = generateSessionDates(days_of_week, start_date, end_date);
  if (sessionDates.length > 0) {
    const sessions = sessionDates.map(date => ({
      date, time, duration_minutes, location, age_category, fee, recurring_id: template.id,
    }));
    const { error: sessErr } = await supabase.from('schedules').insert(sessions);
    if (sessErr) return res.status(500).json({ error: sessErr.message });
  }

  res.status(201).json({ recurring_schedule: template, sessions_created: sessionDates.length });
});

// POST /api/recurring/:id/cancel-future
router.post('/:id/cancel-future', async (req, res) => {
  const { reason } = req.body;
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('schedules')
    .update({ status: 'cancelled', cancellation_reason: reason || null })
    .eq('recurring_id', req.params.id)
    .eq('status', 'scheduled')
    .gte('date', today)
    .select();
  if (error) return res.status(500).json({ error: error.message });

  await supabase.from('recurring_schedules').update({ status: 'cancelled' }).eq('id', req.params.id);

  res.json({ cancelled_sessions: data.length });
});

module.exports = router;
