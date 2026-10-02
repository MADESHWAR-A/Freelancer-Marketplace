# Workly — Review Ready Freelancer Marketplace

Workly is a full-stack freelancer marketplace demo built with Node.js, Express, SQLite, JWT HttpOnly cookies and native WebSockets. This edition is configured specifically for a reliable VS Code / college review workflow.

## What was fixed for the Review Ready edition

- Database schema is created automatically when the server starts.
- SQLite is the default database; PostgreSQL remains supported.
- Development JWT secret is generated automatically if `.env` is not present. Production still requires an explicit `JWT_SECRET`.
- Demo client and freelancer accounts are automatically seeded in development.
- A sample project is seeded so the dashboard is not empty.
- `/api/health` verifies the API and database connection.
- API errors now show the HTTP status or backend message instead of only `Request failed`.
- Frontend requests use same-origin relative API paths, so localhost and Cloudflare Tunnel use the same code.
- HttpOnly authentication cookies remain enabled.
- WebSocket authentication uses the same JWT cookie and supports `ws://` locally and `wss://` over HTTPS tunnels.
- Registration handles duplicate email conflicts cleanly.
- Chat validates the recipient before inserting a message.
- Review/demo buttons are available on the authentication page.
- Windows startup batch files are included.

## 1. Requirements

- Windows 10/11 or another OS with Node.js
- Node.js 20+ recommended
- VS Code recommended
- Internet connection only for the first `npm install` and optional Cloudflare Tunnel

Check Node.js:

```bash
node -v
npm -v
```

## 2. Easiest Windows startup

Double-click:

```text
START-WORKLY.bat
```

The script installs dependencies if needed and starts the server.

Then open:

```text
http://localhost:3000
```

Health check:

```text
http://localhost:3000/api/health
```

Expected response is similar to:

```json
{
  "status": "ok",
  "database": "connected",
  "environment": "development"
}
```

## 3. VS Code startup

Open the project folder in VS Code.

Terminal 1:

```bash
npm install
npm start
```

Then open:

```text
http://localhost:3000
```

You do NOT need to run `npm run init-db` for normal use. The server initializes the database automatically.

You can still run it manually:

```bash
npm run init-db
```

## 4. Demo accounts

The development server automatically creates these accounts:

### Client

```text
Email:    client@workly.demo
Password: Client@12345
Role:     Client
```

### Freelancer

```text
Email:    freelancer@workly.demo
Password: Freelancer@12345
Role:     Freelancer
```

The authentication page also has buttons to fill these credentials automatically.

These credentials are for local/demo review only. Use your own credentials and secret before any real deployment.

## 5. Recommended review demonstration

Use two browser sessions, for example Chrome normal + Chrome Incognito.

### Session A — Client

1. Open `/auth.html`.
2. Select the demo client.
3. Sign in.
4. Click `Post a Project`.
5. Create a project.
6. Keep the client dashboard open.

### Session B — Freelancer

1. Open the same Workly URL in Incognito.
2. Select the demo freelancer.
3. Sign in.
4. Find the client's project in the project feed.
5. Submit a proposal.
6. Open Chat with the client.

### Back to Session A

1. Open the project.
2. View the received proposal.
3. Accept or reject it.
4. Open the chat.
5. Send a message.

This demonstrates authentication, RBAC, projects, proposals, status changes and real-time messaging in one flow.

## 6. Public temporary URL with Cloudflare Tunnel

Start Workly first:

```bash
npm start
```

Open a second terminal.

If `cloudflared.exe` is in the project folder:

```powershell
.\cloudflared.exe tunnel --url http://localhost:3000
```

Or if cloudflared is installed in PATH:

```bash
cloudflared tunnel --url http://localhost:3000
```

You will receive a temporary URL similar to:

```text
https://random-name.trycloudflare.com
```

Open that URL on another phone/computer.

The same URL is used for REST APIs and WebSocket chat because the frontend uses relative API paths and derives the WebSocket protocol from `location.protocol`.

For HTTPS:

```text
https://...trycloudflare.com
       ↓
wss://...trycloudflare.com/ws/chat/{user_id}
```

Keep both the Node.js terminal and Cloudflare terminal running during the demo.

## 7. If you see `Request failed`

Do these checks in order.

### Check 1 — server

The Node terminal should show:

