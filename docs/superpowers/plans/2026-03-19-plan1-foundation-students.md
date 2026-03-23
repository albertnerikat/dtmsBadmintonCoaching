# Foundation + Student Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the full project foundation (React frontend, Node/Express backend, Supabase database) and implement complete student management with age categorization, skill levels, and parent link generation.

**Architecture:** React 18 + Vite frontend communicates with an Express REST API. Supabase (hosted PostgreSQL) stores all data. Coach logs in with a single shared email/password; a JWT is returned and stored in localStorage. Parent access uses a unique UUID token per student embedded in a URL — no login required on the parent side.

**Tech Stack:** React 18, Vite, Tailwind CSS v4, React Router v6, Node.js 20+, Express 4, @supabase/supabase-js, jsonwebtoken, Jest, Supertest

---

## File Structure

### Backend (`backend/`)
| File | Responsibility |
|------|---------------|
| `package.json` | Dependencies and scripts |
| `server.js` | HTTP server entry point |
| `src/app.js` | Express app: routes, middleware, CORS |
| `src/lib/supabase.js` | Supabase admin client (service role key) |
| `src/middleware/authMiddleware.js` | Validates coach JWT on protected routes |
| `src/routes/auth.js` | `POST /api/auth/login` |
| `src/routes/students.js` | Student CRUD endpoints |
| `tests/auth.test.js` | Auth endpoint tests |
| `tests/students.test.js` | Student CRUD tests |
| `.env.example` | Environment variable template |

### Frontend (`frontend/`)
| File | Responsibility |
|------|---------------|
| `package.json` | Dependencies |
| `vite.config.js` | Vite config + dev proxy to backend |
| `index.html` | HTML entry point |
| `src/main.jsx` | React entry point |
| `src/App.jsx` | Router + route definitions |
| `src/lib/api.js` | Fetch wrapper with auth header injection |
| `src/lib/auth.js` | Token storage helpers |
| `src/lib/utils.js` | Date formatting utilities |
| `src/context/AuthContext.jsx` | React context for auth state |
| `src/pages/LoginPage.jsx` | Coach login form |
| `src/pages/StudentsPage.jsx` | Student list + add/edit modals |
| `src/components/layout/Navbar.jsx` | Top navigation bar |
| `src/components/layout/ProtectedRoute.jsx` | Redirects unauthenticated users to /login |
| `src/components/students/StudentList.jsx` | Table of students with filters |
| `src/components/students/StudentForm.jsx` | Add/edit student form (used in modal) |

### Database (`supabase/`)
| File | Responsibility |
|------|---------------|
| `migrations/001_students.sql` | `students` table (run manually in Supabase SQL editor) |

> **Age category** is NOT stored in the database. It is computed from `date_of_birth` in the backend and returned with every student record. This prevents stale data as players age into new categories.

---

## Tasks

### Task 1: Initialize the backend project

**Files:**
- Create: `backend/package.json`
- Create: `backend/server.js`
- Create: `backend/src/app.js`
- Create: `backend/.env.example`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p backend/src/routes backend/src/middleware backend/src/lib backend/tests
cd backend
npm init -y
```

- [ ] **Step 2: Install dependencies**

```bash
npm install express cors dotenv @supabase/supabase-js jsonwebtoken
npm install --save-dev jest supertest nodemon
```

- [ ] **Step 3: Create `.env.example`**

```
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
JWT_SECRET=a_long_random_secret_string_change_this
COACH_EMAIL=coach@dtms.com
COACH_PASSWORD=your_shared_password
PORT=3001
```

- [ ] **Step 4: Copy `.env.example` to `.env` and fill in values**

```bash
cp .env.example .env
```

Use placeholder values for now — real Supabase values come after Task 3.

- [ ] **Step 5: Create `src/app.js`**

```javascript
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/students');

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

