const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const supabase = require('../lib/supabase');
const { decryptStudent } = require('../lib/encryption');

router.use(authMiddleware);

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

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

  // ── Financial Summary ──────────────────────────────────────────────
  const now = new Date();

  // Full range: start of month 6 months ago → end of current month (two queries: schedules then attendance)
  const rangeStart = new Date(now.getFullYear(), now.getMonth() - 6, 1);
  const rangeEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0); // last day of current month
  const rangeStartStr = rangeStart.toISOString().slice(0, 10);
  const rangeEndStr   = rangeEnd.toISOString().slice(0, 10);

  // Get all schedules in the date range
  const { data: schedulesInRange, error: schedErr } = await supabase
    .from('schedules')
    .select('id, date, fee')
    .gte('date', rangeStartStr)
    .lte('date', rangeEndStr);
  if (schedErr) return res.status(500).json({ error: schedErr.message });

  const scheduleInfoMap = {};
  for (const s of schedulesInRange || []) {
    scheduleInfoMap[s.id] = { date: s.date, fee: s.fee };
  }

  // Present attendance for those schedules
  const scheduleIds = Object.keys(scheduleInfoMap);
  let attended = [];
  if (scheduleIds.length > 0) {
    const { data: attRows, error: attErr } = await supabase
      .from('attendance')
      .select('student_id, schedule_id')
      .eq('status', 'present')
      .in('schedule_id', scheduleIds);
    if (attErr) return res.status(500).json({ error: attErr.message });
    attended = attRows || [];
  }

  // Payments in range
  const { data: payments, error: payErr } = await supabase
    .from('payments')
    .select('student_id, amount, payment_date')
    .gte('payment_date', rangeStartStr)
    .lte('payment_date', rangeEndStr);
  if (payErr) return res.status(500).json({ error: payErr.message });

  // Build per-month, per-student owed/paid maps
  // monthData key = "YYYY-M" (e.g. "2026-3")
  const monthData = {};

  const ensureMonth = (year, month) => {
    const key = `${year}-${month}`;
    if (!monthData[key]) monthData[key] = { year, month, students: {} };
    return key;
  };
  const ensureStudent = (key, sid) => {
    if (!monthData[key].students[sid]) monthData[key].students[sid] = { owed: 0, paid: 0 };
  };

  for (const a of attended) {
    const info = scheduleInfoMap[a.schedule_id];
    if (!info) continue;
    const [y, m] = info.date.split('-').map(Number);
    const key = ensureMonth(y, m);
    ensureStudent(key, a.student_id);
    monthData[key].students[a.student_id].owed += Number(info.fee || 0);
  }

  for (const p of payments || []) {
    const date = p.payment_date;
    if (!date) continue;
    const [y, m] = date.split('-').map(Number);
    const key = ensureMonth(y, m);
    ensureStudent(key, p.student_id);
    monthData[key].students[p.student_id].paid += Number(p.amount);
  }

  // Fetch names for all involved active students
  const allStudentIds = [...new Set(
    Object.values(monthData).flatMap(md => Object.keys(md.students))
  )];

  const studentNameMap = {};
  if (allStudentIds.length > 0) {
    const { data: students, error: stuErr } = await supabase
      .from('students')
      .select('id, name')
      .in('id', allStudentIds)
      .eq('status', 'active');
    if (stuErr) return res.status(500).json({ error: stuErr.message });
    for (const s of (students || []).map(decryptStudent)) {
      studentNameMap[s.id] = s.name;
    }
  }

  // Build a month summary object for a given year/month
  const buildMonth = (year, month) => {
    const key = `${year}-${month}`;
    const data = monthData[key] || { students: {} };
    const students = Object.entries(data.students)
      .filter(([sid]) => studentNameMap[sid]) // active students only
      .map(([sid, { owed, paid }]) => ({
        id: sid,
        name: studentNameMap[sid],
        owed,
        paid,
        balance: owed - paid,
      }))
      .sort((a, b) => b.balance - a.balance);
    const total_owed = students.reduce((s, st) => s + st.owed, 0);
    const total_paid = students.reduce((s, st) => s + st.paid, 0);
    return {
      label: `${MONTH_NAMES[month - 1]} ${year}`,
      year,
      month,
      total_owed,
      total_paid,
      outstanding: total_owed - total_paid,
      students,
    };
  };

  const currentYear  = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-indexed

  const current_month = buildMonth(currentYear, currentMonth);

  // Past 6 months, most-recent first
  const past_months = [];
  for (let i = 1; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    past_months.push(buildMonth(d.getFullYear(), d.getMonth() + 1));
  }

  res.json({
    upcoming_sessions: upcoming || [],
    recent_sessions: (recent || []).reverse(),
    financial_summary: { current_month, past_months },
  });
});

module.exports = router;
