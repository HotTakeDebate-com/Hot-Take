# Deploying Hot Take

## What runs in production

- **One Node process** (`npm start`) serves `dist/` (Vite build), Socket.IO, `/health`, `/api/rtc-config`.
- **Firebase** (Auth + Firestore + optional Analytics) is used from the **browser**.
- Optional hardening: server can verify Firebase ID tokens on Socket.IO using Firebase Admin SDK (`REQUIRE_FIREBASE_TOKEN=true`).

## Environment variables

### Server (runtime)

| Variable | Required | Notes |
|----------|----------|--------|
| `PORT` | No | Default `3001`. Your host may set `PORT` automatically. |
| `ICE_SERVERS_JSON` | No | Optional TURN/STUN JSON array for WebRTC. |
| `REQUIRE_FIREBASE_TOKEN` | No | `true` enforces Firebase ID token verification for Socket.IO connections. |
| `FIREBASE_ADMIN_SERVICE_ACCOUNT` | If enforcing | Service account JSON (raw JSON string or base64-encoded JSON). Alternative: host-provided `GOOGLE_APPLICATION_CREDENTIALS`. |

### Client (build time — Vite)

`VITE_*` variables are **baked into the JS at `npm run build`**. Set them in your host’s **build** environment (not only runtime).

The app expects **Firebase Email/Password** to be enabled in the Firebase Console (Authentication → Sign-in method).

| Variable | Required for Firebase |
|----------|------------------------|
| `VITE_FIREBASE_API_KEY` | Yes |
| `VITE_FIREBASE_AUTH_DOMAIN` | Yes |
| `VITE_FIREBASE_PROJECT_ID` | Yes |
| `VITE_FIREBASE_STORAGE_BUCKET` | Yes |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Yes |
| `VITE_FIREBASE_APP_ID` | Yes |
| `VITE_FIREBASE_MEASUREMENT_ID` | No |

After changing `VITE_*`, **rebuild** the client.

## Docker

From the repo root:

```bash
docker build -t hot-take .
docker run -p 3001:3001 -e PORT=3001 hot-take
```

Pass `ICE_SERVERS_JSON` at runtime if needed.
If enabling enforced Socket.IO auth, also pass `REQUIRE_FIREBASE_TOKEN=true` and Admin credentials.

## Managed platforms (examples)

- **Render / Railway / Fly.io:** Set **build command** `npm ci && npm run build`, **start command** `npm start`, add all `VITE_FIREBASE_*` as **build** env vars and `PORT` as needed.
- **Firebase Hosting** alone does not run Socket.IO; you still need a **Node** (or other) process for the signaling server unless you move signaling elsewhere.

## Firestore rules

Deploy `firestore.rules` from this repo (Console or Firebase CLI) before relying on production data — especially if you previously used **test mode**.