module.exports = app;
```

- [ ] **Step 6: Create `server.js`**

```javascript
require('dotenv').config();
const app = require('./src/app');
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
```

- [ ] **Step 7: Update `package.json` scripts and Jest config**

Add to `package.json`:
```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "test": "jest --runInBand"
  },
  "jest": {
    "testEnvironment": "node"
  }
}
```

- [ ] **Step 8: Verify server starts**

```bash
node server.js
```
Expected output: `Server running on port 3001`

Stop with Ctrl+C.

- [ ] **Step 9: Commit**

```bash
cd ..
git init
git add backend/
git commit -m "feat: initialize backend project with Express"
```

---

### Task 2: Initialize the frontend project

**Files:**
- Create: `frontend/` (via Vite scaffolding)
- Modify: `frontend/vite.config.js`
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Scaffold with Vite**

```bash
npm create vite@latest frontend -- --template react
cd frontend
npm install
```

- [ ] **Step 2: Install frontend dependencies**

```bash
npm install react-router-dom tailwindcss @tailwindcss/vite
```

- [ ] **Step 3: Replace `vite.config.js`**

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001'
    }
  }
})
```

- [ ] **Step 4: Replace `src/index.css` with Tailwind import**

```css
@import "tailwindcss";
```

- [ ] **Step 5: Replace `src/App.jsx` with a placeholder**

```jsx
export default function App() {
  return <div className="p-4 text-xl font-bold">DTMS Badminton Coaching</div>
}
```

- [ ] **Step 6: Verify frontend runs**

```bash
npm run dev
```
Expected: Browser opens at `http://localhost:5173` showing "DTMS Badminton Coaching"

- [ ] **Step 7: Commit**

```bash
cd ..
git add frontend/
git commit -m "feat: initialize frontend with Vite, React, Tailwind"
```

---

### Task 3: Set up Supabase database schema

**Files:**
- Create: `supabase/migrations/001_students.sql`

- [ ] **Step 1: Create a Supabase project**

Go to https://supabase.com, create a free account, and create a new project. Note:
- **Project URL** (e.g. `https://xxxxxxxxxxxx.supabase.co`)
- **Service role key** (Settings → API → `service_role` secret — keep this private)

- [ ] **Step 2: Create the migration file**

```bash
mkdir -p supabase/migrations
```

Create `supabase/migrations/001_students.sql`:

```sql
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  skill_level TEXT NOT NULL CHECK (skill_level IN ('Beginner', 'Intermediate', 'Advanced')),
  parent_name TEXT NOT NULL,
  parent_phone TEXT NOT NULL,
  parent_email TEXT NOT NULL,
  parent_access_token UUID NOT NULL DEFAULT gen_random_uuid(),
  sibling_ids UUID[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update updated_at on every change
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER students_updated_at
  BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

- [ ] **Step 3: Run the migration in Supabase**

In the Supabase dashboard → SQL Editor → paste and run the migration.

Verify: Table Editor → `students` table exists with all columns.

- [ ] **Step 4: Update `backend/.env` with real Supabase values**

```
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "feat: add students table Supabase migration"
```

---

### Task 4: Backend — Supabase client + auth endpoint

**Files:**
- Create: `backend/src/lib/supabase.js`
- Create: `backend/src/routes/auth.js`
- Create: `backend/src/middleware/authMiddleware.js`
- Test: `backend/tests/auth.test.js`

- [ ] **Step 1: Write failing auth tests**

Create `backend/tests/auth.test.js`:

```javascript
require('dotenv').config();
const request = require('supertest');
const app = require('../src/app');

describe('POST /api/auth/login', () => {
  it('returns 401 with wrong credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'wrong@email.com', password: 'wrongpass' });
    expect(res.status).toBe(401);
  });

  it('returns a token with correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: process.env.COACH_EMAIL, password: process.env.COACH_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(typeof res.body.token).toBe('string');
  });

  it('returns 401 with missing body', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend
npm test -- tests/auth.test.js
```
Expected: FAIL (routes don't exist yet)

- [ ] **Step 3: Create `src/lib/supabase.js`**

```javascript
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = supabase;
```

- [ ] **Step 4: Create `src/routes/auth.js`**

```javascript
const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (
    email !== process.env.COACH_EMAIL ||
    password !== process.env.COACH_PASSWORD
  ) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { role: 'coach' },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({ token });
});

