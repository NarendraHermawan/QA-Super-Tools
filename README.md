# FFID Weekly Banner QA Tools

Web application for the Free Fire Indonesia LiveOps QA team to automate weekly banner CDN upload checks and in-game QA checklists. The tool reads directly from the master Google Sheet (`[FFID] Weekly CDN Checklist`) and surfaces what needs CDN upload, what should appear/disappear in-game each day, and whether CDN links resolve.

## What this solves

| Pain point | How this tool helps |
|---|---|
| 100+ sheet tabs, hard to find current week | Auto-detects latest 4 **sub-weeks** from recent tabs |
| No single "missing CDN" view | **Tool A** lists all `CDN Uploaded = 0` rows, grouped by placement |
| No date-aware in-game QA view | **Tool B** shows APPEAR / DISAPPEAR / Still active per day |
| Manual CDN link verification | Live CDN health check per row (client `<img>` + server HEAD fallback) |
| Missed uploads → blank banners | Summary bar highlights urgency (`N missing — M go live today`) |

## Tools

### Tool A — CDN Upload Checker (`/tool-a`)

Answers: *"What banners are missing CDN upload for the date or week I'm looking at?"*

- Default view: all rows where `CDN Uploaded = false` for the selected sub-week
- Date filter bar: each day of the sub-week; filters by active period overlap
- Toggle: "Show all (including uploaded)" greys out uploaded rows
- Grouped by placement: Overview → Shopping Mall → Slide Banner → Gacha → Background/Icon → Event → Esports → Craftland
- Row states:
  - **Asset not ready** (red): `Asset Done = 0`, `CDN Uploaded = 0`
  - **Ready to upload** (orange): `Asset Done = 1`, `CDN Uploaded = 0`
  - **Uploaded** (grey, hidden by default)
  - **Inconsistent** (yellow): `Asset Done = 0`, `CDN Uploaded = 1`
- **Refresh** re-fetches the sheet (cache bust)

### Tool B — In-Game QA Checklist (`/tool-b`)

Answers: *"When I open the game right now, what should I see — and what should be gone?"*

- Day tab bar for each day in the selected sub-week
- Three groups per day:
  - **Should APPEAR today**: `Start Time` date = selected date
  - **Should DISAPPEAR today**: `End Time` date = selected date
  - **Still active**: `Start Time` < selected date < `End Time`
- Single-day banners appear in both APPEAR and DISAPPEAR with warning: *"Single-day — check morning AND evening"*
- Per-row checkbox (in-memory; resets on page refresh)
- Progress bar: `X / Y checked`
- Placement filter persists across day navigation

### Shared entry point (`/`)

**Mode 1 — Choose a week:** dropdown of latest 4 sub-weeks (most recent first)

