# StudyBuddy AI

StudyBuddy is a React/Vite study planner with an Express API, MongoDB storage,
and private user accounts.

## Requirements

- Node.js 20.19+ or 22.12+
- MongoDB running locally, or a MongoDB Atlas connection string

## Configure the API

The application code is organized into `frontend/` and `backend/`. Shared
subject definitions remain in `shared/`; the root `package.json` provides
commands for both applications.

1. Copy `backend/.env.example` to `backend/.env`.
2. Set `MONGODB_URI` to your local MongoDB URI or Atlas connection string.
3. Generate a private JWT secret locally:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```

   Put the generated value in `backend/.env` as `JWT_SECRET`. Do not share or
   commit `.env`; it is ignored by Git.
4. Keep `CLIENT_ORIGIN=http://localhost:5173` for local development. Set it to
   the exact HTTPS frontend origin when deploying.
5. Configure an SMTP provider in `backend/.env` to deliver password-reset
   messages. Resend SMTP or SMTP2GO are suitable options; verify the sender
   address with your provider. Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`,
   `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM`. Use port 587 with
   `SMTP_SECURE=false` or port 465 with `SMTP_SECURE=true`. Keep provider
   credentials only in `backend/.env`.

For a local MongoDB installation, make sure the MongoDB service is running
before starting the API. For MongoDB Atlas, create a database user, allow the
development machine's IP address in Network Access, and use the URI provided
by Atlas. Keep credentials only in `backend/.env`.

## Run locally

Install dependencies:

```powershell
npm install
```

Start the API and Vite frontend in separate terminals from the project folder:

```powershell
npm run server:dev
```

```powershell
npm run dev
```

Open the Vite URL shown in the frontend terminal. Vite proxies `/api` requests
to the Express server on port 3001. The API will refuse to start if the database
URI or a sufficiently long JWT secret is missing, or if MongoDB is unreachable.

## Authentication and task data

- Passwords are hashed with bcrypt and never returned by the API.
- JWTs are stored in `HttpOnly`, `SameSite=Strict` cookies; production cookies
  are marked `Secure`.
- Mutating requests require a CSRF token. Login and registration are rate
  limited.
- Forgot-password requests return the same response whether or not an account
  exists. Reset links use a random single-use token that expires after 15
  minutes; only its SHA-256 hash is stored. Password reset increments the
  account token version to invalidate existing sessions. Requests are rate
  limited, and delivery uses the SMTP settings above and the trusted
  `CLIENT_ORIGIN` to build links.
- Task APIs require authentication and scope every query to the signed-in user.
- Study timer sessions are stored in MongoDB under the signed-in user's ID.
  The active session is restored on refresh, and stopping it finalizes the
  existing record rather than creating a duplicate.
- Timer history and today's time are calculated from persisted run/pause
  segments, including sessions that cross local midnight.
- Daily, weekly, and per-subject study goals are stored per user. Goal progress
  is calculated only from completed timer sessions; active or paused time is
  not counted until the session is stopped.
- Study notes are stored per user in MongoDB, validated against the shared
  subject list, and can be searched by title or content and filtered by subject.
  Notes require a title, content, and one of the seven subjects; title and
  content are limited to 120 and 6,000 characters, respectively.
- The AI Assistant calls a local Ollama service only from the Express backend.
  Conversations are private to their owner and stored in MongoDB. The default
  model is `qwen2.5:3b`; the app reports when Ollama is unavailable or the model
  is missing, and never saves or displays a fabricated answer.

## Configure the AI Assistant

1. Install [Ollama](https://ollama.com/download) and pull the default model:

   ```powershell
   ollama pull qwen2.5:3b
   ```

2. Make sure Ollama is running. It usually starts as a background service; if
   needed, run `ollama serve` in a separate terminal.
3. Keep `OLLAMA_BASE_URL=http://localhost:11434` and
   `OLLAMA_MODEL=qwen2.5:3b` in `backend/.env`, or set `OLLAMA_MODEL` to another
   model already installed in Ollama.
4. Start MongoDB, then run `npm run server:dev` and `npm run dev` in separate
   terminals. Sign in, open **AI Assistant**, and submit a study question.
   The backend checks Ollama availability and model installation; setup errors
   appear in the assistant panel. No `OPENAI_API_KEY` is required.

## Notifications and reminders

- The authenticated notifications API derives reminders from each user's own
  pending tasks: overdue tasks, tasks due today, and deadlines in the next
  seven days. Per-user reminder-period keys prevent duplicate notifications.
- Use the bell in the header to view, mark as read, or clear notifications and
  to enable or disable task reminders. Notification state and the preference
  are stored in MongoDB for the signed-in user.
- These are in-app reminders and refresh while the app is open. The project
  does not run a background scheduler and does not send browser or email
  notifications when the app is closed.

## Student Resource Library

- Resource uploads are stored as files in the private backend directory
  `backend/private-resources` by default. MongoDB stores only file metadata and
  a generated storage key. Files are served through authenticated API routes,
  never as public static files.
- The backend accepts PDF, DOCX, PPTX, XLSX, JPEG, PNG, GIF, and WEBP files up
  to 15 MB. PDF and raster images can be previewed; supported office documents
  can be downloaded.
- Set `RESOURCE_STORAGE_DIR` in `backend/.env` to use another local persistent
  directory. No external storage provider or paid account is required. On
  hosts with ephemeral disks, configure a persistent volume or uploaded files
  will not survive redeployments. Back up this directory along with MongoDB.
- Uploading with **Upload and share** makes the resource visible to signed-in
  students. Uploaders can edit details or delete their own files; reports from
  students are stored for review.

- Deploy the frontend and API on the same site (same domain or same-site
  subdomains) so the strict session cookie can be sent. Production cookies use
  HTTPS-only `Secure` mode.
- The seven subjects are validated by the API as well as the frontend.
- Existing browser tasks remain in `localStorage`. After signing in, the UI
  offers an explicit import into the current account; it does not remove or
  overwrite the browser copy. Import requests are idempotent per account/task.

## Verify

```powershell
npm test
npm run lint
npm run build
```
