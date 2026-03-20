const express = require('express');
const { randomUUID } = require('crypto');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const supabase = require('../lib/supabase');
const { getAgeCategory } = require('../lib/ageCategory');
const { encryptStudent, decryptStudent } = require('../lib/encryption');

function addAgeCategory(student) {
  return { ...student, age_category: getAgeCategory(student.date_of_birth) };
}

const ALWAYS_REQUIRED = ['name', 'date_of_birth', 'skill_level'];
const CONTACT_FIELDS = ['parent_name', 'parent_phone', 'parent_email'];

function getMissingFields(body) {
  const missing = ALWAYS_REQUIRED.filter(f => !body[f]);
  // Contact fields are only required for non-adults
  if (body.date_of_birth && getAgeCategory(body.date_of_birth) !== 'Adults') {
    missing.push(...CONTACT_FIELDS.filter(f => !body[f]));
  }
  return missing;
}

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
  res.json(data.map(s => addAgeCategory(decryptStudent(s))));
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
  res.json(addAgeCategory(decryptStudent(data)));
});

// POST /api/students
router.post('/', async (req, res) => {
  const missing = getMissingFields(req.body);
  if (missing.length) {
    return res.status(400).json({ error: `Missing fields: ${missing.join(', ')}` });
  }
  const { name, date_of_birth, skill_level, parent_name, parent_phone, parent_email } = req.body;
  const toInsert = encryptStudent({ name, parent_name, parent_phone, parent_email });
  const { data, error } = await supabase
    .from('students')
    .insert({ ...toInsert, date_of_birth, skill_level })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(addAgeCategory(decryptStudent(data)));
});

// PUT /api/students/:id
router.put('/:id', async (req, res) => {
  const { name, date_of_birth, skill_level, parent_name, parent_phone, parent_email, sibling_ids } = req.body;
  const toUpdate = encryptStudent({ name, parent_name, parent_phone, parent_email });
  const { data, error } = await supabase
    .from('students')
    .update({ ...toUpdate, date_of_birth, skill_level, sibling_ids })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(addAgeCategory(decryptStudent(data)));
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
  res.json(addAgeCategory(decryptStudent(data)));
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