module.exports = router;
```

- [ ] **Step 5: Create `src/middleware/authMiddleware.js`**

```javascript
const jwt = require('jsonwebtoken');

module.exports = function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }

  const token = authHeader.slice(7);
  try {
    req.coach = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
```

- [ ] **Step 6: Run auth tests**

```bash
npm test -- tests/auth.test.js
```
Expected: PASS (3 tests green)

- [ ] **Step 7: Commit**

```bash
# Run from project root
git add backend/src/ backend/tests/auth.test.js
git commit -m "feat: add coach auth endpoint and JWT middleware"
```

---

### Task 5: Backend — Student CRUD routes

**Files:**
- Create: `backend/src/routes/students.js`
- Test: `backend/tests/students.test.js`

**Age category logic** (same rule used in both backend and frontend):
```
Calculate the player's age as of today (accounting for whether their birthday has passed this year).
U13    → age <= 12
U15    → age 13–14
U17    → age 15–16
Adults → age >= 17
```

- [ ] **Step 1: Write failing student tests**

Create `backend/tests/students.test.js`:

```javascript
require('dotenv').config();
const request = require('supertest');
const app = require('../src/app');
const supabase = require('../src/lib/supabase');

let token;
let createdStudentId;

beforeAll(async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: process.env.COACH_EMAIL, password: process.env.COACH_PASSWORD });
  token = res.body.token;
});

afterAll(async () => {
  if (createdStudentId) {
    await supabase.from('students').delete().eq('id', createdStudentId);
  }
});

const auth = () => ({ Authorization: `Bearer ${token}` });

// DOB chosen so age is always clearly <=12 regardless of time of year:
// currentYear - 2014 = 12 (in 2026), and Jan 1 birthday has passed by any test run date.
const validStudent = {
  name: 'Test Student',
  date_of_birth: '2014-01-01',
  skill_level: 'Beginner',
  parent_name: 'Test Parent',
  parent_phone: '555-1234',
  parent_email: 'parent@test.com',
};

describe('POST /api/students', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/students').send(validStudent);
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing required fields', async () => {
    const res = await request(app)
      .post('/api/students')
      .set(auth())
      .send({ name: 'Incomplete' });
    expect(res.status).toBe(400);
  });

  it('creates a student and returns with age_category and parent_access_token', async () => {
    const res = await request(app)
      .post('/api/students')
      .set(auth())
      .send(validStudent);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('age_category');
    expect(res.body).toHaveProperty('parent_access_token');
    expect(res.body.age_category).toBe('U13');
    createdStudentId = res.body.id;
  });
});

describe('GET /api/students', () => {
  it('returns array with age_category on each student', async () => {
    const res = await request(app).get('/api/students').set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty('age_category');
    }
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/students');
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/students/:id', () => {
  it('updates the student', async () => {
    const res = await request(app)
      .put(`/api/students/${createdStudentId}`)
      .set(auth())
      .send({ ...validStudent, skill_level: 'Advanced' });
    expect(res.status).toBe(200);
    expect(res.body.skill_level).toBe('Advanced');
  });
});

describe('GET /api/students/:id', () => {
  it('returns a single student with age_category', async () => {
    const res = await request(app)
      .get(`/api/students/${createdStudentId}`)
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(createdStudentId);
    expect(res.body).toHaveProperty('age_category');
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app)
      .get('/api/students/00000000-0000-0000-0000-000000000000')
      .set(auth());
    expect(res.status).toBe(404);
  });
});

