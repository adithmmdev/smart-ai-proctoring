# Smart AI Proctoring System

I built this project to work on the full flow of an online examination system and to understand how browser based computer vision can be connected to a backend application.

It has separate student and admin areas, exam management, submissions, authentication, proctoring events and MongoDB storage.

## What I built

The main parts of the project are:

* Student login and exam flow
* Admin dashboard for managing exams and reviewing submissions
* JWT based authentication
* Role based access for students and admins
* MongoDB models for users, exams, submissions and proctoring logs
* Browser side face and gaze related checks using MediaPipe and TensorFlow.js
* Proctoring events for missing face, multiple faces, tab switching and head or gaze movement
* Automatic exam submission when the configured violation limit is crossed

## How it is organised

```text
React + TypeScript
        ↓
   Express API
        ↓
      JWT auth
        ↓
     MongoDB
        ↑
Proctoring events
from browser
```

The frontend handles the exam interface and computer vision signals. The backend receives the events, checks the authenticated user and stores the information in MongoDB.

## Proctoring flow

The browser looks for a few events while the student is taking an exam. These events are sent to the backend as structured data.

For example:

```text
Face missing
Multiple faces
Tab switch
Head movement
Gaze movement
```

The backend keeps a record of these events. Each exam can also have a maximum violation setting that is used when deciding whether an exam should be submitted automatically.

## Project structure

```text
smart-ai-proctoring/
├── backend/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── scripts/
│   └── app.js
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   └── App.tsx
│   └── package.json
└── README.md
```

## Running locally

### Backend

```bash
cd backend
npm install
```

Copy the example configuration file to your local configuration file and add your MongoDB connection string and JWT secret.

```bash
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend uses `VITE_API_BASE_URL` when a different backend URL is required.

## Security work

I also spent time fixing some practical issues while working on the project.

* JWT secrets and database credentials are kept in environment configuration
* CORS origins are configured through environment variables
* Passwords are hashed with bcrypt
* Protected routes use JWT middleware
* Admin routes check the user role
* A health endpoint is available at `/health`
* Backend tests cover the main authentication middleware cases

## Tests

Backend tests use Node's built in test runner.

```bash
cd backend
npm test
```

The repository also has basic validation through the backend lint script and GitHub Actions.

## What I learned

The interesting part of this project for me was connecting several pieces together. The computer vision code is only useful when its output can be turned into events, stored by the backend and used by the exam system.

I also learned a lot about authentication, role based access, API design, browser side processing and deployment while building it.

## Current limitations

The current proctoring signals should not be treated as proof of cheating. They are signals that can help an administrator review an exam.

The project also sends some camera related data through API requests. A larger production system would need a better media storage design and more detailed evaluation of false positives and false negatives.

## Tech used

React, TypeScript, Vite, MediaPipe, TensorFlow.js, Node.js, Express, MongoDB, Mongoose, JWT, bcrypt and Render.
