# FFID LiveOps QA Tools

Web application for the Free Fire Indonesia LiveOps QA team: **Banner QA** (weekly sheet — Tools A/B) and **Splash & Anno** (in-game publishing — Tools C/D). Reads from Google Sheets, surfaces missing CDN uploads, day-by-day in-game checklists, and CDN link health.

## What this solves

| Pain point | How this tool helps |
|---|---|
| 100+ sheet tabs, hard to find current week | Auto-detects latest 4 **sub-weeks** from recent tabs |
| No single "missing CDN" view | **Tool A** lists all `CDN Uploaded = 0` rows, grouped by placement |
| No date-aware in-game QA view | **Tool B** shows APPEAR / DISAPPEAR / Still active per day |
| Manual CDN link verification | Live CDN health check per row (cached; `.ff_extend` → `.jpg`) |
| Missed uploads → blank banners | Summary bar highlights urgency (`N missing — M go live today`) |
| Checklist progress lost on refresh | **Neon PostgreSQL** persists checks and bugs per day |
| Team access control | Simple **admin login** (username/password session) |

## Tools

### Tool A — CDN Upload Checker (`/tool-a`)

Answers: *"What banners are missing CDN upload for the date or week I'm looking at?"*

- Default view: all rows where `CDN Uploaded = false` for the selected sub-week
- Date filter bar: each day of the sub-week; filters by active period overlap
- **Show all** — full-week view for the sub-week
- Toggle: "Show all (including uploaded)" greys out uploaded rows
- Grouped by placement: Overview → Shopping Mall → Slide Banner → Gacha → Background/Icon → Event → Esports → Craftland
- Row states:
  - **Asset not ready** (red): `Asset Done = 0`, `CDN Uploaded = 0`
  - **Ready to upload** (orange): `Asset Done = 1`, `CDN Uploaded = 0`
  - **Uploaded** (grey, hidden by default)
  - **Inconsistent** (yellow): `Asset Done = 0`, `CDN Uploaded = 1`
