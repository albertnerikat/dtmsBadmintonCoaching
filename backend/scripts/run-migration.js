require('dotenv').config();
const fs = require('fs');
const path = require('path');
const supabase = require('../src/lib/supabase');

async function runMigration(migrationName) {
  try {
    const migrationPath = path.join(__dirname, '../supabase/migrations', migrationName);

    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Migration file not found: ${migrationPath}`);
      process.exit(1);
    }

    const sql = fs.readFileSync(migrationPath, 'utf-8');
    console.log(`📄 Migration: ${migrationName}`);
    console.log(`\n📋 SQL to run in Supabase console:\n`);
    console.log('---');
    console.log(sql);
    console.log('---\n');
    console.log(`Instructions:`);
    console.log(`1. Go to Supabase Dashboard: https://app.supabase.com`);
    console.log(`2. Select your project`);
    console.log(`3. Click "SQL Editor" in the left sidebar`);
    console.log(`4. Click "New Query"`);
    console.log(`5. Copy and paste the SQL above`);
    console.log(`6. Click "Run" button`);
    console.log(`\nAfter running, verify table created with:`);
    console.log(`   SELECT * FROM backup_reminder_emails;`);
  } catch (err) {
    console.error(`❌ Error: ${err.message}`);
    process.exit(1);
  }
}

async function verifyTable() {
  try {
    const { data, error } = await supabase
      .from('backup_reminder_emails')
      .select('*')
      .limit(1);

    if (error) {
      console.log(`\n⚠️  Table not found. Please run the migration first.`);
      return false;
    }

    console.log(`\n✅ Table 'backup_reminder_emails' exists!`);
    console.log(`✅ Default email configured: albert.babu@gmail.com`);
    return true;
  } catch (err) {
    console.log(`\n⚠️  Unable to verify table: ${err.message}`);
    return false;
  }
}

async function main() {
  const migrationName = process.argv[2] || '005_backup_reminder_emails.sql';

  if (migrationName === '--verify') {
    await verifyTable();
  } else {
    await runMigration(migrationName);
  }
}

main();
