# PII Encryption & Transport Security — Design Spec

**Date:** 2026-03-20
**Status:** Approved

## Overview

Add AES-256-GCM application-level encryption for student PII fields stored in Supabase, and add Helmet.js for secure HTTP response headers. This protects against both database breaches (encrypted at rest) and improves transport security (security headers). HTTPS termination is handled by the deployment platform, not the app.

## Scope

This spec covers:
- Application-level field encryption of student PII (data at rest)
- Helmet.js security headers (transport security layer in Express)

Out of scope (separate future work):
- Supabase Row-Level Security (RLS) policies
- Rate limiting on login/API endpoints
- Parent token expiration
- Audit logging
- Multi-factor authentication

---

## 1. Encryption Module

**File:** `backend/src/lib/encryption.js`

### Algorithm
AES-256-GCM — authenticated symmetric encryption. Provides both confidentiality and integrity (detects tampering via the auth tag).

### Key
- 32-byte key loaded from `ENCRYPTION_KEY` environment variable (hex-encoded, 64 hex characters)
- Validated at module load time: if `ENCRYPTION_KEY` is missing or not exactly 64 hex characters, the process throws an error and the app fails to start
- Generated once with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- Added to `.env` and `.env.example` (with placeholder in example file)

### Stored format
Each encrypted value is stored as a single colon-delimited string: `<iv_hex>:<authTag_hex>:<ciphertext_hex>`

- `iv`: 12 random bytes, freshly generated per `encrypt()` call (ensures two encryptions of the same value produce different ciphertext)
- `authTag`: 16 bytes, produced by GCM mode — used to verify integrity on decrypt
- `ciphertext`: the encrypted payload

### API
```js
encrypt(plaintext)  // string | null → string | null
decrypt(ciphertext) // string | null → string | null
```

- Both functions return `null` if the input is `null` or `undefined` (handles optional adult parent fields)
- `decrypt` throws if the auth tag does not match (tampered ciphertext)
- Uses Node.js built-in `crypto` module — no new dependencies

### Student helpers
Two thin wrappers also exported from `encryption.js`:

```js
encryptStudent(studentObj)  // encrypts only PII fields, returns new object
decryptStudent(studentObj)  // decrypts only PII fields, returns new object
```

These helpers keep encryption logic out of route handlers.

---

## 2. Fields Encrypted

Applied to the `students` table only. Encrypted before every INSERT/UPDATE; decrypted after every SELECT.

| Field | Encrypted |
|---|---|
| `name` | ✓ |
| `date_of_birth` | ✓ |
| `parent_name` | ✓ |
| `parent_phone` | ✓ |
| `parent_email` | ✓ |
| `id` | — |
| `skill_level` | — |
| `parent_access_token` | — |
| `sibling_ids` | — |
| `status` | — |
| `created_at` | — |
| `updated_at` | — |

`age_category` is computed from `date_of_birth` server-side after decryption — it is not stored.

---

## 3. Integration with Routes

Every Supabase read of student PII fields must be followed by `decryptStudent()` on each result. Every Supabase write must be preceded by `encryptStudent()` on the data being written. No encryption logic lives in route handlers — only calls to the helpers.

**`backend/src/routes/students.js`:**
- `GET /students` — decrypt each student in the returned array
- `GET /students/:id` — decrypt the single returned student
- `POST /students` — encrypt body fields before insert
- `PUT /students/:id` — encrypt body fields before update
- `PATCH /students/:id/archive` — no PII fields written, no change needed
- `POST /students/:id/regenerate-token` — no PII fields written, no change needed

**`backend/src/routes/parent.js`:**
- `GET /api/parent/:token` — selects `name` and `date_of_birth` (both encrypted). The token lookup uses `parent_access_token` which is not encrypted, so the `.eq()` query is unaffected. Apply `decryptStudent()` to the student result before responding.

**`backend/src/routes/ledger.js`:**
- Any route that selects `name` or `date_of_birth` from the `students` table must apply `decryptStudent()` to the student result. `age_category` is computed from the decrypted `date_of_birth` — if decryption is skipped, `age_category` computation will produce incorrect results.

**`backend/src/routes/dashboard.js`:**
- Any route that selects `name` from the `students` table must apply `decryptStudent()` to each student result before responding, to avoid returning raw ciphertext.

**Impact on frontend:** None. API request/response shapes are identical — encryption is invisible to callers.

**Impact on sort order:** The `GET /students` route uses `.order('name')` in Supabase. Once `name` is stored encrypted, the database sort will operate on ciphertext rather than plaintext. This is acceptable — the frontend performs client-side name search, and alphabetical ordering is not a strict requirement for the student list.

---

## 4. Transport Security — Helmet.js

**File modified:** `backend/src/app.js`

`helmet` added as a dependency (`npm install helmet`). Applied as the first middleware:

```js
const helmet = require('helmet');
app.use(helmet());
```

Default Helmet configuration sets the following headers:
- `Content-Security-Policy`
- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security` (HSTS)
- `Referrer-Policy`
- `X-DNS-Prefetch-Control`

No custom Helmet configuration is required.

**HTTPS:** Termination is handled by the deployment platform (Railway, Render, etc.). No TLS configuration in app code.

---

## 5. Key Management

- `ENCRYPTION_KEY` added to `backend/.env` (real value, gitignored)
- `ENCRYPTION_KEY` added to `backend/.env.example` with comment: `# 64 hex chars — generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- Key rotation (changing the key) requires a migration script to re-encrypt all existing records — out of scope for this spec since no real data exists yet

---

## 6. Existing Data

No migration needed. The app is still in development with no real student data. Encrypted storage begins from the first record inserted after this change is deployed.

---

## 7. Testing

**New file:** `backend/tests/encryption.test.js`

Unit tests (no Supabase connection needed):
- `encrypt` returns a string in `iv:authTag:ciphertext` format
- `decrypt(encrypt(value))` round-trips correctly for normal strings
- `decrypt(encrypt(value))` round-trips for strings with special characters and unicode
- `encrypt(null)` returns `null`; `decrypt(null)` returns `null`
- Two calls to `encrypt` on the same value produce different ciphertext (fresh IV)
- `decrypt` throws on tampered ciphertext (auth tag mismatch)
- Module throws at load time if `ENCRYPTION_KEY` is missing
- Module throws at load time if `ENCRYPTION_KEY` is not 64 hex characters

**Existing tests:** All 51 existing student API tests pass unchanged — the API contract is identical before and after encryption.

**Helmet:** Verified by inspecting response headers in existing integration tests (no new tests needed).