describe('POST /api/students/:id/regenerate-token', () => {
  it('returns a new parent_access_token different from the original', async () => {
    const original = await request(app)
      .get(`/api/students/${createdStudentId}`)
      .set(auth());
    const originalToken = original.body.parent_access_token;

    const res = await request(app)
      .post(`/api/students/${createdStudentId}/regenerate-token`)
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('parent_access_token');
    expect(res.body.parent_access_token).not.toBe(originalToken);
  });
});

describe('PATCH /api/students/:id/archive', () => {
  it('archives the student', async () => {
    const res = await request(app)
      .patch(`/api/students/${createdStudentId}/archive`)
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('archived');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/students.test.js
```
Expected: FAIL (route doesn't exist yet)

- [ ] **Step 3: Create `src/routes/students.js`**

```javascript
const express = require('express');
const { randomUUID } = require('crypto');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const supabase = require('../lib/supabase');

function getAgeCategory(dateOfBirth) {
  const today = new Date();
  const birth = new Date(dateOfBirth);
  let age = today.getFullYear() - birth.getFullYear();
  const hadBirthday =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
  if (!hadBirthday) age--;
  if (age <= 12) return 'U13';
  if (age <= 14) return 'U15';
  if (age <= 16) return 'U17';
  return 'Adults';
}

function addAgeCategory(student) {
  return { ...student, age_category: getAgeCategory(student.date_of_birth) };
}

const REQUIRED_FIELDS = [
  'name', 'date_of_birth', 'skill_level',
  'parent_name', 'parent_phone', 'parent_email',
];

// All student routes require coach auth
router.use(authMiddleware);

// GET /api/students
router.get('/', async (req, res) => {
  const { status = 'active' } = req.query;
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('status', status)
    .order('name');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.map(addAgeCategory));
});

// GET /api/students/:id
router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('id', req.params.id)
    .single();
  if (error?.code === 'PGRST116') return res.status(404).json({ error: 'Student not found' });
  if (error) return res.status(500).json({ error: error.message });
  res.json(addAgeCategory(data));
});

// POST /api/students
router.post('/', async (req, res) => {
  const missing = REQUIRED_FIELDS.filter(f => !req.body[f]);
  if (missing.length) {
    return res.status(400).json({ error: `Missing fields: ${missing.join(', ')}` });
  }
  const { name, date_of_birth, skill_level, parent_name, parent_phone, parent_email } = req.body;
  const { data, error } = await supabase
    .from('students')
    .insert({ name, date_of_birth, skill_level, parent_name, parent_phone, parent_email })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(addAgeCategory(data));
});

// PUT /api/students/:id
router.put('/:id', async (req, res) => {
  const { name, date_of_birth, skill_level, parent_name, parent_phone, parent_email, sibling_ids } = req.body;
  const { data, error } = await supabase
    .from('students')
    .update({ name, date_of_birth, skill_level, parent_name, parent_phone, parent_email, sibling_ids })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(addAgeCategory(data));
});

// PATCH /api/students/:id/archive
router.patch('/:id/archive', async (req, res) => {
  const { data, error } = await supabase
    .from('students')
    .update({ status: 'archived' })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(addAgeCategory(data));
});

// POST /api/students/:id/regenerate-token
router.post('/:id/regenerate-token', async (req, res) => {
  const { data, error } = await supabase
    .from('students')
    .update({ parent_access_token: randomUUID() })
    .eq('id', req.params.id)
    .select('parent_access_token')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ parent_access_token: data.parent_access_token });
});

