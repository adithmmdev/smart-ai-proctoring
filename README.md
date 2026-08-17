# Smart AI Proctoring System

A full-stack exam platform that combines **React + TypeScript**, **Node.js + Express**, **MongoDB**, JWT authentication, and browser-side computer-vision tooling to support secure online examinations and automated proctoring signals.

> Portfolio focus: full-stack engineering, authentication/authorization, browser computer vision, event-driven proctoring logs, and deployment.

## What the system does

### Student workflow
- Register and authenticate
- View available exams
- Take timed examinations
- Submit answers
- Receive proctoring feedback and violation handling

### Administrator workflow
- Manage exams and questions
- Monitor student activity
- Review submissions
- Inspect proctoring logs and suspicious events
- View exam-level statistics

### Proctoring layer
The frontend uses browser-side MediaPipe/TensorFlow tooling for face-related signals. Detected events are sent to the Express API and stored as structured proctoring logs.

Current signals represented by the application include:

- Face missing
- Multiple faces
- Tab/window switching
- Head/gaze direction events
- Other configurable warning/error flags

The backend can automatically submit an exam when the configured violation threshold is exceeded.

## Architecture

```text
┌─────────────────────────────┐
│ React + TypeScript Frontend │
│                             │
│ Exam UI / Dashboards        │
│ MediaPipe / TensorFlow      │
└──────────────┬──────────────┘
               │ HTTPS / REST
               ▼
┌─────────────────────────────┐
│ Express API                 │
│                             │
│ JWT Authentication          │
│ Role-based Authorization    │
│ Exam / Submission APIs      │
│ Proctoring APIs             │
└──────────────┬──────────────┘
               │ Mongoose
               ▼
┌─────────────────────────────┐
│ MongoDB                     │
│                             │
│ Users / Exams / Submissions │
│ Proctoring Logs             │
└─────────────────────────────┘
```

## Repository structure

```text
smart-ai-proctoring/
├── backend/
│   ├── config/              # Database configuration
│   ├── controllers/         # API/business logic
│   ├── middleware/          # JWT + role authorization
│   ├── models/              # Mongoose schemas
│   ├── routes/              # REST endpoints
│   ├── app.js               # Express application
│   ├── render.yaml          # Render deployment configuration
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/      # Dashboards, proctoring UI, reusable UI
│   │   ├── config.ts        # API URL configuration
│   │   └── App.tsx
│   ├── public/
│   ├── vite.config.ts
│   └── package.json
│
└── README.md
```

## Security and engineering decisions

### Authentication
Users authenticate through the Express API. Passwords are hashed with `bcrypt`, while authenticated requests use JWT bearer tokens.

### Authorization
Protected routes use middleware to resolve the authenticated user. Administrator-only endpoints additionally enforce the `admin` role.

### CORS
Allowed frontend origins are configured through `FRONTEND_URL` instead of being hard-coded into the backend.

### Secrets
Database credentials and JWT secrets belong in environment configuration and are intentionally excluded from Git. Use `backend/config/config.env.example` as the local configuration template.

### Payload limits
JSON payload limits are explicitly bounded because the application can transmit camera/proctoring data. Production deployments should additionally use object storage or multipart uploads for large media rather than treating large base64 payloads as the default long-term architecture.

## API surface

The backend exposes versioned REST routes under `/api/v1/`, including:

| Area | Example capability |
|---|---|
| Auth | Register, login, current user |
| Exams | Create/manage exams and questions |
| Submissions | Submit and review answers |
| Proctoring | Store flags, snapshots, and retrieve logs |
| Reports | Exam/report data |
| Students | Student-specific operations |
| Admin | Administrative operations and statistics |

A lightweight health endpoint is available at:

```text
GET /health
```

Expected response:

```json
{"status":"ok"}
```

## Local development

### 1. Backend

```bash
cd backend
npm install
```

Create your local configuration from the example:

```text
config/config.env.example → config/config.env
```

Then start the API:

```bash
npm run dev
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Set `VITE_API_BASE_URL` when the frontend needs to target a non-default backend.

### 3. Validation

Backend syntax checks:

```bash
cd backend
npm run lint
```

Backend tests:

```bash
npm test
```

## Deployment

The repository contains a Render service definition for the backend. The frontend can be deployed as a Vite application on a static hosting platform.

Production configuration should provide:

```text
MONGO_URI
JWT_SECRET
FRONTEND_URL
PORT
NODE_ENV
```

Do not commit real credentials, database URLs containing passwords, or test-user passwords.

## Current limitations

- Proctoring decisions are based on client-side signals and should be treated as **decision support**, not definitive proof of academic misconduct.
- Large camera payloads are currently handled through API requests; a production-scale version should move media to object storage.
- The project does not currently claim a benchmarked computer-vision accuracy metric; future work should evaluate false-positive/false-negative rates on a labeled dataset.
- Automated exam submission is threshold-based and should be made configurable and auditable in a production deployment.

## Future engineering roadmap

- Add automated API integration tests
- Add frontend component tests
- Add CI for frontend build + backend validation
- Move large media to object storage
- Add rate limiting and request validation
- Add structured logging and observability
- Add an auditable proctoring-event model with confidence and source metadata
- Evaluate proctoring signals against a labeled validation dataset

## Tech stack

**Frontend:** React, TypeScript, Vite, Tailwind-style UI components, MediaPipe, TensorFlow.js

**Backend:** Node.js, Express, JWT, bcrypt, Mongoose

**Database:** MongoDB

**Deployment:** Vercel/Netlify-compatible frontend build + Render backend configuration

## Why this project matters

This project demonstrates more than a UI: it combines authentication, authorization, database modeling, REST API design, browser computer vision, event logging, automated decision rules, and deployment concerns in one end-to-end system.