- **CDN health** per row: OK / unreachable / N/A (see [CDN health check](#cdn-health-check-flow))
- **Confirm as Bug** + **Copy Bug Report** for broken CDN links
- **Refresh sheet** re-fetches from Google (cache bust)

### Tool B — In-Game QA Checklist (`/tool-b`)

Answers: *"When I open the game right now, what should I see — and what should be gone?"*

- Day tab bar for each day in the selected sub-week (+ **Show all** for full week)
- Three groups per day:
  - **Should APPEAR today**: `Start Time` date = selected date
  - **Should DISAPPEAR today**: `End Time` date = selected date
  - **Still active**: `Start Time` < selected date < `End Time`
- Single-day banners appear in both APPEAR and DISAPPEAR with warning: *"Single-day — check morning AND evening"*
- Per-row checkbox with **persistent storage** (Neon) keyed by `week + date + row`
- **Still-active carry-over**: banners checked on a previous day in the same week auto-appear checked on later days
- **Show all** progress aggregates checks from every day in the week (unique rows checked / total week rows)
- Progress bar: `X / Y checked`
- Confirmed CDN bugs persisted per date
- Placement filter; optional Craftland section

### Tool C — Splash & Anno Upload Checker (`/tool-c`)

Answers: *"Which splash and announcement assets need CDN upload for this day?"*

- Data from In-Game Publishing workbook tab **`ID - Settings`** (`SPLASH_SHEET_ID`)
- Sections: **Ready to upload**, **Blocked**, **Needs review** (+ **Scheduled** when Show all)
- Grouped by asset type: Splash, Anno, or **Both** (same sheet row, both URLs missing)
- CDN health + confirm bug (reuses `/api/cdn-check`)
- Month + date scope from `/splash` entry

### Tool D — Splash & Anno In-Game QA (`/tool-d`)

Answers: *"What splash/anno should appear, disappear, or stay active today?"*

- Splash / Anno tabs; per-day date bar within the selected month
- Groups: **Should APPEAR**, **Should DISAPPEAR**, **Still active**
- Sort_ID badge with duplicate warnings for active cohort
- WIB hour display on schedule times
- Persistent checkboxes in Neon (`splash_checks`) with **carry-over** from earlier days in the month

### Routes

| Path | Purpose |
|---|---|
| `/` | Tool selector (Banner QA vs Splash & Anno) |
| `/banner` | Banner entry — week or date → Tool A / B |
| `/splash` | Splash entry — month + day → Tool C / D |
| `/tool-a`, `/tool-b`, `/tool-c`, `/tool-d` | Tools (deep links supported) |
| `/login` | Admin login |

### Admin login (`/login`)

When `ADMIN_PASSWORD` is set, all app routes and API endpoints (except health + auth) require a signed session cookie after login. Omit `ADMIN_PASSWORD` locally to disable auth during development.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (React SPA via Vite)                                   │
│  - Entry point, Tool A, Tool B, Login                           │
│  - CDN health: <img> + cached server HEAD fallback              │
│  - Zustand: week/date filters, checklist UI state               │
└──────────────────────────┬──────────────────────────────────────┘
                           │ /api/*  (credentials: cookie)
┌──────────────────────────▼──────────────────────────────────────┐
│  Node.js + Express + TypeScript (server/)                         │
│  - Admin session auth (signed cookie, optional)                   │
│  - Google Sheets API (service account, read-only)                 │
│  - Sheet parsing (tabs, sub-weeks, sections, dates)              │
│  - In-memory TTL cache (sheet data + CDN check results)             │
│  - CDN HEAD proxy (/api/cdn-check)                                │
│  - Checklist + bug persistence (/api/checklist/*)                 │
│  - Splash parser + cache (/api/splash/*)                          │
└──────────┬─────────────────────────────┬────────────────────────┘
           │                             │
           ▼                             ▼
  Google Sheets API v4          Neon PostgreSQL (optional)
  (banner + splash sheets)      (checklist_checks, confirmed_bugs,
                                 splash_checks, splash_bugs)
           │
           ▼
  dl.dir.freefiremobile.com (CDN asset host)
```

### Why a backend (not pure static HTML)

1. **Google service account auth** requires JWT exchange at `oauth2.googleapis.com/token` — blocked by browser CORS.
2. **Private keys must never ship to the client.**
3. **CDN health fallback** — server-side HEAD when `<img>` fails.
4. **Shared checklist state** — team progress stored in Neon, not per-browser memory.

---

## Infrastructure

| Layer | Technology | Role |
|---|---|---|
| Monorepo | npm workspaces | `client/` + `server/` |
| Frontend | Vite 6, React 18, TypeScript, Tailwind CSS 3 | SPA, routing, UI |
| State | Zustand | Week/date filters, checklist UI, auth session |
| Backend | Node.js, Express 4, TypeScript | API, parsing, auth, CDN proxy |
| Database | Neon PostgreSQL (`@neondatabase/serverless`) | Checklist + bug persistence |
| Auth | Signed HTTP-only cookies (`cookie-parser`) | Admin username/password sessions |
| Dates | Luxon (`Asia/Jakarta`, UTC+7) | All date math in WIB |
| Sheets | `googleapis` v4 | Read-only service account access |
| Cache | In-memory TTL | Sheet data (5 min); CDN checks (10 min) |
| Tests | Vitest (client + server) | Parsing, auth session, checklist repo |
| Dev | `concurrently` | Server :3001 + client :5173 with API proxy |
| Deploy | Render (recommended) | Free-tier Node web service; `render.yaml` included |

### API endpoints

**Public (no login when auth enabled)**

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Health check (`storage`, `auth` flags) |
| `GET` | `/api/auth/status` | Auth enabled + session state |
| `POST` | `/api/auth/login` | Admin login → session cookie |
| `POST` | `/api/auth/logout` | Clear session |

**Protected (require session when auth enabled)**

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/weeks` | Latest 4 sub-weeks |
| `GET` | `/api/week/:weekId` | Parsed rows for a sub-week, grouped by placement |
| `GET` | `/api/week-for-date/:date` | Auto-detect sub-week for an ISO date |
| `POST` | `/api/refresh` | Bust sheet cache and re-fetch |
| `GET` | `/api/cdn-check?url=` | Cached server-side HEAD check for CDN URL |
| `GET` | `/api/checklist/storage` | Storage backend (`neon` or `memory`) |
| `GET` | `/api/checklist/:weekId` | All checklist checks for a week (`byDate`) |
| `PUT` | `/api/checklist/:weekId/check` | Toggle one checklist item |
| `POST` | `/api/checklist/:weekId/check-batch` | Batch mark items checked (carry-over) |
| `GET` | `/api/checklist/:weekId/bugs?date=` | Confirmed bugs for a date |
| `POST` | `/api/checklist/:weekId/bugs` | Save a confirmed bug |
| `GET` | `/api/splash/config` | Splash sheet configured + storage backend |
| `GET` | `/api/splash/months` | Distinct months from splash sheet |
| `POST` | `/api/splash/refresh` | Bust splash cache and re-fetch |
| `GET` | `/api/splash/:monthId` | All records + calendar days for month |
| `GET` | `/api/splash/:monthId/upload?date=&showAll=` | Tool C sections for a date |
| `GET` | `/api/splash/:monthId/checklist?date=&assetType=` | Tool D groups for a date |
| `GET` | `/api/splash/:monthId/summary?date=` | Active / ready / blocked counts |
| `GET` | `/api/splash/:monthId/checks` | Splash checklist state (`byDate`) |
| `PUT` | `/api/splash/:monthId/check` | Toggle one splash checklist item |
| `POST` | `/api/splash/:monthId/check-batch` | Batch mark splash items checked |
| `GET` | `/api/splash/:monthId/bugs?date=` | Confirmed splash bugs for a date |
| `POST` | `/api/splash/:monthId/bugs` | Save a confirmed splash bug |

Splash routes return **503** with a clear message when `SPLASH_SHEET_ID` is unset (server still boots for Banner QA only).

---

## Repository layout

```
QA-Super-Tools/
├── package.json              # Root workspace, dev/build/test scripts
├── render.yaml               # Render Blueprint (optional)
├── .env.example              # Environment template
├── .env                      # Local config (gitignored)
├── credentials/              # Service account JSON (gitignored)
├── client/                   # React frontend
│   ├── src/
│   │   ├── pages/            # ToolSelector, BannerEntry, SplashEntry, ToolA–D, Login
│   │   ├── components/       # CdnHealthIndicator, splash/*, filters, tables
│   │   ├── api/              # client.ts, checklist.ts, splash.ts, auth.ts
│   │   ├── store/            # useAppStore, useAuthStore, useSplashStore
│   │   └── utils/            # date, checklist, CDN helpers
│   └── vite.config.ts        # Dev proxy → localhost:3001
└── server/                   # Express backend
    ├── src/
    │   ├── auth/             # Session token create/verify
    │   ├── db/               # Neon client + checklist repository
    │   ├── google/           # Sheets + splashSheetsClient
    │   ├── middleware/       # requireAuth
    │   ├── parsing/          # Banner + splash parsers, date/CDN utils
    │   ├── routes/           # api.ts, auth.ts, checklist.ts, splashApi.ts
    │   ├── services/         # dataService + splashService (month cache)
    │   ├── scripts/          # testDb.ts, migrateSplash tables helper
    │   └── fixtures/         # Test fixtures from real sheet structure
    └── vitest.config.ts
```

---

## Google Cloud & sheet setup (one-time)

### 1. Create a service account

1. Open [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Enable **Google Sheets API**
4. IAM → Service Accounts → Create
5. Download the JSON key → save as `credentials/service-account.json`

### 2. Share the master sheet

1. Open `[FFID] Weekly CDN Checklist` in Google Sheets
2. Share with the service account email (e.g. `ffid-qa@project.iam.gserviceaccount.com`) as **Viewer**
3. Copy the Sheet ID from the URL: `https://docs.google.com/spreadsheets/d/<SHEET_ID>/edit`

### 2b. Share the In-Game Publishing sheet (Tools C/D)

1. Open the In-Game Publishing workbook (tab **`ID - Settings`**)
2. Share with the same service account as **Viewer**
3. Set `SPLASH_SHEET_ID` in `.env` / Render to that workbook's Sheet ID
4. Splash DB tables (`splash_checks`, `splash_bugs`) are created automatically on server boot when `DATABASE_URL` is set

### 3. Neon database (checklist persistence)

1. Create a free project at [neon.tech](https://neon.tech)
2. Copy the **pooled** connection string
3. Set `DATABASE_URL` in `.env` — tables are created automatically on server start

Without `DATABASE_URL`, checklist state uses in-memory storage (resets on server restart).

### 4. Configure environment

```bash
cp .env.example .env
```

See [Environment variables reference](#environment-variables-reference) for all options.

**Minimum local `.env`:**

```env
SHEET_ID=your_sheet_id_here
GOOGLE_SERVICE_ACCOUNT_KEY=./credentials/service-account.json
CDN_BASE_URL=https://dl.dir.freefiremobile.com/common/

# Optional locally — enables login + persistent checklist
DATABASE_URL=postgresql://...
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-password
SESSION_SECRET=at-least-32-random-characters
```

Generate `SESSION_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Test Neon connection:

```bash
cd server && npx tsx src/scripts/testDb.ts
```

---

## How parsing works

The real master sheet structure differs from a simplified 6-column model. The parser targets the actual `[FFID] Weekly CDN Checklist` layout.

### Tab-level: finding recent weeks

- The workbook has **137 tabs**, not in chronological order
- Many tabs are **not week tabs** (`Master Copy disini`, `Patch Note OB53`, `Dummy buat upload bot`, etc.) — these are filtered out
- Valid tab names are parsed for date ranges, supporting:
  - En-dash `–` and hyphen `-`
  - Optional 2-digit year (`3 – 16 Jun 26`)
  - Prefixes: `Biweekly`, `Weekly`, `EX Weekly`
  - Annotations: `(Before Patch)`, `(After Patch)`, `(lebaran)`
  - English + Indonesian months (`Des`, `Mei`)
  - Cross-month ranges (`29 Nov - 05 Des`, `Biweekly 24 Jan – 06 Feb`)

Tabs are sorted by parsed **end date** descending; the most recent tabs are fetched (up to 6) to ensure ≥4 sub-weeks are available.

### Sub-week model (critical)

A single tab can contain **multiple sub-weeks**. Example: tab `3 – 16 Jun 26` contains:

```
Overview          | 3 - 9 Jun     ← sub-week block 1
  [header row]
  [data rows...]
Overview          | 10 - 16 Jun   ← sub-week block 2
  [header row]
  [data rows...]
```

The user-facing "week" is the **sub-block** (col B label), not the whole tab. The API exposes the latest 4 distinct sub-week ranges.

Sub-week labels without a year inherit the year from the containing tab name.

### Section detection

A section starts when:
- Col A matches a known section name (via alias map)
- Col B is a week-range label (e.g. `10 - 16 Jun`)

The **next row** is the column header row. Columns are mapped **by header name** (not fixed letters).

Data rows follow until the next section header.

### Section alias map

| Canonical placement | Sheet aliases |
|---|---|
| Overview | `Overview` |
| Shopping Mall | `NEW Shopping mall`, `Shop` |
| Slide Banner | `Slide banner`, `Slide Banner` |
| Gacha / Luck Royale | `Gacha`, `Luck Royale` |
| Background / Icon | `Icon/Loading Screen/Background`, `Background`, `Icon` |
| Event | `Event`, `Events` |
| Esports | `Esports` |
| Craftland | `CRAFTLAND` |

### CDN link normalization

| Input | Result |
|---|---|
| `https://dl.dir.freefiremobile.com/common/OB53/ID/...` | Used as-is |
| `OB53/ID/20260610_foo/overview.jpg` | Prepended with `CDN_BASE_URL` |
| `embed` | `null` (N/A for health check) |
| `Rekomendasi Official` | `null` (Craftland category, not a URL) |

OB version (e.g. `OB53`) lives inside the relative path; the base URL is constant.

### Date handling

All dates are interpreted in **WIB (UTC+7, `Asia/Jakarta`)** via Luxon.

Excel serial numbers (e.g. `46176.416666666664`) are converted from the Excel epoch (1899-12-30).

---

## CDN health check flow

For every row with a valid CDN URL:

1. **Rewrite** `.ff_extend` → `.jpg` for the health check URL (game uses `.ff_extend`; CDN serves `.jpg`)
2. **Client cache** — skip re-check if result cached in browser (10 min)
3. **Primary:** client-side `<img>` `onload` / `onerror`
4. **Fallback:** `GET /api/cdn-check?url=...` — server cached HEAD request
5. **No URL** → grey "N/A"
6. **Timeout** → 5s → broken

Re-checks do **not** re-fire on unrelated UI re-renders (stable effect dependencies + caching).

Broken links are **not** auto-reported. User clicks **"Confirm as Bug"** → tally increments → **"Copy Bug Report"** copies plain text for Slack/bug tracker.

---

## Checklist persistence

Stored in Neon when `DATABASE_URL` is set:

| Table | Key | Purpose |
|---|---|---|
| `checklist_checks` | `week_id` + `check_date` + `row_id` | Checkbox state per day |
| `confirmed_bugs` | `week_id` + `check_date` + `row_id` | Confirmed CDN bugs |

**Carry-over:** On day N, rows in **Still active** that were checked on any earlier day in the same week appear pre-checked (saved to day N automatically).

**Show all:** Progress unions all per-day checks across the week vs total unique rows in the week.

---

## Data flow walkthrough

### Weekly CDN audit (Tool A)

```
User → /tool-a
  → GET /api/week/:weekId
  → Server: sheet cache → Google Sheets API
  → Parse grid → filter sub-week rows
  → CDN health check per row (cached)
  → User clicks Refresh → POST /api/refresh
```

### Daily in-game QA (Tool B)

```
User → /tool-b → pick date
  → GET /api/checklist/:weekId (load saved checks)
  → GET /api/week/:weekId
  → Group APPEAR / DISAPPEAR / Still active
  → Carry-over still-active from previous days
  → Toggle checkbox → PUT /api/checklist/:weekId/check
  → Confirm bug → POST /api/checklist/:weekId/bugs
```

---

## Local development

### Prerequisites

- Node.js 18+
- Google service account with Viewer access to the sheet
- Neon `DATABASE_URL` (optional but recommended)
- `ADMIN_PASSWORD` + `SESSION_SECRET` (optional locally; required in production)

### Run

```bash
npm install
cp .env.example .env
# Edit .env

npm run dev
```

- Frontend: http://localhost:5173 (proxies `/api` → :3001)
- Backend: http://localhost:3001

### Production build

```bash
npm run build    # builds client + server
npm start        # serves API + static client from server
```

### Deploy on Render (free tier)

1. Connect the GitHub repo as a **Web Service** (Node), region **Singapore** (near Neon SEA).
2. **Build command:**

```bash
npm install --include=dev && npm run build && mkdir -p credentials && printf '%s' "$GOOGLE_SERVICE_ACCOUNT_JSON" > credentials/service-account.json
```

3. **Start command:** `npm start`
4. **Required env vars:** `SHEET_ID`, `DATABASE_URL`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_SERVICE_ACCOUNT_KEY=./credentials/service-account.json`, `ADMIN_PASSWORD`, `SESSION_SECRET` (min 32 chars), `NODE_ENV=production`
5. Or use the included `render.yaml` Blueprint and set secret env vars in the dashboard.

Render sets `NODE_ENV=production` during build, which skips devDependencies by default — `--include=dev` fixes that.

**Free tier note:** service sleeps after ~15 min idle; first request after sleep may take 30–60s.

### Tests

```bash
npm test    # server + client unit tests
```

---

## Assumptions & known limitations

| Topic | Decision |
|---|---|
| CDN base URL | Constant `https://dl.dir.freefiremobile.com/common/`; OB version is in the path |
| "Latest 4 weeks" | 4 most-recent distinct **sub-week** ranges across recent tabs |
| Non-week tabs | Ignored (`Patch Note`, `Master Copy`, etc.) |
| Cross-week carry-over | Tool B shows only the selected sub-week's rows |
| Craftland | Own placement; non-URL rows skip CDN health check |
| Checklist storage | Neon when configured; in-memory fallback otherwise |
| Write-back to sheet | Not supported (read-only) |
| Authentication | Single shared admin account (no Google Sign-In yet) |
| Multi-user audit | No per-user tracking on checklist actions yet |

---

## Phase 2 roadmap

- ~~Persistent checklist state~~ ✅ Neon PostgreSQL
- ~~CDN check result caching~~ ✅ Client + server TTL cache
- ~~Simple admin auth~~ ✅ Session cookie login
- Multi-user / per-QA audit trail
- Google Sign-In or team SSO
- Write-back to Google Sheets (requires user OAuth)
- Slack daily digest
- Mobile-optimised layout
- Historical week comparison
- Expanded week range beyond latest 4

---

## Environment variables reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `SHEET_ID` | Yes | — | Google Sheet ID from URL |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Yes | — | Path to service account JSON file |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Deploy | — | Full JSON body (Render build writes to file) |
| `CDN_BASE_URL` | No | `https://dl.dir.freefiremobile.com/common/` | CDN prefix for relative paths |
| `DATABASE_URL` | No* | — | Neon PostgreSQL connection string |
| `ADMIN_USERNAME` | No | `admin` | Admin login username |
| `ADMIN_PASSWORD` | Prod | — | Admin password; enables auth when set |
| `SESSION_SECRET` | Prod | — | Cookie signing secret (min 32 chars) |
| `PORT` | No | `3001` | Server port (Render sets automatically) |
| `CACHE_TTL_MS` | No | `300000` | Banner sheet data cache TTL (5 min) |
| `CDN_CHECK_CACHE_TTL_MS` | No | `600000` | CDN health check cache TTL (10 min) |
| `SPLASH_SHEET_ID` | No | — | In-Game Publishing workbook ID (`ID - Settings` tab) |
| `SPLASH_CACHE_TTL_MS` | No | `300000` | Splash sheet cache TTL (5 min) |
| `NODE_ENV` | No | `development` | `production` enables static file serving + requires auth secrets |

\*Required for persistent checklist in production; strongly recommended for team use.

---

*FFID LiveOps QA Tools — built for Free Fire Indonesia LiveOps QA*
