/**
 * Parse ISO date string as local date (not UTC)
 * @param {string} dateStr - ISO date (YYYY-MM-DD)
 * @returns {Date}
 */
function parseLocalDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Detect period type based on start and end dates
 * @param {string} startDate - ISO date (YYYY-MM-DD)
 * @param {string} endDate - ISO date (YYYY-MM-DD)
 * @returns {string} 'calendar_month' or 'custom_range'
 */
function detectPeriodType(startDate, endDate) {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);

  if (end <= start) {
    throw new Error('end_date must be after start_date');
  }

  // Check if it's a full calendar month (1st to last day)
  const isFirstDay = start.getDate() === 1;
  const isLastDay = new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate() === end.getDate();
  const sameMonth = start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth();

  return isFirstDay && isLastDay && sameMonth ? 'calendar_month' : 'custom_range';
}

/**
 * Calculate outstanding balance for a student across a period
 * @param {array} sessions - Attendance records with { date, status, fee }
 * @param {array} payments - Payment records with { payment_date, amount }
 * @param {string} periodStartDate - Period start (YYYY-MM-DD)
 * @returns {object} {
 *   previous_balance: number - Outstanding fees before period
 *   period_outstanding: number - Outstanding fees during period
 *   total_outstanding: number - Sum of both
 *   is_free_only: boolean - True if all period sessions have status='free'
 * }
 */
function calculateStudentBalance(sessions, payments, periodStartDate) {
  const startDate = parseLocalDate(periodStartDate);

  // Split sessions into before and during period
  const sessionsBefore = sessions.filter(s => parseLocalDate(s.date) < startDate && s.status === 'present');
  const sessionsDuring = sessions.filter(s => parseLocalDate(s.date) >= startDate && s.status === 'present');
  const paymentsBefore = payments.filter(p => parseLocalDate(p.payment_date) < startDate);
  const paymentsDuring = payments.filter(p => parseLocalDate(p.payment_date) >= startDate);

  // Calculate fees and payment totals
  const feesBefore = sessionsBefore.reduce((sum, s) => sum + Number(s.fee || 0), 0);
  const feesDuring = sessionsDuring.reduce((sum, s) => sum + Number(s.fee || 0), 0);
  const amountBefore = paymentsBefore.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const amountDuring = paymentsDuring.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const previous_balance = feesBefore - amountBefore;
  const period_outstanding = feesDuring - amountDuring;
  const total_outstanding = previous_balance + period_outstanding;

  // is_free_only is true only if all period sessions are explicitly 'free'
  const allSessionsDuring = sessions.filter(s => parseLocalDate(s.date) >= startDate);
  const freeSessions = allSessionsDuring.filter(s => s.status === 'free');
  const is_free_only = allSessionsDuring.length > 0 && freeSessions.length === allSessionsDuring.length;

  return {
    previous_balance: Math.max(previous_balance, 0), // Never negative
    period_outstanding: Math.max(period_outstanding, 0),
    total_outstanding: Math.max(total_outstanding, 0),
    is_free_only,
  };
}

module.exports = { detectPeriodType, calculateStudentBalance };
