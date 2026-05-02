const { calculateStudentBalance, detectPeriodType } = require('./reportCalculations');

describe('reportCalculations', () => {
  describe('detectPeriodType', () => {
    test('detects calendar month', () => {
      const result = detectPeriodType('2026-03-01', '2026-03-31');
      expect(result).toBe('calendar_month');
    });

    test('detects custom range', () => {
      const result = detectPeriodType('2026-03-15', '2026-04-14');
      expect(result).toBe('custom_range');
    });

    test('rejects invalid dates', () => {
      expect(() => detectPeriodType('2026-03-31', '2026-03-01')).toThrow('end_date must be after start_date');
    });
  });

  describe('calculateStudentBalance', () => {
    test('calculates balance with sessions and payments', () => {
      const sessions = [
        { date: '2026-02-15', status: 'present', fee: 20 },
        { date: '2026-03-10', status: 'present', fee: 15 },
      ];
      const payments = [
        { payment_date: '2026-02-20', amount: 10 },
        { payment_date: '2026-03-15', amount: 5 },
      ];
      const startDate = '2026-03-01';

      const result = calculateStudentBalance(sessions, payments, startDate);

      expect(result.previous_balance).toBe(10); // 20 - 10
      expect(result.period_outstanding).toBe(10); // 15 - 5
      expect(result.total_outstanding).toBe(20); // 10 + 10
    });

    test('handles free sessions (excludes from fees)', () => {
      const sessions = [
        { date: '2026-03-10', status: 'present', fee: 15 },
        { date: '2026-03-15', status: 'free', fee: 15 },
      ];
      const payments = [];
      const startDate = '2026-03-01';

      const result = calculateStudentBalance(sessions, payments, startDate);

      expect(result.period_outstanding).toBe(15); // Only present sessions count
      expect(result.is_free_only).toBe(false); // Has at least one present
    });

    test('marks as free_only when all sessions are free', () => {
      const sessions = [
        { date: '2026-03-10', status: 'free', fee: 15 },
        { date: '2026-03-15', status: 'free', fee: 15 },
      ];
      const payments = [];
      const startDate = '2026-03-01';

      const result = calculateStudentBalance(sessions, payments, startDate);

      expect(result.is_free_only).toBe(true);
      expect(result.period_outstanding).toBe(0);
    });

    test('handles no sessions', () => {
      const result = calculateStudentBalance([], [], '2026-03-01');
      expect(result.previous_balance).toBe(0);
      expect(result.period_outstanding).toBe(0);
    });

    test('correctly identifies mixed statuses (not free_only)', () => {
      const sessions = [
        { date: '2026-03-10', status: 'free', fee: 15 },
        { date: '2026-03-15', status: 'absent', fee: 0 },
      ];
      const payments = [];
      const startDate = '2026-03-01';

      const result = calculateStudentBalance(sessions, payments, startDate);

      expect(result.is_free_only).toBe(false); // Not all free
      expect(result.period_outstanding).toBe(0); // No present sessions
    });

    test('handles session on exact start date', () => {
      const sessions = [
        { date: '2026-02-15', status: 'present', fee: 20 },
        { date: '2026-03-01', status: 'present', fee: 15 }, // Exactly on start_date
      ];
      const payments = [];
      const startDate = '2026-03-01';

      const result = calculateStudentBalance(sessions, payments, startDate);

      expect(result.previous_balance).toBe(20); // Only Feb session
      expect(result.period_outstanding).toBe(15); // Mar 1 session counts as in period
    });

    test('handles payment on exact end date', () => {
      const sessions = [
        { date: '2026-03-10', status: 'present', fee: 30 },
      ];
      const payments = [
        { payment_date: '2026-03-31', amount: 15 }, // Exactly on end_date (if that's our range)
      ];
      const startDate = '2026-03-01';

      const result = calculateStudentBalance(sessions, payments, startDate);

      expect(result.period_outstanding).toBe(15); // 30 - 15
    });
  });
});