**Mode 2 — Choose a date:** date-picker auto-detects the covering sub-week; warns if outside the 4-week window

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (React SPA via Vite)                               │
│  - Entry point, Tool A, Tool B                              │
│  - CDN health: <img> onload/onerror first                     │
│  - Zustand for session state (checkboxes, bugs)             │
└──────────────────────────┬──────────────────────────────────┘
                           │ /api/*
┌──────────────────────────▼──────────────────────────────────┐
│  Node.js + Express + TypeScript (server/)                   │
│  - Google Sheets API (service account, read-only)           │
│  - Sheet parsing (tab names, sub-weeks, sections, dates)    │
│  - In-memory TTL cache                                      │
│  - CDN HEAD proxy (/api/cdn-check)                          │
└──────────┬───────────────────────────────┬──────────────────┘
           │                               │
           ▼                               ▼
  Google Sheets API v4          dl.dir.freefiremobile.com
  (master checklist sheet)      (CDN asset host)
```

### Why a backend (not pure static HTML)

The PRD originally suggested opening `index.html` directly with a service account key in `config.js`. That approach does **not** work in practice:

1. **Google service account auth** requires signing a JWT and exchanging it at `oauth2.googleapis.com/token`. That endpoint does not allow browser CORS requests.
2. **Private keys must never ship to the client.** A backend holds the service account JSON securely.
3. **CDN CORS fallback** — if `<img>` cross-origin loads fail, a server-side HEAD request is needed.

The frontend is therefore a thin rendering layer; all parsing and secrets live in the backend.

---

## Infrastructure

| Layer | Technology | Role |
|---|---|---|
| Monorepo | npm workspaces | `client/` + `server/` |
| Frontend | Vite 6, React 18, TypeScript, Tailwind CSS 3 | SPA, routing, UI |
| State | Zustand | Selected week/date, filters, checkboxes, confirmed bugs |
| Backend | Node.js, Express 4, TypeScript | API, parsing, auth, CDN proxy |
| Dates | Luxon (`Asia/Jakarta`, UTC+7) | All date math in WIB |
| Sheets | `googleapis` v4 | Read-only service account access |
| Cache | In-memory TTL (default 5 min) | Avoid re-fetching 137 tabs |
| Tests | Vitest | Parsing unit tests with real sheet fixtures |
| Dev | `concurrently` | Runs server :3001 + client :5173 with API proxy |

### API endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/weeks` | Latest 4 sub-weeks |
| `GET` | `/api/week/:weekId` | Parsed rows for a sub-week, grouped by placement |
| `GET` | `/api/week-for-date/:date` | Auto-detect sub-week for an ISO date |
| `POST` | `/api/refresh` | Bust cache and re-fetch sheet |
| `GET` | `/api/cdn-check?url=` | Server-side HEAD check for CDN URL |

---

## Repository layout

```
QA Super Tool/
├── package.json          # Root workspace, dev/build scripts
├── .env.example          # Environment template
├── .env                  # Local config (gitignored)
├── credentials/          # Service account JSON (gitignored)
├── README.md
├── client/               # React frontend
│   ├── src/
│   │   ├── pages/        # EntryPoint, ToolA, ToolB
│   │   ├── components/   # HeaderBar, CdnHealthIndicator, BugControls, filters
│   │   ├── api/          # Typed fetch wrappers
│   │   ├── store/        # Zustand app state
│   │   └── utils/        # Date + checklist helpers
│   └── vite.config.ts    # Dev proxy → localhost:3001
└── server/               # Express backend
    ├── src/
    │   ├── google/       # Sheets client
    │   ├── parsing/      # Tab/sub-week/section/date/CDN parsers
    │   ├── services/     # Data orchestration + cache
    │   ├── routes/       # API routes
    │   └── fixtures/     # Test fixtures from real sheet structure
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

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
SHEET_ID=your_sheet_id_here
GOOGLE_SERVICE_ACCOUNT_KEY=./credentials/service-account.json
CDN_BASE_URL=https://dl.dir.freefiremobile.com/common/
PORT=3001
CACHE_TTL_MS=300000
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
NEW Shopping mall | 3 - 9 Jun
  ...
NEW Shopping mall | 10 - 16 Jun
  ...
```

The user-facing "week" is the **sub-block** (col B label), not the whole tab. The API exposes the latest 4 distinct sub-week ranges.

Sub-week labels without a year inherit the year from the containing tab name.

### Section detection

A section starts when:
- Col A matches a known section name (via alias map)
- Col B is a week-range label (e.g. `10 - 16 Jun`)

The **next row** is the column header row. Columns are mapped **by header name** (not fixed letters), because the sheet has extra columns (`Gopos`, `Subgopos`, `QA`, `Tab`, `Asset`, `Notion Link`, `Sort`, etc.).

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

### Row fields

| Field | Source | Notes |
|---|---|---|
| `Nama tab` | Col by header | Empty for Gacha sub-assets → fall back to CDN filename |
| `CDN Link` | Col by header | May be absolute URL, relative path, `embed`, or category label |
| `Start Time` / `End Time` | Col by header | ISO string **or** Excel serial number |
| `Asset Done` / `CDN Uploaded` | Col by header | `1`/`0` (not `TRUE`/`FALSE`) |

### Date handling

All dates are interpreted in **WIB (UTC+7, `Asia/Jakarta`)** via Luxon. The tool does not rely on the browser's local timezone for business logic.

Excel serial numbers (e.g. `46176.416666666664`) are converted from the Excel epoch (1899-12-30).

### CDN link normalization

| Input | Result |
|---|---|
| `https://dl.dir.freefiremobile.com/common/OB53/ID/...` | Used as-is |
| `OB53/ID/20260610_foo/overview.jpg` | Prepended with `CDN_BASE_URL` |
| `embed` | `null` (N/A for health check) |
| `Rekomendasi Official` | `null` (Craftland category, not a URL) |

OB version (e.g. `OB53`) lives inside the relative path; the base URL is constant.

---

## CDN health check flow

For every row with a valid CDN URL:

1. **Primary:** client-side `<img>` element with `onload` / `onerror`
   - Loads OK → green dot
   - Error → fall back to step 2
2. **Fallback:** `GET /api/cdn-check?url=...` — server sends HEAD request
   - 2xx → ok
   - Otherwise → broken (amber dot)
3. **No URL** → grey "N/A"
4. **Checking** → grey spinner (5s timeout → broken)

Broken links are **not** auto-reported. User clicks **"Confirm as Bug"** → tally increments → **"Copy Bug Report"** copies plain text for Slack/bug tracker.

---

## Data flow walkthrough

### Weekly CDN audit (Tool A)

```
User opens / → selects sub-week "10 - 16 Jun 26" → Tool A
  → GET /api/week/:weekId
  → Server: cache hit/miss → fetch recent tabs from Sheets API
  → Parse grid → filter sub-week "10 - 16 Jun" rows
  → Return grouped sections
  → Client: filter CDN Uploaded = false, group by placement
  → CDN health check per row
  → User uploads assets, updates sheet, clicks Refresh
  → POST /api/refresh → cache bust → re-fetch
```

### Daily in-game QA (Tool B)

```
User opens / → picks today's date → auto-detect sub-week → Tool B
  → GET /api/week-for-date/2026-06-10 → matching sub-week
  → GET /api/week/:weekId → all rows for sub-week
  → Client: group into APPEAR / DISAPPEAR / Still active for selected day
  → User checks in-game, ticks checkboxes
  → Confirms broken CDN links as bugs → Copy Bug Report
```

---

## Local development

### Prerequisites

- Node.js 18+
- Google service account with Viewer access to the sheet

### Run

```bash
npm install
cp .env.example .env
# Edit .env with your SHEET_ID and service account path

npm run dev
```

- Frontend: http://localhost:5173 (proxies `/api` → :3001)
- Backend: http://localhost:3001

### Production build

```bash
npm run build    # builds client + server
npm start        # serves API + static client from server
```

In production, Express serves `client/dist` as static files and falls back to `index.html` for client-side routing.

### Tests

```bash
npm test
```

Parsing tests use fixtures modeled on the real `3 – 16 Jun 26` tab structure.

---

## Assumptions & known limitations (v1.0)

| Topic | Decision |
|---|---|
| CDN base URL | Constant `https://dl.dir.freefiremobile.com/common/`; OB version is in the path |
| "Latest 4 weeks" | 4 most-recent distinct **sub-week** ranges across recent tabs |
| Non-week tabs | Ignored (`Patch Note`, `Master Copy`, etc.) |
| Cross-week carry-over | Tool B shows only the selected sub-week's rows; banners spanning into the next week may not appear on later dates until that sub-week is selected |
| Craftland | Shown as its own placement; non-URL rows skip CDN health check |
| Checkbox / bug state | In-memory only; resets on page refresh |
| Write-back to sheet | Not supported (read-only) |
| Authentication | None in v1.0 (single-user local tool) |

### PRD open questions

1. **CORS on CDN domain** — validated at runtime; server HEAD fallback handles blocks
2. **CDN base URL per OB patch** — assumed constant; configurable via `CDN_BASE_URL`
3. **Biweekly tabs in 4-week window** — biweekly tabs yield 2 sub-weeks each; latest 4 sub-weeks are selected by date
4. **Sheet sharing with service account** — requires sheet owner to invite service account as Viewer
5. **Overlapping banners across week tabs** — v1.0 limitation documented above; Phase 2 can merge adjacent cached weeks

---

## Phase 2 roadmap

- Persistent checkbox state (localStorage or database)
- Multi-user sharing via hosted deployment
- Write-back to Google Sheets (requires user OAuth)
- Slack daily digest
- Mobile-optimised layout
- Dedicated CDN proxy with result caching
- Historical week comparison
- Expanded week range beyond latest 4

---

## Environment variables reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `SHEET_ID` | Yes | — | Google Sheet ID from URL |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Yes | — | Path to service account JSON |
| `CDN_BASE_URL` | No | `https://dl.dir.freefiremobile.com/common/` | CDN prefix for relative paths |
| `PORT` | No | `3001` | Server port |
| `CACHE_TTL_MS` | No | `300000` | Sheet data cache TTL (5 min) |
| `NODE_ENV` | No | `development` | `production` enables static file serving |

---

*FFID Weekly Banner QA Tools v1.0 — built for Free Fire Indonesia LiveOps QA*
