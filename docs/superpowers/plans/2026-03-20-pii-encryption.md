# PII Encryption & Transport Security — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Encrypt all student PII fields (name, date_of_birth, parent_name, parent_phone, parent_email) with AES-256-GCM before storing in Supabase, decrypt transparently on read, and add Helmet.js security headers to Express.

**Architecture:** A new `backend/src/lib/encryption.js` module handles all encrypt/decrypt logic using Node.js built-in `crypto`. Two helper functions (`encryptStudent` / `decryptStudent`) are called at the boundary of every Supabase read/write in four route files. Helmet.js is added as a single middleware line in `app.js`. The API contract is unchanged — all encryption is invisible to frontend callers.

**Tech Stack:** Node.js built-in `crypto` (AES-256-GCM), `helmet` npm package, Jest (existing test runner), Supabase JS client.

---

## File Map

| File | Change |
|---|---|
| `backend/src/lib/encryption.js` | **Create** — encryption/decryption module |
| `backend/tests/encryption.test.js` | **Create** — unit tests for encryption module |
| `backend/.env` | **Modify** — add `ENCRYPTION_KEY` |
| `backend/.env.example` | **Modify** — add `ENCRYPTION_KEY` placeholder |
| `backend/src/app.js` | **Modify** — add `helmet()` middleware |
| `backend/src/routes/students.js` | **Modify** — encrypt on write, decrypt on read |
| `backend/src/routes/parent.js` | **Modify** — decrypt student on read |
| `backend/src/routes/ledger.js` | **Modify** — decrypt student on read |
| `backend/src/routes/dashboard.js` | **Modify** — decrypt student names on read |

---

### Task 1: Create encryption module (TDD)

**Files:**
- Create: `backend/tests/encryption.test.js`
- Create: `backend/src/lib/encryption.js`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/encryption.test.js`:

```js
// Set key BEFORE requiring the module (module validates at load time)
process.env.ENCRYPTION_KEY = 'a'.repeat(64); // valid 64-hex-char test key

const { encrypt, decrypt, encryptStudent, decryptStudent } = require('../src/lib/encryption');

describe('encrypt / decrypt', () => {
  it('produces a string in iv:authTag:ciphertext format', () => {
    const result = encrypt('hello');
    const parts = result.split(':');
    expect(parts).toHaveLength(3);
    expect(parts[0]).toHaveLength(24);  // 12 bytes = 24 hex chars
    expect(parts[1]).toHaveLength(32);  // 16 bytes = 32 hex chars
    expect(parts[2].length).toBeGreaterThan(0);
  });

  it('round-trips a plain string', () => {
    expect(decrypt(encrypt('Test Student'))).toBe('Test Student');
  });

  it('round-trips a string with special characters and unicode', () => {
    const val = 'Ágnes O\'Brien, 李伟 "nickname"';
    expect(decrypt(encrypt(val))).toBe(val);
  });

  it('returns null for null input (encrypt)', () => {
    expect(encrypt(null)).toBeNull();
  });

  it('returns null for undefined input (encrypt)', () => {
    expect(encrypt(undefined)).toBeNull();
  });

  it('returns null for null input (decrypt)', () => {
    expect(decrypt(null)).toBeNull();
  });

  it('produces different ciphertext each call (fresh IV)', () => {
    const a = encrypt('same value');
    const b = encrypt('same value');
    expect(a).not.toBe(b);
    // But both decrypt to the same plaintext
    expect(decrypt(a)).toBe('same value');
    expect(decrypt(b)).toBe('same value');
  });

  it('throws on tampered ciphertext (auth tag mismatch)', () => {
    const ciphertext = encrypt('sensitive');
    const [iv, authTag, data] = ciphertext.split(':');
    const tampered = `${iv}:${authTag}:${'ff'.repeat(data.length / 2)}`;
    expect(() => decrypt(tampered)).toThrow();
  });
});

