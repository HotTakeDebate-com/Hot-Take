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
| `REDIS_URL` | No | When set, enables the **Socket.IO Redis adapter** (multi-process) and **shared** join-queue rate limits across instances. Omit for single-node dev/deploy. |

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

## Production readiness (safety + surviving traffic spikes)

These steps reduce abuse, confusing failures, and “works on my machine” gaps when lots of people show up at once.

1. **Enforce Socket.IO auth** — Set `REQUIRE_FIREBASE_TOKEN=true` and configure `FIREBASE_ADMIN_SERVICE_ACCOUNT` (or `GOOGLE_APPLICATION_CREDENTIALS`). Anonymous matchmaking without a verified user becomes impossible.
2. **Trust the proxy** — By default the server trusts one reverse-proxy hop so `X-Forwarded-For` is used for rate limits. If you expose Node directly, set `TRUST_PROXY=0` (see `.env.example`).
3. **Tune rate limits** — `RATE_LIMIT_JOIN_QUEUE_MAX` / `RATE_LIMIT_JOIN_QUEUE_WINDOW_MS` and `DEBATE_CHAT_MAX_PER_MIN` / `DEBATE_CHAT_MAX_LEN` live in `.env.example`. In-memory limits reset per process; for **multiple Node instances** use a shared store (e.g. Redis) or edge rate limiting.
4. **Monitor `/health`** — Response includes `ok`, `uptimeSec`, `socketAuth`, `firebaseAdmin`, and `redis` (whether `REDIS_URL` connected). Wire your host or an external checker to alert when `ok` is false or the process is flapping.
5. **TURN for WebRTC** — Under load, more users hit strict NAT; set `ICE_SERVERS_JSON` with a commercial TURN provider before blaming “random” failed calls.
6. **Horizontal scale** — Matchmaking queues and custom lobbies stay **in-memory per Node process**. To run **multiple server replicas**, set **`REDIS_URL`**: the repo wires **`@socket.io/redis-adapter`** so Socket.IO events and rooms sync across processes, and **join-queue rate limits** use Redis so abuse limits apply cluster-wide. You still need a **single logical matchmaking layer** (or sticky sessions + accepted split-brain) for fair queues—Redis alone does not merge the in-memory queue Maps; for heavy viral load, plan a dedicated queue service or sticky routing to one matcher.

## Firestore indexes (optional)

If Firebase prompts for an index when running profile name search, create it from the console link or add `firestore.indexes.json` and deploy with the Firebase CLI.