```text
Workly Freelancer Marketplace is running
Local:  http://localhost:3000
```

### Check 2 — database

Open:

```text
http://localhost:3000/api/health
```

You need:

```text
database: connected
```

### Check 3 — browser URL

When testing locally, use:

```text
http://localhost:3000
```

When testing through Cloudflare, use the active `https://...trycloudflare.com` URL.

Do not open the HTML files directly with `file:///...` and do not use VS Code Live Server for this project.

### Check 4 — browser console

Press `F12` → `Network` → click the failed API request.

The Review Ready frontend now reports useful errors such as:

```text
Request failed (HTTP 500)
Email is already registered
Invalid login credentials or role
Unable to reach the Workly server...
```

## 8. Why VS Code Live Server is not used

The project is not a static HTML-only application. It needs:

- Express API routes
- SQLite database
- JWT authentication
- HttpOnly cookies
- WebSocket server
- Server-side authorization

Therefore, start it with Node.js/Express instead of the VS Code Live Server extension.

## 9. Security model

- Passwords are hashed with bcrypt using 10 salt rounds.
- JWT is stored only in an HttpOnly cookie.
- SameSite cookie protection is enabled.
- Secure cookies can be enabled for production HTTPS.
- Dashboard pages call `/api/auth/me` before loading protected content.
- Client and freelancer endpoints use RBAC middleware.
- SQL queries use parameterized values.
- User input is length-limited and basic HTML metacharacters are removed.
- Helmet security headers are enabled.
- JSON request size is limited.
- WebSocket upgrade verifies the JWT cookie and requested user ID.
- WebSocket recipients are verified against the users table.
- Production must use a strong explicit `JWT_SECRET`.

## 10. Database

SQLite is the default:

```env
DB_CLIENT=sqlite
SQLITE_PATH=./marketplace.db
```

The four core tables are:

```text
users
projects
proposals
messages
```

SQLite uses foreign keys and WAL mode.

### PostgreSQL option

Set:

```env
DB_CLIENT=postgres
DATABASE_URL=postgresql://postgres:password@localhost:5432/marketplace
COOKIE_SECURE=true
SEED_DEMO=false
```

Then initialize and start:

```bash
npm run init-db
npm start
```

## 11. API endpoints

### Authentication

- POST `/api/auth/register`
- POST `/api/auth/login`
- GET `/api/auth/me`
- POST `/api/auth/logout`

### Projects

- GET `/api/projects`
- POST `/api/projects`
- GET `/api/projects/my-projects`
- GET `/api/projects/:id/proposals`
- PUT `/api/projects/proposals/:id/status`

### Proposals

- POST `/api/proposals`
- GET `/api/proposals/my-bids`

### Users

- PUT `/api/users/profile`
- GET `/api/users/:id`

### Messages

- GET `/api/messages/:otherUserId`
- WebSocket `/ws/chat/{user_id}`

## 12. Folder structure

```text
.
├── config/
│   ├── db.js
│   ├── init-db.js
│   └── seed-demo.js
├── controllers/
│   ├── authController.js
│   ├── messageController.js
│   ├── projectController.js
│   ├── proposalController.js
│   └── userController.js
├── middleware/
│   ├── auth.js
│   ├── error.js
│   └── validate.js
├── routes/
│   ├── auth.js
│   ├── messages.js
│   ├── projects.js
│   ├── proposals.js
│   └── users.js
├── public/
│   ├── index.html
│   ├── auth.html
│   ├── client-dashboard.html
│   ├── freelancer-dashboard.html
│   ├── style.css
│   └── script.js
├── START-WORKLY.bat
├── START-CLOUDFLARE.bat
├── .env.example
├── package.json
└── server.js
```

## 13. Production roadmap

For a true public production deployment, add:

- PostgreSQL managed database
- TLS with a permanent domain
- Secure secret management
- Refresh-token rotation or an equivalent session strategy
- CSRF protection appropriate to cookie authentication
- Rate limiting and abuse prevention
- Structured logs and monitoring
- Redis for scalable WebSocket presence/pub-sub
- Object storage for attachments
- Automated migrations
- Automated unit/integration/end-to-end tests
- CI/CD and container deployment
- Backups and disaster recovery

This ZIP is optimized for a reliable local/temporary-tunnel review and is not intended to be treated as a production secret-management configuration.
