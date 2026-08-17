# Smart AI Proctoring — Frontend

React + TypeScript frontend for the Smart AI Proctoring System.

## Responsibilities

- Student and administrator authentication flows
- Exam dashboards and submission workflows
- Browser-side proctoring signals using MediaPipe/TensorFlow tooling
- Proctoring status and violation feedback
- Responsive UI with reusable components

## Development

```bash
npm install
npm run dev
```

The API base URL is configured with `VITE_API_BASE_URL`.

## Production build

```bash
npm run build
```

The generated `dist/` directory is deployment output and is intentionally ignored by Git.
