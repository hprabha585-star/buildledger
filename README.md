# BuildLedger — Construction Management App

A full-stack web app for construction contractors to manage workers, sites, attendance, owners, and finances.

## Project Structure

```
buildledger/
├── backend/          ← Node.js + Express + MongoDB
│   ├── routes/       ← API routes
│   ├── models/       ← Mongoose schemas
│   ├── middleware/   ← JWT auth
│   ├── db/           ← MongoDB connection
│   └── server.js     ← Entry point
└── frontend/
    └── index.html    ← Complete React app (no build step)
```

## Local Development

### Backend
```bash
cd backend
npm install
# Create .env file with your MongoDB URI and JWT secret
node server.js
```

### Frontend
Open `frontend/index.html` in your browser.

## Deploy to Render

### Backend (Web Service)
- Root directory: `backend`
- Build command: `npm install`
- Start command: `node server.js`
- Environment variables:
  - `MONGO_URI` = your MongoDB Atlas connection string
  - `JWT_SECRET` = any long random string
  - `PORT` = 5000

### Frontend (Static Site)
- Root directory: `frontend`
- No build command needed
- Publish directory: `frontend`

## Environment Variables

Never commit `.env` files. Set these in Render dashboard:
- `MONGO_URI` — MongoDB Atlas connection string
- `JWT_SECRET` — Secret key for JWT tokens
- `PORT` — Server port (default 5000)
