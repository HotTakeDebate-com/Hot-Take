# Operator moderation API

Internal tools for **investigations**, **audit trails**, and **account enforcement**. Data lives in **Firestore** (`reports`, **`users/{email}/debates`** including **`sessionKind: 'match'`** rows and nested **`chat_messages`**, legacy top-level **`debates`**, legacy **`match_sessions`** / **`chat_messages`**, **`moderation_actions`**) and **Firebase Auth** (enable/disable user).

**Current server model:** New match + chat are written only under **`users/{lowercaseEmail}/debates/{roomId}`** and **`.../chat_messages`**. Top-level **`match_sessions`** is **legacy** (older deploys); the API still reads it if no user-nested session is found.

## Prerequisites

1. **Firebase Admin** on the Node server (`FIREBASE_ADMIN_SERVICE_ACCOUNT` or ADC), same as Socket.IO and Firestore persistence.
2. **`HOT_TAKE_MODERATION_SECRET`** — long random string (16+ characters). On Railway or `.env` for local server **only** (never commit real values; never expose in the browser). **Legacy:** `CHITCHAT_MODERATION_SECRET` is still accepted if the new variable is unset.

## Authentication

Every request must send the secret in **one** of these ways:

- Header: `X-Hot-Take-Moderation: <your-secret>` (legacy: `X-Chitchat-Moderation`)
- Header: `Authorization: Bearer <your-secret>`

Use **HTTPS** in production. If the secret leaks, rotate it immediately.

## Base URL

- Local API server: `http://127.0.0.1:3001`
- Production: your deployed origin (e.g. Railway), same host as the site if the server serves the API.

With Vite dev, paths under `/api` proxy to port **3001** — e.g. `http://localhost:5173/api/mod/status` works if the secret is set on the backend.

## Endpoints

### Health

`GET /api/mod/status` — returns `{ ok: true }` when Admin + secret check passed.

### User reports (all reporters)

`GET /api/mod/reports?limit=50` — newest first (default limit 50, max 200).

`GET /api/mod/reports/:id` — single report.

### Match + chat (by WebRTC / Socket room id)

`GET /api/mod/match/:roomId?chatLimit=200`

- **Primary:** **Collection group** query on subcollections named **`debates`**: **`sessionKind == 'match'`** and **`roomId == :roomId`**. Loads session fields from the first matching doc and **`chat_messages`** ordered by **`sentAtMs`** (asc).
- **Fallback:** If nothing is found, reads legacy **`match_sessions/{roomId}`** and **`match_sessions/{roomId}/chat_messages`** (pre–user-nested data).

Response shape: `{ roomId, session, chat_messages }` (`session` may be `null`).

### Per-user debate rows (self-logged client history)

`GET /api/mod/user/:uid/debates?limit=40` — **`users/{email}/debates`** for that Auth user’s email plus legacy top-level **`debates`** rows with the same `uid` (merged, Admin SDK).

### Per-user canonical matches (server-logged sessions)

`GET /api/mod/user/:uid/sessions?limit=40`

- **Primary:** **`users/{email}/debates`** where **`sessionKind == 'match'`** (resolved via Auth email for `uid`), sorted by **`startedAt`** descending in the handler.
- **Merged:** Legacy **`match_sessions`** where **`proUid`** or **`conUid`** equals `uid` (rows not already present). Legacy entries may include **`_legacyPath: 'match_sessions'`**.

Response: `{ uid, userEmail, count, match_sessions }` (array name unchanged for tooling compatibility).

### Moderation audit log

`GET /api/mod/actions?limit=50` — documents from **`moderation_actions`**, newest first.

`POST /api/mod/actions` — append an audit row (JSON body):

```json
{
  "targetUid": "firebase-auth-uid",
  "action": "note",
  "reason": "Investigated report #abc; no policy violation.",
  "actorLabel": "support@example.com",
  "relatedReportId": "optional-firestore-doc-id",
  "relatedRoomId": "optional-room-id"
}
```

Allowed **`action`** values: `note`, `warn`, `ban_applied`, `ban_lifted`, `reviewed`, `escalated`.

### Firebase Auth: disable / enable sign-in

These call the **Admin Auth API** so the user cannot sign in until re-enabled.

`POST /api/mod/user/:uid/auth-disable` — body must include **`reason`** (audit text).

```json
{
  "reason": "Repeated harassment; report #…",
  "actorLabel": "support@example.com"
}
```

`POST /api/mod/user/:uid/auth-enable` — same shape; clears **disabled** on the account.

## Example (curl)

Replace `SECRET`, `HOST`, and `ROOM`.

```bash
curl -sS -H "X-Hot-Take-Moderation: SECRET" "https://HOST/api/mod/status"

curl -sS -H "X-Hot-Take-Moderation: SECRET" "https://HOST/api/mod/reports?limit=20"

curl -sS -H "X-Hot-Take-Moderation: SECRET" "https://HOST/api/mod/match/ROOM?chatLimit=500"

curl -sS -X POST -H "Content-Type: application/json" \
  -H "X-Hot-Take-Moderation: SECRET" \
  -d '{"targetUid":"UID","action":"note","reason":"Reviewed; warned in email.","actorLabel":"ops"}' \
  "https://HOST/api/mod/actions"
```

## Firestore rules

Deploy the repo’s **`firestore.rules`**. The **`moderation_actions`** collection must remain **client-deny**; only the server writes there via Admin SDK. Client users may **read** their own **`users/{email}/debates/.../chat_messages`**; only Admin may write.

## Indexes

If Firestore returns an error with a link to **create an index**, open the link and deploy the suggested index. Typical cases:

- **`orderBy('createdAt')`** on **`reports`** or **`moderation_actions`**.
- **`GET /api/mod/match/:roomId`:** **Collection group** index on **`debates`** for **`sessionKind`** + **`roomId`** (equality filters). Firebase usually provides a one-click URL in the error.

## Console workflow (no HTTP)

Use **Firebase Console → Firestore** as project owner: browse **`reports`**, **`users/{email}/debates/{roomId}`** (session row) and **`chat_messages`**, and legacy **`match_sessions`** if present. The HTTP API is for scripted access, backups, and tying actions to **`moderation_actions`**.
