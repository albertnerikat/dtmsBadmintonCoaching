const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const supabase = require('../lib/supabase');

router.use(authMiddleware);

// POST /api/payments
router.post('/', async (req, res) => {
  const { student_id, amount, payment_date, notes } = req.body;
  if (!student_id || !amount || !payment_date) {
    return res.status(400).json({ error: 'student_id, amount, and payment_date are required' });
  }
  const { data, error } = await supabase
    .from('payments')
    .insert({ student_id, amount, payment_date, notes: notes || null })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// DELETE /api/payments/:id
router.delete('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('payments')
    .delete()
    .eq('id', req.params.id)
    .select().single();
  if (error?.code === 'PGRST116') return res.status(404).json({ error: 'Payment not found' });
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

module.exports = router;
