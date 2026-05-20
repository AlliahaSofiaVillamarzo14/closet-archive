# Closet Archive - Backend for Contact Form

This is a tiny Express backend used to persist contact form messages to a JSON file.

How to run:

```bash
cd img/backend
npm install
npm start
```

The server will run on `http://localhost:3000` and serves the static site from the parent folder. The contact API is available at `/api/contact` (POST) and stored messages can be viewed at `/api/messages` (GET).

Note: This is a minimal demo for local use. For production use add validation, authentication, and persistent DB.

Optional email notifications
----------------------------
If you want the backend to notify the owner by email when a message arrives, set these environment variables before starting the server:

- `SMTP_HOST` – SMTP server host (e.g., smtp.gmail.com)
- `SMTP_PORT` – SMTP port (default 587)
- `SMTP_SECURE` – 'true' to use TLS (optional)
- `SMTP_USER` – SMTP username
- `SMTP_PASS` – SMTP password
- `OWNER_EMAIL` – destination email for notifications
- `SMTP_FROM` – optional From address (defaults to `SMTP_USER`)

Example (macOS / Linux):

```bash
SMTP_HOST=smtp.example.com SMTP_PORT=587 SMTP_USER=you@example.com SMTP_PASS=pa55word OWNER_EMAIL=owner@example.com npm start
```

This email notification is best-effort — if SMTP is not configured the backend will still save messages to `messages.json`.
