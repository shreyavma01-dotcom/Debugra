# Task Manager — Intentionally Broken Sample

Two bugs:

1. **JWT secret mismatch** — `server/auth.js` signs with `mysecret` but verifies with `supersecret`. Causes "invalid signature" on every authenticated request when token is verified.

2. **Authorization header handling** — `server/middleware/auth.js` only reads `req.headers['Authorization']` (capital A) and does not handle `Bearer` prefix or lowercase `authorization`. Causes failures for tests that use `authorization` lowercase or `Bearer <token>`.

Expected behavior:
- Initially: ~ mixture passes/fails (maybe 4-6/12 pass due to secret mismatch)
- After fixing secret only: Bearer and lowercase header tests still fail → 10/12
- After fixing header handling: 12/12

Run: `npm test`
