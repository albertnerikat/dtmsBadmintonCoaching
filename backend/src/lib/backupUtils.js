const supabase = require('./supabase');
const { decryptStudent } = require('./encryption');

/**
 * Generate SQL dump of entire database with decrypted student names
 * @returns {Promise<string>} SQL dump content
 */
async function generateSQLDump() {
  try {
    // Fetch all data from all tables with error handling per table
    const queryTable = async (tableName) => {
      try {
        return await supabase.from(tableName).select('*');
      } catch (err) {
        console.warn(`Warning: Could not fetch ${tableName}: ${err.message}`);
        return { data: [], error: null };
      }
    };

    const [
      ageCategoriesData,
      recurringSchedulesData,
      schedulesData,
      studentsData,
      attendanceData,
      paymentsData,
    ] = await Promise.all([
      queryTable('age_categories'),
      queryTable('recurring_schedules'),
      queryTable('schedules'),
      queryTable('students'),
      queryTable('attendance'),
      queryTable('payments'),
    ]);

    // Decrypt student names
    const students = (studentsData.data || []).map(student => {
      try {
        return decryptStudent(student);
      } catch (err) {
        console.warn(`Failed to decrypt student ${student.id}, using placeholder`);
        return { ...student, name: '[DECRYPTION_ERROR]' };
      }
    });

    // Generate SQL dump
    let sql = '-- PostgreSQL database dump\n';
    sql += `-- Generated: ${new Date().toISOString()}\n`;
    sql += '-- Database: DTMS Badminton Coaching\n\n';

    // Drop existing tables (safe for restore)
    sql += '-- Drop existing tables (for clean restore)\n';
    sql += 'DROP TABLE IF EXISTS attendance CASCADE;\n';
    sql += 'DROP TABLE IF EXISTS payments CASCADE;\n';
    sql += 'DROP TABLE IF EXISTS schedules CASCADE;\n';
    sql += 'DROP TABLE IF EXISTS recurring_schedules CASCADE;\n';
    sql += 'DROP TABLE IF EXISTS students CASCADE;\n';
    sql += 'DROP TABLE IF EXISTS age_categories CASCADE;\n\n';

    // Create tables
    sql += createTableStatements();

    // Insert data
    sql += '\n-- Insert data\n\n';

    if (ageCategoriesData.data?.length > 0) {
      sql += insertStatement('age_categories', ageCategoriesData.data);
    }

    if (recurringSchedulesData.data?.length > 0) {
      sql += insertStatement('recurring_schedules', recurringSchedulesData.data);
    }

    if (schedulesData.data?.length > 0) {
      sql += insertStatement('schedules', schedulesData.data);
    }

    if (students.length > 0) {
      sql += insertStatement('students', students);
    }

    if (attendanceData.data?.length > 0) {
      sql += insertStatement('attendance', attendanceData.data);
    }

    if (paymentsData.data?.length > 0) {
      sql += insertStatement('payments', paymentsData.data);
    }

    // Add constraints
    sql += '\n-- Add foreign key constraints\n';
    sql += 'ALTER TABLE schedules ADD CONSTRAINT fk_recurring_schedule FOREIGN KEY (recurring_schedule_id) REFERENCES recurring_schedules(id);\n';
    sql += 'ALTER TABLE attendance ADD CONSTRAINT fk_student FOREIGN KEY (student_id) REFERENCES students(id);\n';
    sql += 'ALTER TABLE attendance ADD CONSTRAINT fk_schedule FOREIGN KEY (schedule_id) REFERENCES schedules(id);\n';
    sql += 'ALTER TABLE payments ADD CONSTRAINT fk_student_payment FOREIGN KEY (student_id) REFERENCES students(id);\n\n';

    sql += '-- End of dump\n';

    return sql;
  } catch (error) {
    throw new Error(`Failed to generate SQL dump: ${error.message}`);
  }
}

/**
 * Generate CREATE TABLE statements for all tables
 */
function createTableStatements() {
  return `CREATE TABLE age_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  skill_level TEXT NOT NULL CHECK (skill_level IN ('Beginner', 'Intermediate', 'Advanced')),
  parent_name TEXT NOT NULL,
  parent_phone TEXT NOT NULL,
  parent_email TEXT NOT NULL,
  parent_access_token UUID NOT NULL,
  sibling_ids UUID[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE recurring_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  days_of_week INTEGER[] NOT NULL,
  time TIME NOT NULL,
  location TEXT NOT NULL,
  fee DECIMAL(10,2) NOT NULL,
  age_category TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  time TIME NOT NULL,
  location TEXT NOT NULL,
  age_category TEXT NOT NULL,
  fee DECIMAL(10,2) NOT NULL,
  recurring_schedule_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  schedule_id UUID NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'free')),
  free_reason TEXT,
  checked_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;
}

/**
 * Generate INSERT statement for table data
 */
function insertStatement(tableName, rows) {
  if (!rows || rows.length === 0) return '';

  const columns = Object.keys(rows[0]);
  const values = rows.map(row => {
    return '(' + columns.map(col => formatValue(row[col])).join(', ') + ')';
  }).join(',\n  ');

  return `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES\n  ${values};\n\n`;
}

/**
 * Format value for SQL INSERT statement
 */
function formatValue(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return value.toString();
  if (Array.isArray(value)) return `'{${value.join(',')}}'`;

  // String: escape single quotes
  const str = String(value).replace(/'/g, "''");
  return `'${str}'`;
}

module.exports = { generateSQLDump };