module.exports = router;
```

- [ ] **Step 4: Run student tests**

```bash
npm test -- tests/students.test.js
```
Expected: PASS (all tests green)

- [ ] **Step 5: Commit**

```bash
# Run from project root
git add backend/src/routes/students.js backend/tests/students.test.js
git commit -m "feat: add student CRUD API with age category calculation"
```

---

### Task 6: Frontend — Auth utilities + login page

**Files:**
- Create: `frontend/src/lib/auth.js`
- Create: `frontend/src/lib/api.js`
- Create: `frontend/src/lib/utils.js`
- Create: `frontend/src/context/AuthContext.jsx`
- Create: `frontend/src/components/layout/ProtectedRoute.jsx`
- Create: `frontend/src/components/layout/Navbar.jsx`
- Create: `frontend/src/pages/LoginPage.jsx`
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Create `src/lib/auth.js`**

```javascript
const TOKEN_KEY = 'coach_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);
```

- [ ] **Step 2: Create `src/lib/api.js`**

```javascript
import { getToken } from './auth';

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || 'Request failed');
  }

  return res.json();
}

export const api = {
  get:   (path)       => request(path),
  post:  (path, body) => request(path, { method: 'POST',  body: JSON.stringify(body) }),
  put:   (path, body) => request(path, { method: 'PUT',   body: JSON.stringify(body) }),
  patch: (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body) }),
};
```

- [ ] **Step 3: Create `src/lib/utils.js`**

```javascript
// age_category is computed by the backend and returned with each student record.
// This file contains shared formatting helpers used across pages.

