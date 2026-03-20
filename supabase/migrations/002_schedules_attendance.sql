-- Recurring schedule templates
CREATE TABLE recurring_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  days_of_week INTEGER[] NOT NULL,  -- JS getDay() values: 0=Sun, 1=Mon, ..., 6=Sat
  time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL,
  location TEXT NOT NULL,
  age_category TEXT NOT NULL CHECK (age_category IN ('U13', 'U15', 'U17', 'Adults', 'Mixed')),
  fee DECIMAL(10,2) NOT NULL DEFAULT 20.00,
  start_date DATE NOT NULL,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Individual sessions (one-off OR generated from a recurring template)
CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL,
  location TEXT NOT NULL,
  age_category TEXT NOT NULL CHECK (age_category IN ('U13', 'U15', 'U17', 'Adults', 'Mixed')),
  fee DECIMAL(10,2) NOT NULL DEFAULT 20.00,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled', 'completed')),
  cancellation_reason TEXT,
  recurring_id UUID REFERENCES recurring_schedules(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER schedules_updated_at
  BEFORE UPDATE ON schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Attendance records — one row per student per session
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id),
  status TEXT NOT NULL DEFAULT 'absent' CHECK (status IN ('present', 'absent', 'free')),
  free_reason TEXT,
  checked_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(schedule_id, student_id)
);
