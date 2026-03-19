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
