-- Expand age_category CHECK constraint to include U9, U11, U19

ALTER TABLE recurring_schedules
  DROP CONSTRAINT IF EXISTS recurring_schedules_age_category_check,
  ADD CONSTRAINT recurring_schedules_age_category_check
    CHECK (age_category IN ('U9', 'U11', 'U13', 'U15', 'U17', 'U19', 'Adults', 'Mixed'));

ALTER TABLE schedules
  DROP CONSTRAINT IF EXISTS schedules_age_category_check,
  ADD CONSTRAINT schedules_age_category_check
    CHECK (age_category IN ('U9', 'U11', 'U13', 'U15', 'U17', 'U19', 'Adults', 'Mixed'));
