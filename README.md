# Daybook

Local-first React daily activity tracker. Each day is automatically saved as `data/YYYY-MM-DD.json` beside the app.

## Run

```bash
npm install
npm run build
npm run dev
```

Open http://localhost:5173.

## Sign-in

The app uses one owner password for sign-in. Set `APP_PASSWORD` before starting the server; keep it private and use your hosting provider's environment-variable settings when deploying.

On macOS/Linux:

```bash
APP_PASSWORD='choose-a-long-unique-password' npm run dev
```

The server protects every `/api/` data endpoint and keeps sign-in in an HTTP-only, same-site cookie for up to seven days (the session ends if the server restarts). There is no public sign-up. For production, use HTTPS so the cookie is sent securely. Keep the `data/` directory on persistent storage when hosting; authentication does not provide backups or change where records are stored.

Browser reminders require notification permission and work while the app is open. The task reminder time is saved for future reminder support.