describe('encryptStudent / decryptStudent', () => {
  it('encrypts only PII fields, leaves others unchanged', () => {
    const student = {
      id: 'abc-123',
      name: 'Alice',
      date_of_birth: '2015-06-01',
      skill_level: 'Beginner',
      parent_name: 'Bob',
      parent_phone: '555-0001',
      parent_email: 'bob@test.com',
      status: 'active',
    };
    const encrypted = encryptStudent(student);
    // PII fields are encrypted (not equal to original)
    expect(encrypted.name).not.toBe('Alice');
    expect(encrypted.date_of_birth).not.toBe('2015-06-01');
    expect(encrypted.parent_name).not.toBe('Bob');
    expect(encrypted.parent_phone).not.toBe('555-0001');
    expect(encrypted.parent_email).not.toBe('bob@test.com');
    // Non-PII fields are unchanged
    expect(encrypted.id).toBe('abc-123');
    expect(encrypted.skill_level).toBe('Beginner');
    expect(encrypted.status).toBe('active');
  });

  it('round-trips a full student object', () => {
    const student = {
      id: 'abc-123',
      name: 'Alice',
      date_of_birth: '2015-06-01',
      skill_level: 'Beginner',
      parent_name: 'Bob',
      parent_phone: '555-0001',
      parent_email: 'bob@test.com',
      status: 'active',
    };
    expect(decryptStudent(encryptStudent(student))).toEqual(student);
  });

  it('handles null parent fields (adult students)', () => {
    const adult = {
      id: 'xyz',
      name: 'Carol',
      date_of_birth: '1990-01-01',
      skill_level: 'Advanced',
      parent_name: null,
      parent_phone: null,
      parent_email: null,
      status: 'active',
    };
    const encrypted = encryptStudent(adult);
    expect(encrypted.parent_name).toBeNull();
    expect(encrypted.parent_phone).toBeNull();
    expect(encrypted.parent_email).toBeNull();
    expect(decryptStudent(encrypted)).toEqual(adult);
  });

  it('handles a partial object (only some PII fields present)', () => {
    // dashboard.js selects only id and name
    const partial = { id: 'abc', name: 'Dave' };
    const enc = encryptStudent(partial);
    expect(enc.name).not.toBe('Dave');
    expect(enc.id).toBe('abc');
    expect(decryptStudent(enc)).toEqual(partial);
  });
});

