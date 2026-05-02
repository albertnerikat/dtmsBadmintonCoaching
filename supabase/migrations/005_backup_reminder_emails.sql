CREATE TABLE backup_reminder_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add index on email for fast lookups
CREATE INDEX backup_reminder_emails_email_idx ON backup_reminder_emails(email);

-- Auto-update updated_at
CREATE TRIGGER backup_reminder_emails_updated_at
  BEFORE UPDATE ON backup_reminder_emails
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Insert default email (albert.babu@gmail.com)
INSERT INTO backup_reminder_emails (email, verified) VALUES ('albert.babu@gmail.com', true);