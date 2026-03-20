const express = require('express');
const { randomUUID } = require('crypto');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const supabase = require('../lib/supabase');
const { getAgeCategory } = require('../lib/ageCategory');

function addAgeCategory(student) {
  return { ...student, age_category: getAgeCategory(student.date_of_birth) };
}

const REQUIRED_FIELDS = [
  'name', 'date_of_birth', 'skill_level',
  'parent_name', 'parent_phone', 'parent_email',
];

// All student routes require coach auth
router.use(authMiddleware);

// GET /api/students
router.get('/', async (req, res) => {
  const { status = 'active' } = req.query;
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('status', status)
    .order('name');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.map(addAgeCategory));
});

// GET /api/students/:id
router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('id', req.params.id)
    .single();
  if (error?.code === 'PGRST116') return res.status(404).json({ error: 'Student not found' });
  if (error) return res.status(500).json({ error: error.message });
  res.json(addAgeCategory(data));
});

// POST /api/students
router.post('/', async (req, res) => {
  const missing = REQUIRED_FIELDS.filter(f => !req.body[f]);
  if (missing.length) {
    return res.status(400).json({ error: `Missing fields: ${missing.join(', ')}` });
  }
  const { name, date_of_birth, skill_level, parent_name, parent_phone, parent_email } = req.body;
  const { data, error } = await supabase
    .from('students')
    .insert({ name, date_of_birth, skill_level, parent_name, parent_phone, parent_email })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(addAgeCategory(data));
});

// PUT /api/students/:id
router.put('/:id', async (req, res) => {
  const { name, date_of_birth, skill_level, parent_name, parent_phone, parent_email, sibling_ids } = req.body;
  const { data, error } = await supabase
    .from('students')
    .update({ name, date_of_birth, skill_level, parent_name, parent_phone, parent_email, sibling_ids })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(addAgeCategory(data));
});

// PATCH /api/students/:id/archive
router.patch('/:id/archive', async (req, res) => {
  const { data, error } = await supabase
    .from('students')
    .update({ status: 'archived' })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(addAgeCategory(data));
});

// POST /api/students/:id/regenerate-token
router.post('/:id/regenerate-token', async (req, res) => {
  const { data, error } = await supabase
    .from('students')
    .update({ parent_access_token: randomUUID() })
    .eq('id', req.params.id)
    .select('parent_access_token')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ parent_access_token: data.parent_access_token });
});

module.exports = router;