describe('startup validation', () => {
  it('throws if ENCRYPTION_KEY is missing', () => {
    const saved = process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;
    jest.resetModules();
    expect(() => require('../src/lib/encryption')).toThrow(/ENCRYPTION_KEY/);
    process.env.ENCRYPTION_KEY = saved;
    jest.resetModules();
  });

  it('throws if ENCRYPTION_KEY is not 64 hex characters', () => {
    const saved = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = 'tooshort';
    jest.resetModules();
    expect(() => require('../src/lib/encryption')).toThrow(/ENCRYPTION_KEY/);
    process.env.ENCRYPTION_KEY = saved;
    jest.resetModules();
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd backend && npx jest tests/encryption.test.js --no-coverage
```

Expected: FAIL — `Cannot find module '../src/lib/encryption'`

- [ ] **Step 3: Implement encryption.js**

Create `backend/src/lib/encryption.js`:

```js
const { createCipheriv, createDecipheriv, randomBytes } = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

// Validate key at module load time — fail fast if misconfigured
const rawKey = process.env.ENCRYPTION_KEY;
if (!rawKey || !/^[0-9a-fA-F]{64}$/.test(rawKey)) {
  throw new Error('ENCRYPTION_KEY must be set to a 64-character hex string');
}
const KEY = Buffer.from(rawKey, 'hex');

function encrypt(plaintext) {
  if (plaintext == null) return null;
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, KEY, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decrypt(ciphertext) {
  if (ciphertext == null) return null;
  const [ivHex, authTagHex, dataHex] = ciphertext.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const data = Buffer.from(dataHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, KEY, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

const PII_FIELDS = ['name', 'date_of_birth', 'parent_name', 'parent_phone', 'parent_email'];

function encryptStudent(student) {
  const result = { ...student };
  for (const field of PII_FIELDS) {
    if (field in result) result[field] = encrypt(result[field]);
  }
  return result;
}

function decryptStudent(student) {
  const result = { ...student };
  for (const field of PII_FIELDS) {
    if (field in result) result[field] = decrypt(result[field]);
  }
  return result;
}

module.exports = { encrypt, decrypt, encryptStudent, decryptStudent };
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd backend && npx jest tests/encryption.test.js --no-coverage
```

Expected: All tests pass. (The startup validation tests use `jest.resetModules()` — if they flake, run with `--runInBand`.)

- [ ] **Step 5: Commit**

```bash
cd backend && git add src/lib/encryption.js tests/encryption.test.js
git commit -m "feat: add AES-256-GCM encryption module with unit tests"
```

---

### Task 2: Key setup + Helmet.js

**Files:**
- Modify: `backend/.env`
- Modify: `backend/.env.example`
- Modify: `backend/src/app.js`

- [ ] **Step 1: Generate encryption key and add to .env**

Run this command to generate a secure 32-byte key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output. Add this line to `backend/.env` (replace `<generated_value>` with the output):

```
ENCRYPTION_KEY=<generated_value>
```

- [ ] **Step 2: Add placeholder to .env.example**

Add to `backend/.env.example`:

```
ENCRYPTION_KEY=# 64 hex chars — generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

- [ ] **Step 3: Install helmet**

```bash
cd backend && npm install helmet
```

Expected: `helmet` appears in `package.json` dependencies.

- [ ] **Step 4: Add helmet to app.js**

In `backend/src/app.js`, add the require and `app.use(helmet())` as the **first** middleware (before cors):

```js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');          // ADD THIS LINE
const authRoutes = require('./routes/auth');
// ... rest of requires unchanged ...

const app = express();

app.use(helmet());                         // ADD THIS LINE — must be first
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());
// ... rest unchanged ...
```

- [ ] **Step 5: Run full test suite to verify nothing broken**

```bash
cd backend && npm test
```

Expected: 51 tests pass (all existing tests). Helmet doesn't affect test results — it only adds response headers.

- [ ] **Step 6: Commit**

```bash
cd backend && git add src/app.js .env.example package.json package-lock.json
git commit -m "feat: add helmet security headers and ENCRYPTION_KEY setup"
```

---

### Task 3: Encrypt/decrypt in students.js

**Files:**
- Modify: `backend/src/routes/students.js`

The `addAgeCategory` helper in this file computes age from `date_of_birth`. Since `date_of_birth` is now encrypted in the DB, we must always decrypt before calling `addAgeCategory`.

Pattern for reads: `addAgeCategory(decryptStudent(data))`
Pattern for writes: encrypt PII fields before passing to Supabase, then decrypt the returned data.

- [ ] **Step 1: Add import at the top of students.js**

After the existing requires, add:

```js
const { encryptStudent, decryptStudent } = require('../lib/encryption');
```

- [ ] **Step 2: Update GET /students (returns array)**

Find:
```js
res.json(data.map(addAgeCategory));
```
Replace with:
```js
res.json(data.map(s => addAgeCategory(decryptStudent(s))));
```

- [ ] **Step 3: Update GET /students/:id (returns single)**

Find:
```js
res.json(addAgeCategory(data));
```
(This is the first occurrence — in the GET /:id handler.)

Replace with:
```js
res.json(addAgeCategory(decryptStudent(data)));
```

- [ ] **Step 4: Update POST /students (insert)**

Find:
```js
  const { name, date_of_birth, skill_level, parent_name, parent_phone, parent_email } = req.body;
  const { data, error } = await supabase
    .from('students')
    .insert({ name, date_of_birth, skill_level, parent_name, parent_phone, parent_email })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(addAgeCategory(data));
```

Replace with:
```js
  const { name, date_of_birth, skill_level, parent_name, parent_phone, parent_email } = req.body;
  const toInsert = encryptStudent({ name, date_of_birth, parent_name, parent_phone, parent_email });
  const { data, error } = await supabase
    .from('students')
    .insert({ ...toInsert, skill_level })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(addAgeCategory(decryptStudent(data)));
```

- [ ] **Step 5: Update PUT /students/:id (update)**

Find:
```js
  const { name, date_of_birth, skill_level, parent_name, parent_phone, parent_email, sibling_ids } = req.body;
  const { data, error } = await supabase
    .from('students')
    .update({ name, date_of_birth, skill_level, parent_name, parent_phone, parent_email, sibling_ids })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(addAgeCategory(data));
```

Replace with:
```js
  const { name, date_of_birth, skill_level, parent_name, parent_phone, parent_email, sibling_ids } = req.body;
  const toUpdate = encryptStudent({ name, date_of_birth, parent_name, parent_phone, parent_email });
  const { data, error } = await supabase
    .from('students')
    .update({ ...toUpdate, skill_level, sibling_ids })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(addAgeCategory(decryptStudent(data)));
```

- [ ] **Step 6: Update PATCH /students/:id/archive (returns full student)**

The archive route writes only `{ status: 'archived' }` (no PII), but Supabase returns all fields including encrypted PII via `.select()`. Note: `res.json(addAgeCategory(data))` appears multiple times in this file — use the surrounding block as the unique anchor. Find this exact block:

```js
  const { data, error } = await supabase
    .from('students')
    .update({ status: 'archived' })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(addAgeCategory(data));
```

Replace with:
```js
  const { data, error } = await supabase
    .from('students')
    .update({ status: 'archived' })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(addAgeCategory(decryptStudent(data)));
```

- [ ] **Step 7: Run all tests**

```bash
cd backend && npm test
```

Expected: All 51 tests pass. The encryption is transparent — the API contract is identical to before.

- [ ] **Step 8: Commit**

```bash
cd backend && git add src/routes/students.js
git commit -m "feat: encrypt PII fields on write, decrypt on read in students routes"
```

---

### Task 4: Decrypt in parent.js, ledger.js, and dashboard.js

**Files:**
- Modify: `backend/src/routes/parent.js`
- Modify: `backend/src/routes/ledger.js`
- Modify: `backend/src/routes/dashboard.js`

These routes read student data from Supabase but do not write PII — only decryption is needed.

- [ ] **Step 1: Update parent.js**

Add import at the top (after existing requires):
```js
const { decryptStudent } = require('../lib/encryption');
```

In the route handler, find where `student` is fetched and used. Change the variable name to `rawStudent` on the Supabase call, then decrypt before use:

Find:
```js
  const { data: student, error: stuErr } = await supabase
    .from('students')
    .select('id, name, date_of_birth, skill_level')
    .eq('parent_access_token', req.params.token)
    .single();
  if (stuErr?.code === 'PGRST116') return res.status(404).json({ error: 'Invalid link' });
  if (stuErr) return res.status(500).json({ error: stuErr.message });
```

Replace with:
```js
  const { data: rawStudent, error: stuErr } = await supabase
    .from('students')
    .select('id, name, date_of_birth, skill_level')
    .eq('parent_access_token', req.params.token)
    .single();
  if (stuErr?.code === 'PGRST116') return res.status(404).json({ error: 'Invalid link' });
  if (stuErr) return res.status(500).json({ error: stuErr.message });
  const student = decryptStudent(rawStudent);
```

The rest of the handler uses `student` — `getAgeCategory(student.date_of_birth)` will now receive the decrypted date. No further changes needed in this file.

- [ ] **Step 2: Update ledger.js**

Add import at the top (after existing requires):
```js
const { decryptStudent } = require('../lib/encryption');
```

In the `GET /:id/ledger` handler, find the student fetch and add decryption:

Find:
```js
  const { data: student, error: stuErr } = await supabase
    .from('students')
    .select('id, name, date_of_birth, skill_level, status')
    .eq('id', req.params.id)
    .single();
  if (stuErr?.code === 'PGRST116') return res.status(404).json({ error: 'Student not found' });
  if (stuErr) return res.status(500).json({ error: stuErr.message });
```

Replace with:
```js
  const { data: rawStudent, error: stuErr } = await supabase
    .from('students')
    .select('id, name, date_of_birth, skill_level, status')
    .eq('id', req.params.id)
    .single();
  if (stuErr?.code === 'PGRST116') return res.status(404).json({ error: 'Student not found' });
  if (stuErr) return res.status(500).json({ error: stuErr.message });
  const student = decryptStudent(rawStudent);
```

- [ ] **Step 3: Update dashboard.js**

Add import at the top (after existing requires):
```js
const { decryptStudent } = require('../lib/encryption');
```

In the route handler, find where `students` is fetched for balance computation (the query that selects `id, name`). Add decryption in the `.map()` that builds `studentBalances`:

Find:
```js
      studentBalances = (students || [])
        .map(s => ({
          id: s.id,
          name: s.name,
```

Replace with:
```js
      studentBalances = (students || [])
        .map(decryptStudent)
        .map(s => ({
          id: s.id,
          name: s.name,
```

- [ ] **Step 4: Run all tests**

```bash
cd backend && npm test
```

Expected: All tests pass (51 existing + all encryption unit tests).

- [ ] **Step 5: Commit**

```bash
cd backend && git add src/routes/parent.js src/routes/ledger.js src/routes/dashboard.js
git commit -m "feat: decrypt student PII in parent, ledger, and dashboard routes"
```

---

### Task 5: Final verification

- [ ] **Step 1: Run complete test suite**

```bash
cd backend && npm test --verbose
```

Expected output:
```
PASS tests/encryption.test.js
PASS tests/students.test.js
... (all other test suites)

Tests: XX passed, XX total
```

All tests green. If any test fails, do not proceed — investigate and fix first.

- [ ] **Step 2: Verify helmet headers (manual)**

Start the backend:
```bash
cd backend && node src/server.js
```

In a separate terminal, check response headers:
```bash
curl -I http://localhost:3001/api/health
```

Expected headers present in response:
```
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
X-DNS-Prefetch-Control: off
```

- [ ] **Step 3: Final commit if not already done**

If all tests pass and headers are correct:
```bash
cd backend && git status
```

All changes should already be committed from previous tasks. If anything is unstaged, stage and commit it now.
