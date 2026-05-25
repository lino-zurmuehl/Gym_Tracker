# Gym Tracker

A local-first strength tracker for GitHub Pages. It is set up like the FLux app:

- `frontend/` contains a Vite + React app.
- `.github/workflows/deploy.yml` builds `frontend/dist`.
- GitHub Pages deploys from the workflow artifact.

## Run Locally

```bash
cd frontend
npm install
npm run dev
```

## Build

```bash
cd frontend
npm run build
```

The app stores sessions in browser local storage and supports JSON export/import for backups.
