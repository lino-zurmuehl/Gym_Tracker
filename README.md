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

## Privacy

Workout data is stored locally in this browser profile. The app does not send your sessions to a backend. A local passcode protects the app UI on this device, but browser storage is still device-local storage, so keep your device account protected and export backups when needed.
