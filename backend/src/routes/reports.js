const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const supabase = require('../lib/supabase');
const { decryptStudent } = require('../lib/encryption');
const { calculateStudentBalance, detectPeriodType } = require('../lib/reportCalculations');

router.use(authMiddleware);

/**
 * GET /api/reports/period-outstanding
 * Generate period-based outstanding report for all active students
 * Query params: start_date, end_date, hide_free_only (optional), age_category (optional)
 */
router.get('/period-outstanding', async (req, res) => {
  try {
    const { start_date, end_date, hide_free_only = 'false', age_category } = req.query;

    // Validate required params
    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date and end_date are required' });
    }

    // Validate date format and order
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }
    if (endDate <= startDate) {
      return res.status(400).json({ error: 'end_date must be after start_date' });
    }

    // Detect period type
    const periodType = detectPeriodType(start_date, end_date);

    // Fetch all active students
    let studentsQuery = supabase
      .from('students')
      .select('id, name, status, skill_level')
      .eq('status', 'active');

    const { data: rawStudents, error: studentErr } = await studentsQuery;
    if (studentErr) return res.status(500).json({ error: studentErr.message });

    // Fetch all attendance and payments for the period (and before)
    const { data: allAttendance, error: attErr } = await supabase
      .from('attendance')
      .select('student_id, status, free_reason, schedule:schedules(date, fee, age_category)')
      .in('student_id', rawStudents.map(s => s.id))
      .neq('status', 'absent');

    if (attErr) return res.status(500).json({ error: attErr.message });

    const { data: allPayments, error: payErr } = await supabase
      .from('payments')
      .select('*')
      .in('student_id', rawStudents.map(s => s.id));

    if (payErr) return res.status(500).json({ error: payErr.message });

    // Group attendance and payments by student
    const attendanceByStudent = {};
    const paymentsByStudent = {};

    (allAttendance || []).forEach(att => {
      if (!attendanceByStudent[att.student_id]) {
        attendanceByStudent[att.student_id] = [];
      }
      attendanceByStudent[att.student_id].push({
        date: att.schedule?.date,
        status: att.status,
        free_reason: att.free_reason,
        fee: att.schedule?.fee,
        age_category: att.schedule?.age_category,
      });
    });

    (allPayments || []).forEach(pay => {
      if (!paymentsByStudent[pay.student_id]) {
        paymentsByStudent[pay.student_id] = [];
      }
      paymentsByStudent[pay.student_id].push({
        payment_date: pay.payment_date,
        amount: pay.amount,
        notes: pay.notes,
      });
    });

    // Calculate balances for each student
    const students = rawStudents
      .map(student => {
        const sessions = attendanceByStudent[student.id] || [];
        const payments = paymentsByStudent[student.id] || [];
        const balance = calculateStudentBalance(sessions, payments, start_date);

        // Get primary age category (most recent session)
        const primaryCategory = sessions.length > 0
          ? sessions[sessions.length - 1].age_category
          : 'Unknown';

        return {
          id: student.id,
          name: decryptStudent({ name: student.name }).name,
          age_category: primaryCategory,
          previous_balance: balance.previous_balance,
          period_outstanding: balance.period_outstanding,
          total_outstanding: balance.total_outstanding,
          is_free_only: balance.is_free_only,
          status: student.status,
        };
      })
      .filter(s => {
        // Apply filters
        if (hide_free_only === 'true' && s.is_free_only) return false;
        if (age_category && s.age_category !== age_category) return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    // Calculate summary totals
    const summary = {
      total_students: students.length,
      total_previous_balance: students.reduce((sum, s) => sum + s.previous_balance, 0),
      total_period_outstanding: students.reduce((sum, s) => sum + s.period_outstanding, 0),
      total_outstanding: students.reduce((sum, s) => sum + s.total_outstanding, 0),
    };

    res.json({
      period: {
        start_date,
        end_date,
        period_type: periodType,
      },
      filters: {
        age_category: age_category || null,
        hide_free_only: hide_free_only === 'true',
      },
      summary,
      students,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/reports/period-outstanding/:student_id/details
 * Fetch detailed sessions and payments for a student in a period (lazy-loaded)
 */
router.get('/period-outstanding/:student_id/details', async (req, res) => {
  try {
    const { student_id } = req.params;
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date and end_date are required' });
    }

    // Fetch student
    const { data: student, error: stuErr } = await supabase
      .from('students')
      .select('id, name')
      .eq('id', student_id)
      .single();

    if (stuErr?.code === 'PGRST116') return res.status(404).json({ error: 'Student not found' });
    if (stuErr) return res.status(500).json({ error: stuErr.message });

    // Fetch sessions in period
    const { data: attendance, error: attErr } = await supabase
      .from('attendance')
      .select('id, status, free_reason, checked_in_at, schedule:schedules(id, date, location, age_category, fee)')
      .eq('student_id', student_id)
      .neq('status', 'absent')
      .gte('schedule.date', start_date)
      .lte('schedule.date', end_date);

    if (attErr) return res.status(500).json({ error: attErr.message });

    // Fetch payments in period
    const { data: payments, error: payErr } = await supabase
      .from('payments')
      .select('*')
      .eq('student_id', student_id)
      .gte('payment_date', start_date)
      .lte('payment_date', end_date)
      .order('payment_date', { ascending: false });

    if (payErr) return res.status(500).json({ error: payErr.message });

    // Format sessions
    const sessions = (attendance || [])
      .sort((a, b) => new Date(b.schedule?.date) - new Date(a.schedule?.date))
      .map(att => ({
        id: att.id,
        date: att.schedule?.date,
        location: att.schedule?.location,
        age_category: att.schedule?.age_category,
        status: att.status,
        free_reason: att.free_reason,
        fee: att.status === 'present' ? att.schedule?.fee : 0,
      }));

    res.json({
      student_id,
      period: { start_date, end_date },
      sessions,
      payments: payments || [],
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