export function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-CA');
}
```

- [ ] **Step 4: Create `src/context/AuthContext.jsx`**

```jsx
import { createContext, useContext, useState } from 'react';
import { getToken, setToken, clearToken } from '../lib/auth';
import { api } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(getToken);

  async function login(email, password) {
    const data = await api.post('/auth/login', { email, password });
    setToken(data.token);
    setTokenState(data.token);
  }

  function logout() {
    clearToken();
    setTokenState(null);
  }

  return (
    <AuthContext.Provider value={{ token, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

- [ ] **Step 5: Create `src/components/layout/ProtectedRoute.jsx`**

```jsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}
```

- [ ] **Step 6: Create `src/components/layout/Navbar.jsx`**

```jsx
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Navbar() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <nav className="bg-blue-700 text-white px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <span className="font-bold text-lg">DTMS Badminton</span>
        <Link to="/students" className="text-sm hover:underline">Students</Link>
      </div>
      <button onClick={handleLogout} className="text-sm hover:underline">Logout</button>
    </nav>
  );
}
```

- [ ] **Step 7: Create `src/pages/LoginPage.jsx`**

```jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/students');
    } catch {
      setError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-2 text-center">DTMS Badminton</h1>
        <p className="text-gray-500 text-sm text-center mb-6">Coach Login</p>
        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm" required
          />
        </div>
        <div className="mb-6">
          <label className="block text-sm font-medium mb-1">Password</label>
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm" required
          />
        </div>
        <button
          type="submit" disabled={loading}
          className="w-full bg-blue-700 text-white py-2 rounded font-medium hover:bg-blue-800 disabled:opacity-50"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 8: Replace `src/App.jsx` with routing**

```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/layout/ProtectedRoute';
import Navbar from './components/layout/Navbar';
import LoginPage from './pages/LoginPage';
import StudentsPage from './pages/StudentsPage';

function CoachLayout({ children }) {
  return (
    <>
      <Navbar />
      <main className="p-6 max-w-6xl mx-auto">{children}</main>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/students"
            element={
              <ProtectedRoute>
                <CoachLayout><StudentsPage /></CoachLayout>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/students" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
```

- [ ] **Step 9: Create placeholder `src/pages/StudentsPage.jsx`**

```jsx
export default function StudentsPage() {
  return <div className="text-gray-500">Students page — coming next</div>;
}
```

- [ ] **Step 10: Verify login flow works end-to-end**

Start both servers in separate terminals:
```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

Open `http://localhost:5173`. You should:
1. Be redirected to `/login`
2. Enter credentials → redirect to `/students`
3. Click Logout → redirect back to `/login`

- [ ] **Step 11: Commit**

```bash
cd ..
git add frontend/src/
git commit -m "feat: add frontend auth context, protected routing, and login page"
```

---

### Task 7: Frontend — Students page

**Files:**
- Create: `frontend/src/components/students/StudentForm.jsx`
- Create: `frontend/src/components/students/StudentList.jsx`
- Modify: `frontend/src/pages/StudentsPage.jsx`

- [ ] **Step 1: Create `src/components/students/StudentForm.jsx`**

```jsx
import { useState } from 'react';

const SKILL_LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

export default function StudentForm({ initial = {}, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    name:         initial.name         ?? '',
    date_of_birth: initial.date_of_birth ?? '',
    skill_level:  initial.skill_level  ?? 'Beginner',
    parent_name:  initial.parent_name  ?? '',
    parent_phone: initial.parent_phone ?? '',
    parent_email: initial.parent_email ?? '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const field = (label, key, type = 'text') => (
    <div className="mb-3">
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        className="w-full border rounded px-3 py-2 text-sm"
        required
      />
    </div>
  );

  return (
    <form onSubmit={handleSubmit}>
      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
      {field('Full Name', 'name')}
      {field('Date of Birth', 'date_of_birth', 'date')}
      <div className="mb-3">
        <label className="block text-sm font-medium mb-1">Skill Level</label>
        <select
          value={form.skill_level}
          onChange={e => setForm(f => ({ ...f, skill_level: e.target.value }))}
          className="w-full border rounded px-3 py-2 text-sm"
        >
          {SKILL_LEVELS.map(l => <option key={l}>{l}</option>)}
        </select>
      </div>
      {field('Parent Name', 'parent_name')}
      {field('Parent Phone', 'parent_phone', 'tel')}
      {field('Parent Email', 'parent_email', 'email')}
      <div className="flex gap-2 mt-4">
        <button
          type="submit" disabled={loading}
          className="bg-blue-700 text-white px-4 py-2 rounded text-sm hover:bg-blue-800 disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save'}
        </button>
        <button
          type="button" onClick={onCancel}
          className="border px-4 py-2 rounded text-sm hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Create `src/components/students/StudentList.jsx`**

```jsx
const CATEGORY_COLORS = {
  U13: 'bg-green-100 text-green-800',
  U15: 'bg-blue-100 text-blue-800',
  U17: 'bg-purple-100 text-purple-800',
  Adults: 'bg-orange-100 text-orange-800',
};

export default function StudentList({ students, onEdit, onArchive, onCopyLink }) {
  if (students.length === 0) {
    return <p className="text-center text-gray-500 py-12">No students found.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100 text-left">
            <th className="px-3 py-2 border">Name</th>
            <th className="px-3 py-2 border">Age Category</th>
            <th className="px-3 py-2 border">Skill Level</th>
            <th className="px-3 py-2 border">Parent</th>
            <th className="px-3 py-2 border">Actions</th>
          </tr>
        </thead>
        <tbody>
          {students.map(student => (
            <tr key={student.id} className="hover:bg-gray-50">
              <td className="px-3 py-2 border font-medium">{student.name}</td>
              <td className="px-3 py-2 border">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_COLORS[student.age_category]}`}>
                  {student.age_category}
                </span>
              </td>
              <td className="px-3 py-2 border">{student.skill_level}</td>
              <td className="px-3 py-2 border">
                <div className="font-medium">{student.parent_name}</div>
                <div className="text-gray-500 text-xs">{student.parent_phone}</div>
              </td>
              <td className="px-3 py-2 border">
                <div className="flex gap-3">
                  <button onClick={() => onEdit(student)} className="text-blue-600 hover:underline">Edit</button>
                  <button onClick={() => onCopyLink(student)} className="text-green-600 hover:underline">Copy Link</button>
                  <button onClick={() => onArchive(student.id)} className="text-red-500 hover:underline">Archive</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Replace `src/pages/StudentsPage.jsx`**

```jsx
import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import StudentList from '../components/students/StudentList';
import StudentForm from '../components/students/StudentForm';

const AGE_CATEGORIES = ['All', 'U13', 'U15', 'U17', 'Adults'];

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function StudentsPage() {
  const [students, setStudents] = useState([]);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // null | 'add' | { student }
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadStudents(); }, []);

  async function loadStudents() {
    setLoading(true);
    try {
      const data = await api.get('/students');
      setStudents(data);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(form) {
    await api.post('/students', form);
    await loadStudents();
    setModal(null);
  }

  async function handleEdit(form) {
    await api.put(`/students/${modal.student.id}`, form);
    await loadStudents();
    setModal(null);
  }

  async function handleArchive(id) {
    if (!confirm('Archive this student? They will no longer appear in active lists.')) return;
    await api.patch(`/students/${id}/archive`);
    await loadStudents();
  }

  function handleCopyLink(student) {
    const link = `${window.location.origin}/parent/${student.parent_access_token}`;
    navigator.clipboard.writeText(link);
    alert('Parent link copied to clipboard!');
  }

  const filtered = students
    .filter(s => filter === 'All' || s.age_category === filter)
    .filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Students</h1>
        <button
          onClick={() => setModal('add')}
          className="bg-blue-700 text-white px-4 py-2 rounded text-sm hover:bg-blue-800"
        >
          + Add Student
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border rounded px-3 py-2 text-sm w-48"
        />
        <div className="flex gap-1">
          {AGE_CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-3 py-1.5 rounded text-sm border ${
                filter === cat
                  ? 'bg-blue-700 text-white border-blue-700'
                  : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading students...</p>
      ) : (
        <StudentList
          students={filtered}
          onEdit={student => setModal({ student })}
          onArchive={handleArchive}
          onCopyLink={handleCopyLink}
        />
      )}

      {modal === 'add' && (
        <Modal title="Add Student" onClose={() => setModal(null)}>
          <StudentForm onSubmit={handleAdd} onCancel={() => setModal(null)} />
        </Modal>
      )}

      {modal?.student && (
        <Modal title="Edit Student" onClose={() => setModal(null)}>
          <StudentForm
            initial={modal.student}
            onSubmit={handleEdit}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verify manually**

With both servers running, open `http://localhost:5173/students` and verify:
- Empty state shows "No students found"
- "+ Add Student" opens a modal with all fields
- Submitting creates a student that appears in the table with the correct age category badge
- Age category filter buttons work
- Name search filters the list in real time
- "Edit" opens the modal pre-filled with existing data
- "Copy Link" writes a URL to clipboard (check with Ctrl+V)
- "Archive" removes the student from the active list after confirmation

- [ ] **Step 5: Commit**

```bash
git add frontend/src/
git commit -m "feat: add students page with list, add, edit, archive, and parent link"
```

---

### Task 8: Housekeeping

**Files:**
- Create: `.gitignore`
- Create: `README.md`

- [ ] **Step 1: Create `.gitignore` at project root**

```
node_modules/
.env
dist/
.DS_Store
```

- [ ] **Step 2: Create `README.md`**

```markdown
# DTMS Badminton Coaching

## Development

### Prerequisites
- Node.js 20+
- A Supabase project (free tier is fine)

### Backend
```bash
cd backend
npm install
cp .env.example .env   # fill in Supabase URL, service role key, JWT secret, coach credentials
npm run dev            # starts on port 3001
```

### Frontend
```bash
cd frontend
npm install
npm run dev            # starts on port 5173, proxies /api to backend
```

### Tests
```bash
cd backend
npm test
```

## Plans
See `docs/superpowers/plans/` for implementation plans.
```

- [ ] **Step 3: Commit**

```bash
git add .gitignore README.md
git commit -m "chore: add gitignore and README"
```

---

## What's Next

- **Plan 2:** Schedule Management + Attendance Check-in
- **Plan 3:** Payments + Dashboard + Parent View
