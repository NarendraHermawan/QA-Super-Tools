# FFID LiveOps QA Tools

Web application for the Free Fire Indonesia LiveOps QA team to automate weekly **banner** and **Splash & Anno** CDN upload checks, bulk CDN uploads (Tool F), and in-game QA checklists. The tool reads from the master Google Sheet (`[FFID] Weekly CDN Checklist`) and, optionally, the Splash workbook (`ID - Settings` tab). It surfaces what needs CDN upload, what should appear/disappear in-game each day, whether CDN links resolve, and can automate uploads via CDN REST API (Tool F) or Playwright (Tool E PoC).

## What this solves

| Pain point | How this tool helps |
|---|---|
| 100+ sheet tabs, hard to find current week | Auto-detects latest 4 **sub-weeks** from recent tabs |
| No single "missing CDN" view | **Tool A** lists all `CDN Uploaded = 0` rows, grouped by placement |
| No date-aware in-game QA view | **Tool B** shows APPEAR / DISAPPEAR / Still active per day |
| Manual CDN link verification | Live CDN health check per row (cached; `.ff_extend` → `.jpg`) |
| Missed uploads → blank banners | Summary bar highlights urgency (`N missing — M go live today`) |
| Hard to see unique events in a long missing list | **Summarize** modal — unique event names with asset tags, copy-friendly report |
| Sheet `CDN Uploaded` lags behind real uploads | **Mark as uploaded** QA overrides (persisted per week in Neon) |
| Same event name on multiple CDN assets (merged cells) | **Asset tags** (Mall small, Lobby BG, etc.) derived from CDN filename |
| Checklist progress lost on refresh | **Neon PostgreSQL** persists checks and upload overrides per week |
| Team access control | Simple **admin login** (username/password session) |
| Splash/Anno tracked in a separate workbook | **Tool C / D** — same sub-week UX as Banner; reads `ID - Settings` (`SPLASH_SHEET_ID`) |
| Splash CDN in cols O/Q dropped by sparse sheet rows | Dedicated **O + Q column fetch** merged into each row (Google trims trailing empties in `B:Z`) |
| Manual CDN Ops upload for Splash/Anno | **Tool E** — drop file → Playwright upload (today); CDN REST API + auto-fetch planned (no office WiFi) |
| Manual banner bulk upload from Notion/Drive | **Tool F** — one-click Python run → CDN REST API → writes col L |

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
- **Asset tags** under event names when one sheet name maps to multiple CDN files (merged cells)
- **CDN health** per row: spinner while checking → OK / unreachable / N/A (see [CDN health check](#cdn-health-check-flow))
- **Open CDN upload** — opens the event folder on `cdnops.jingle.cn` (built client-side from CDN path)
- **Mark as uploaded** / **Revert to unuploaded** — QA overrides on top of sheet `CDN Uploaded` (persisted; see [QA upload overrides](#qa-upload-overrides))
- **Summarize** — modal listing **unique event names** for the full sub-week; filter **Not uploaded** (default) or **Uploaded**; optional **Include Craftland**; **Copy list** as formatted report (see [Summarize](#summarize-unique-events))
- **Refresh sheet** — re-fetches Google Sheet, clears CDN health caches, and re-runs all health checks
- Stat cards: missing CDN, go-live count, **QA marked uploaded**, rows shown

### Tool B — In-Game QA Checklist (`/tool-b`)

Answers: *"When I open the game right now, what should I see — and what should be gone?"*

- Day tab bar for each day in the selected sub-week (+ **Show all** for full week)
- Three groups per day:
  - **Should APPEAR today**: `Start Time` date = selected date
  - **Should DISAPPEAR today**: `End Time` date = selected date
  - **Still active**: `Start Time` < selected date < `End Time`
- Single-day banners appear in both APPEAR and DISAPPEAR with warning: *"Single-day — check morning AND evening"*
- Per-row checkbox with **persistent storage** (Neon) keyed by `week + date + row`; **writes col M (QA)** on the Google Sheet when toggled (requires service account **Editor**)
- **Still-active carry-over**: banners checked on a previous day in the same week auto-appear checked on later days; **unchecking** on a later day sticks (won’t re-check from carry-over)
- **Show all** progress aggregates checks from every day in the week (unique rows checked / total week rows)
- Progress bar: `X / Y checked`
- **Asset tags** on rows that share an event name (same as Tool A)
- **Open CDN upload** per row
- Placement filter; optional Craftland section

### Tool F — Banner Auto Upload (`/tool-f`)

Answers: *"Bulk-upload all eligible banner rows for the sub-week I selected."*

- **Same sub-week picker as Tool A/B** — pick a week on `/banner`, then **Auto Upload**; only rows in that sub-week block are processed (section headers in col B, e.g. `10 - 16 Jun` inside tab `3 - 16 Jun 26`)
- **Worker + Python** — spawns [`scripts/cdn_bot.py`](scripts/cdn_bot.py) (CDN REST API, not Playwright)
- Opens the **checklist tab** for the selected sub-week; skips rows where col **L** (CDN Uploaded) is already checked
- Fetches assets from **col J** (Notion/Drive), matches by filename then dimensions, uploads to per-event CDN folders from col **B**
- Writes **col L = TRUE** on success; SeaTalk summary from the script
- UI: structured run report (uploaded / skipped / failed), **Run upload**, **Cancel**, previous runs from Neon (`tool_f_jobs` / `tool_f_log`)
- Tab names and week labels use **normalized dashes** in the UI (en-dash/em-dash from Sheets → `-`)
- Requires `WORKER_URL`, `CDN_API_TOKEN`, `NOTION_API_TOKEN` on the worker; service account needs **Editor** on the checklist for write-back
- Main server enforces login; worker (`:3002`) is localhost-only and does not require a separate session
- Coexists with **Tool E** (Playwright splash upload) on the same worker container
- **No office WiFi required** — uses `cdnops.jingle.cn/api/public` (same CDN REST API as the planned Tool E rewrite)
- Check reachability anytime: `GET /api/test-cdn-connectivity` (see [CDN API connectivity](#cdn-api-connectivity-phase-0))

### Tool C — Splash & Anno Upload Checker (`/tool-c`)

Answers: *"What Splash and Anno entries this sub-week still need action before they go live?"*

- Reads from **`ID - Settings`** in a separate workbook (`SPLASH_SHEET_ID`)
- **Same sub-week scope as Banner tools** (latest 4 sub-weeks from the CDN checklist)
- Week + day filter from `/splash` entry point; overlapping entries stay visible when you pick a day
- **Placement filter:** **Splash** / **Announcement** chips (same pattern as Tool A placement filter)
- Table columns: **Event** (name + Splash/Anno tag), **Status**, **CDN path** (col **O** = Anno, col **Q** = Splash), **GoPos / Sub GoPos**, **Active period**, **CDN health**
- Status labels: **Asset not ready**, **uploaded**, **Scheduled**, **DONE**
- Sections: **Ready to upload** (`uploaded` / Trello done), **Asset Not Ready** (`Asset not ready`), **Needs review** (unknown / `Scheduled` without URL)
- **Mark as uploaded** available on both Ready to upload and Asset Not Ready rows
- **Show all** reveals uploaded `Scheduled` / `DONE` rows (greyed out) — `Scheduled` rows with a CDN URL are treated as uploaded and hidden by default
- **GoPos autofill** — exact-name lookup from latest 4 banner weeks (Gacha / Luck Royale excluded); requires ≥1 matching banner row (read-only suggestions)
- **Summarize** — same UX as Tool A: unique events for the full sub-week, **Not uploaded** / **Uploaded** filter, **Copy list** grouped by Splash / Announcement
- **Open CDN upload**, **Mark as uploaded** overrides (`splash_upload_overrides` in Neon)
- **Refresh sheet** re-fetches splash + banner week cache and clears CDN health cache

### Tool D — Splash & Anno In-Game QA (`/tool-d`)

Answers: *"What Splash and Anno banners should appear, disappear, or stay active today — in Sort_ID order?"*

- **Splash** / **Anno** tabs — one sheet row can produce two records; **Splash** CDN comes from col **Q**, **Anno** from col **O**
- APPEAR / DISAPPEAR / Still active groups per day (same overlap logic as Tool B)
- Sort_ID ordering within simultaneously-active cohort; duplicate Sort_ID warning
- WIB clock + “goes live soon” flags; GoPos display with sheet / Suggested / Not found
- Checklist persistence in `splash_checks` (Neon) with still-active carry-over

### Tool E — Splash & Anno Auto Upload (`/tool-e`)

Answers: *"I downloaded the asset from Notion — upload it to CDN Ops and give me the CDN path."*

**Today (Playwright PoC):**

- **Local Docker / dev worker only** — not available on Render (proxy returns 503 without worker)
- Reads the same splash week cache as Tool C/D; shows rows where **col Z (Notion/Trello URL)** is filled
- Per-row: **Open Notion**, **GoPos / Sub GoPos** (with **Copy** for suggested values), **CDN health**, drop zone
- Drop or browse an image → worker renames to 10-char token → **Playwright** uploads via the CDN Ops **web portal** (`cdnops.jingle.cn/upload/…`) → displays full CDN URL + **Copy**
- **Retry** clears the row (confirmation dialog) and deletes the Neon upload record
- Header actions (same pattern as Tool C): **Refresh sheet**, **Open sheet** (splash workbook), **Open CDN folder**
- Upload history persisted in `auto_upload_log` (Neon); survives page refresh
- Requires **office WiFi** (or VPN) for the CDN Ops **browser portal**, plus **CDN OPS login** — see [Tool E setup](#tool-e-auto-upload-local-only)

**Planned next update:** replace Playwright with the **CDN REST API** (same 3-step HTTP flow as Tool F), add Notion/Drive auto-fetch, and sheet write-back (cols O/Q, Status → `TRELLO DONE`). Phase 0 connectivity test confirmed **Scenario A** — the REST API is reachable from **personal hotspot**, so the new Tool E will **not** require office WiFi (see below).

### Landing & entry points

| Route | Purpose |
|---|---|
| `/` | Tool selector — Banner QA vs Splash & Anno QA |
| `/banner` | Banner scope — week or date, then Tool A / B / F |
| `/tool-f` | Banner bulk auto upload (selected sub-week) |
| `/splash` | Splash scope — same sub-week picker as Banner, then Tool C / D / E |

**Banner (`/banner`)** and **Splash (`/splash`)** both use the same sub-week list (e.g. `27 May-2 Jun`, `3-9 Jun`, `10-16 Jun`, `17-24 Jun`) plus optional date-picker. Sheet tab names may use en-dashes in Google Sheets; the UI normalizes them to `-` for display. Each entry page has a **Refresh weeks** button that busts the server cache and reloads the dropdown (use this after a new sheet tab is added — **Refresh sheet** inside Tool A/C only reloads row data for the already-selected week).

`SPLASH_SHEET_ID` is **optional** — if unset, splash API returns `503` and banner tools are unaffected.

### Admin login (`/login`)

When `ADMIN_PASSWORD` is set, all app routes and API endpoints (except health + auth) require a signed session cookie after login. Omit `ADMIN_PASSWORD` locally to disable auth during development.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (React SPA via Vite)  — http://localhost:5173 (dev)    │
│  - Banner: Tool A / B / F    Splash: Tool C / D / E             │
│  - CDN health, Summarize, upload overrides, Tool F SSE log      │
└──────────────────────────┬──────────────────────────────────────┘
                           │ /api/*  (session cookie)
┌──────────────────────────▼──────────────────────────────────────┐
│  server/ (Express)  — port 3001                                 │
│  - Google Sheets read (+ write scope for Tool F sheet updates)  │
│  - GET /api/test-cdn-connectivity (Phase 0 Scenario A/B)        │
│  - Proxies when WORKER_URL set:                                 │
│      /api/auto-upload/*  → Tool E (Playwright)                  │
│      /api/tool-f/*       → Tool F (Python bulk upload)          │
│  - Without WORKER_URL: auto-upload + tool-f return 503          │
└──────────┬─────────────────────────────┬────────────────────────┘
           │ WORKER_URL                  │
           ▼                             ▼
┌──────────────────────────┐   Google Sheets API v4 + Neon PG
│  worker/ (port 3002)     │   - checklist_checks, *_overrides
│  - Tool E: Playwright    │   - auto_upload_log (Tool E)
│  - Tool F: python3       │   - tool_f_jobs, tool_f_log (Tool F)
│    scripts/cdn_bot.py    │
│  - CDN REST API (Tool F) │   cdnops.jingle.cn/api/public
│  - cdnops portal (Tool E)│   dl.dir.freefiremobile.com (health)
└──────────────────────────┘
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
| Database | Neon PostgreSQL (`@neondatabase/serverless`) | Checklist + QA upload overrides |
| Auth | Signed HTTP-only cookies (`cookie-parser`) | Admin username/password sessions |
| Dates | Luxon (`Asia/Jakarta`, UTC+7) | All date math in WIB |
| Sheets | `googleapis` v4 | Read-only service account access |
| Cache | In-memory TTL | Sheet data (5 min); CDN checks (10 min) |
| Tests | Vitest (client + server) | Parsing, event summary, auth session, checklist + override repos |
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
| `POST` | `/api/refresh` | Bust sheet cache, clear CDN check cache, re-fetch |
| `GET` | `/api/cdn-check?url=` | Cached server-side HEAD check for CDN URL |
| `GET` | `/api/cdnops-upload-url?url=` | Derive CDN Ops upload folder URL (sync; client also builds locally) |
| `GET` | `/api/checklist/storage` | Storage backend (`neon` or `memory`) |
| `GET` | `/api/checklist/:weekId` | All checklist checks for a week (`byDate`) |
| `PUT` | `/api/checklist/:weekId/check` | Toggle one checklist item |
| `POST` | `/api/checklist/:weekId/check-batch` | Batch mark items checked (carry-over) |
| `GET` | `/api/checklist/:weekId/upload-overrides` | QA upload overrides for a week |
| `PUT` | `/api/checklist/:weekId/upload-overrides` | Set `{ rowId, uploaded }` override |
| `GET` | `/api/checklist/:weekId/bugs?date=` | Confirmed bugs for a date (legacy API; UI removed) |
| `POST` | `/api/checklist/:weekId/bugs` | Save a confirmed bug (legacy API; UI removed) |

**Splash & Anno** (`SPLASH_SHEET_ID` required; returns `503` when unset)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/splash/weeks` | Same latest 4 sub-weeks as banner (from CDN checklist) |
| `GET` | `/api/splash/week/:weekId` | Splash/Anno records overlapping sub-week; optional `?date=` day filter |
| `GET` | `/api/splash/week-for-date/:date` | Resolve sub-week for an ISO date |
| `POST` | `/api/splash/refresh` | Bust splash + banner week cache, re-fetch weeks |
| `GET` | `/api/splash/upload-overrides/:weekId` | Tool C QA upload overrides |
| `PUT` | `/api/splash/upload-overrides/:weekId` | Set `{ rowId, uploaded }` override |
| `GET` | `/api/splash/checklist/:weekId` | Tool D checklist state (`byDate`) |
| `PUT` | `/api/splash/checklist/:weekId/check` | Toggle one checklist item |
| `POST` | `/api/splash/checklist/:weekId/check-batch` | Batch mark items checked (carry-over) |
| `GET` | `/api/splash/sheet-url` | Google Sheets URL for splash workbook |

**Tool E — Auto Upload** (proxied to worker when `WORKER_URL` set; `503` on Render)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/auto-upload/config?weekId=` | Worker availability + detected OB version |
| `POST` | `/api/auto-upload/upload` | Multipart upload → Playwright CDN pipeline |
| `GET` | `/api/auto-upload/history?weekId=` | Upload records for week (restore UI state) |
| `DELETE` | `/api/auto-upload/history/:rowId?weekId=` | Clear row record (Retry) |

**Tool F — Banner Auto Upload** (proxied to worker when `WORKER_URL` set)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/test-cdn-connectivity` | CDN API reachability test (Scenario A/B hint) |
| `GET` | `/api/tool-f/config` | Worker availability + active job id |
| `POST` | `/api/tool-f/run` | Start bulk upload for `{ tabName, subWeekLabel }` (SSE stream) |
| `POST` | `/api/tool-f/cancel` | Cancel running Python job |
| `GET` | `/api/tool-f/jobs` | Last 10 job summaries |
| `GET` | `/api/tool-f/jobs/:jobId/log` | Full log for a completed job |

---

## Repository layout

```
QA-Super-Tools/
├── package.json              # Root workspace (client + server + worker)
├── requirements.txt          # Python deps for Tool F (cdn_bot.py)
├── scripts/
│   └── cdn_bot.py            # Tool F bulk upload (CDN REST API + Sheets write-back)
├── docker-compose.yml        # Local: web :3001 + worker :3002
├── Dockerfile.web
├── Dockerfile.worker         # Node + Playwright + Python 3
├── start.bat / start.sh      # Docker quick start (local)
├── playwright/selectors.ts   # CDN Ops portal selectors (Tool E Playwright)
├── render.yaml               # Render Blueprint (pip + Tool F env vars)
├── .env.example
├── credentials/              # Service account + cdnops-auth.json (gitignored)
├── client/src/
│   ├── pages/ToolE.tsx       # Splash auto upload (Playwright)
│   ├── pages/ToolF.tsx       # Banner bulk auto upload (SSE log)
│   ├── components/splash/    # DropZone, UploadRow, … (Tool E)
│   ├── components/banner/    # BannerUploadPanel, ToolFRunReport (Tool F)
│   ├── api/autoUpload.ts     # /api/auto-upload/*
│   ├── api/toolF.ts          # /api/tool-f/*
│   └── store/useToolEStore.ts, useToolFStore.ts
├── worker/src/
│   ├── routes/autoUploadApi.ts   # Tool E
│   ├── routes/toolFApi.ts        # Tool F (spawn Python, SSE)
│   ├── services/toolFJobManager.ts
│   ├── pipeline/                 # Playwright upload (Tool E)
│   └── db/toolFRepository.ts
└── server/src/
    ├── routes/autoUploadProxy.ts
    ├── routes/toolFProxy.ts
    └── services/cdnConnectivity.ts
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
2. Share with the service account email (e.g. `ffid-qa@project.iam.gserviceaccount.com`):
   - **Viewer** — sufficient for Tool A/B and read-only flows
   - **Editor** — required for **Tool F** (writes col L `CDN Uploaded` after bulk upload)
3. Copy the Sheet ID from the URL: `https://docs.google.com/spreadsheets/d/<SHEET_ID>/edit`

### 3. Neon database (checklist persistence)

1. Create a free project at [neon.tech](https://neon.tech)
2. Copy the **pooled** connection string
3. Set `DATABASE_URL` in `.env` — tables are created automatically:
   - **Server start:** `checklist_checks`, `cdn_upload_overrides`, `confirmed_bugs`, `splash_checks`, `splash_upload_overrides`
   - **Worker start:** `auto_upload_log` (Tool E), `tool_f_jobs`, `tool_f_log` (Tool F)

Without `DATABASE_URL`, checklist, overrides, and Tool F job history use in-memory storage (resets on restart).

### 3b. Splash workbook (optional — Tool C / D)

1. Open the Splash settings workbook in Google Sheets
2. Share with the **same service account** as Viewer
3. Copy its Sheet ID into `SPLASH_SHEET_ID` in `.env`
4. Ensure the tab is named **`ID - Settings`** (event index col **B**, CDN cols **O** Anno / **Q** Splash)

Omit `SPLASH_SHEET_ID` to run banner-only; splash routes return `503` and Tool C/D are unavailable.

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
  - Annotations: `(Before Patch)`, `(After Patch)`, `Before Patch`, `After Patch`, `(lebaran)`
  - English + Indonesian months (`Des`, `Mei`)
  - Cross-month ranges (`29 Nov - 05 Des`, `Biweekly 24 Jan – 06 Feb`)
  - Cross-month sub-week labels where the month token is the **end** month (e.g. `27 - 2 Jun` → 27 May – 2 Jun)

Tabs near today are fetched, plus the globally newest relevant week tabs (deduped). Generic single-week tabs without a year or patch suffix (e.g. `7 - 13 Jun`) are ignored in favour of biweekly container tabs (`3 – 16 Jun 26`) and explicit single-week tabs (e.g. `17 – 24 Jun 26 Before Patch`).

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

The user-facing "week" is the **sub-block** (col B label), not the whole tab. The API exposes the latest 4 distinct sub-week ranges (rolling window — a new tab like `17 – 24 Jun` drops the oldest week).

Sub-week labels without a year inherit the year from the containing tab name.

**Single-week tabs** (e.g. `17 – 24 Jun 26 Before Patch`) may omit the date in column B on section headers — the parser infers the sub-week from the tab name. If the grid has no section headers yet, the tab range itself is registered as one sub-week.

### Section detection

A section starts when:
- Col A matches a known section name (via alias map)
- Col B is a week-range label (e.g. `10 - 16 Jun`), **or** col B is empty on a single-week tab (date inferred from tab name)

The **next row** is the column header row. Columns are mapped **by header name** (not fixed letters).

Data rows follow until the next section header.

Empty section-break rows (blank spacing rows) and rows with neither `Nama tab` nor `CDN Link` are skipped.

### Merged-cell event names

Google Sheets only returns the **first row** value when `Nama tab` cells are merged vertically. Subsequent rows in the merge arrive with an empty name column but their own CDN links.

The parser **inherits the last seen `Nama tab`** within each section block, so all CDN rows in a merge group share the same `displayName` (e.g. one "Token Ring" name on four Gacha assets).

### Asset tags

When a row has a sheet event name plus a CDN URL, an **asset tag** is derived from the CDN filename (e.g. `mallsmall.png` → **Mall small**, `LobbyBGID_ind.ff_extend` → **Lobby BG**). Tags appear in Tool A, Tool B, and the Summarize modal so multi-asset events are distinguishable.

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

### Splash & Anno sheet (`ID - Settings`)

- Fetches columns **B:Z** (event name in **Index** col B; status, dates, GoPos, Trello)
- **CDN paths:** col **O** (`Anno Banner`) and col **Q** (`Splash Banner`) — also fetched as dedicated single-column ranges because Google Sheets omits trailing empty cells in wide `B:Z` rows, which would otherwise drop URLs in Q
- Header row detected by `Index`/`Desc` + `Status`; columns mapped **by header name** (not fixed letters)
- One data row can split into **two records** (Splash + Anno) when both sides have dates, Sort_ID, or CDN data
- Status values (sheet → UI): `NEED TO UPDATE TRELLO` → **Asset not ready**, `TRELLO DONE` → **uploaded**, `SCHEDULED` → **Scheduled**, `DONE` → **DONE**
- **Week scope** reuses the same 4 sub-weeks as Banner (`fetchWeeks`); records overlap a sub-week when their active period intersects it
- **GoPos lookup** — exact event-name match against banner rows from the latest 4 CDN checklist weeks (**Gacha / Luck Royale excluded**); suggests GoPos/Sub GoPos when remaining rows agree (read-only)

---

## CDN health check flow

For every row with a valid CDN URL:

1. **Rewrite** `.ff_extend` → `.jpg` for the health check URL (game uses `.ff_extend`; CDN serves `.jpg`)
2. **Client cache** — skip re-check if result cached in browser (10 min)
3. **Primary:** client-side `<img>` `onload` / `onerror`
4. **Fallback:** `GET /api/cdn-check?url=...` — server cached HEAD request
5. **UI:** blue spinner badge **"Checking CDN…"** while in progress
6. **No URL** → grey "N/A"
7. **Timeout** → 5s → amber **"CDN unreachable"**

Re-checks do **not** re-fire on unrelated UI re-renders (stable effect dependencies + caching).

**Refresh sheet** clears both client and server CDN check caches and forces a fresh health check on every visible row.

---

## QA upload overrides

The app does **not** write back to Google Sheets. QA can mark rows as uploaded locally when the sheet `CDN Uploaded` column lags behind reality.

| Action | Effect |
|---|---|
| **Mark as uploaded** | Row treated as uploaded; removed from default missing list; counts toward **QA marked uploaded** |
| **Revert to unuploaded** | Row returns to missing list (enable **Include uploaded rows** to find and revert) |

Overrides are keyed by `week_id` + `row_id` and stored in Neon (`cdn_upload_overrides`) or in-memory when `DATABASE_URL` is unset. The effective uploaded state is `override ?? sheet CDN Uploaded`.

---

## Summarize unique events

**Summarize** (Tool A and Tool C headers) opens a modal for the **full selected sub-week** — independent of day/placement filters on the main table.

### Banner (Tool A)

| Control | Behavior |
|---|---|
| **Not uploaded** (default) | Unique `displayName` values with at least one non-uploaded asset |
| **Uploaded** | Unique events with at least one uploaded asset |
| **Include Craftland** | Off by default; toggles Craftland map rows into the list |
| **Copy list** | Clipboard report with header, numbered events, multiline names, assets grouped by placement |

### Splash & Anno (Tool C)

| Control | Behavior |
|---|---|
| **Not uploaded** (default) | Unique event names with at least one non-uploaded Splash/Anno asset |
| **Uploaded** | Unique events with at least one uploaded asset |
| **Copy list** | Same format as banner; assets grouped by **Splash** / **Announcement** |

Example copy format:

```
FFID CDN Event Summary
Status: Not uploaded
Events: 12
Scope: In-game banners only
Week: 10 - 16 Jun

========================================

[1] Emote Protes Pinalti
    Assets:
      • Overview

[2] Faded Wheel Bundle
    Assets:
      • Shopping Mall: Mall small, Title mall
      • Slide Banner: Slidebanner
```

---

## Checklist persistence

Stored in Neon when `DATABASE_URL` is set:

| Table | Key | Purpose |
|---|---|---|
| `checklist_checks` | `week_id` + `check_date` + `row_id` | Tool B checkbox state per day |
| `cdn_upload_overrides` | `week_id` + `row_id` | Tool A QA upload overrides per week |
| `confirmed_bugs` | `week_id` + `check_date` + `row_id` | Legacy bug API (UI removed) |
| `splash_checks` | `week_id` + `check_date` + `row_id` | Tool D splash/anno checklist per day |
| `splash_upload_overrides` | `week_id` + `row_id` | Tool C QA upload overrides per week |
| `auto_upload_log` | `week_id` + `row_id` | Tool E upload results (worker creates on startup) |
| `tool_f_jobs` | `id` (UUID) | Tool F bulk run metadata (running / completed / cancelled / failed) |
| `tool_f_log` | `job_id` + row | Tool F per-line log entries streamed from Python stdout |

`tool_f_jobs` / `tool_f_log` are created on **worker** startup (same as `auto_upload_log`). Without `DATABASE_URL`, Tool F job history uses in-memory storage only.

**Carry-over:** On day N, rows in **Still active** that were checked on any earlier day in the same week appear pre-checked (saved to day N automatically). Same behaviour for Tool D (`splash_checks`).

**Show all:** Progress unions all per-day checks across the week vs total unique rows in the week.

---

## CDN API connectivity (Phase 0)

Before relying on Tool F or the planned Tool E rewrite, confirm whether `cdnops.jingle.cn` is reachable from your network.

### Quick test

**From terminal** (office WiFi, personal hotspot, or any network):

```bash
curl -i --max-time 10 -X POST https://cdnops.jingle.cn/api/public/folder \
  -H "Authorization: Bearer YOUR_CDN_API_TOKEN" \
  -F "path=/" \
  -F "name=test-connectivity-check"
```

**From the app** (while logged in): `GET /api/test-cdn-connectivity`

Any HTTP response (200, 400, 401, 409, etc.) means the server is **reachable**. Timeout or connection refused means **not reachable**.

### Interpreting results

| Your network | CDN API responds? | Scenario | Office WiFi needed? |
|---|---|---|---|
| Personal hotspot | Yes | **A** — publicly reachable | **No** for Tool F / future Tool E (REST API) |
| Personal hotspot | No (timeout) | **B** — VPN/office locked | **Yes** for CDN uploads |
| Render (`/api/test-cdn-connectivity` after deploy) | Yes | **A** on production | Tool F can run on Render with Python deps |
| Render | No | **B** on production | Keep worker on local Docker + office network |

### Verified (June 2026)

Phase 0 **Test B** (personal hotspot, outside office WiFi): `POST …/api/public/folder` returned **HTTP 200** in under 1s → **Scenario A**.

- **Tool F** — works without office WiFi (CDN REST API + `CDN_API_TOKEN`).
- **Tool E (current Playwright)** — may still need office WiFi/VPN because it automates the **web upload portal**, not the REST API.
- **Tool E (next update)** — will use the same REST API as Tool F; office WiFi will **not** be required once migrated.

Re-run the test if your network or CDN infra changes.

---

## Tool E auto upload (local only)

Tool E **today** runs a **separate worker container** with headless Playwright against the CDN Ops **portal**. It is **not deployed to Render**. The **next Tool E update** will switch to the CDN REST API (no Playwright, no `cdnops-auth.json`; same pattern as Tool F).

### One-time setup

```bash
npm install
npm run setup:worker          # Playwright Chromium
npm run setup:cdnops-auth     # Log in to CDN OPS in a browser; saves credentials/cdnops-auth.json
```

Add to `.env`:

```env
WORKER_URL=http://localhost:3002
WORKER_PORT=3002
CDN_OB_VERSION=OB53           # fallback if sheet has no CDN URLs yet
CDNOPS_STORAGE_STATE=./credentials/cdnops-auth.json
```

### Run (choose one)

**Docker (recommended for QA):**

```bash
start.bat    # Windows — opens http://localhost:3001
```

**Dev mode (three terminals):**

```bash
npm run dev          # client :5173 + server :3001
npm run dev:worker   # worker :3002
```

Open the app at **http://localhost:5173** (not :3001 in dev). Tool E: **Splash → Auto Upload (Tool E)**.

Verify CDN OPS session: `npm run test:cdnops-auth -w worker`

### Tool F setup (same worker)

Add to `.env` (worker reads these when spawning `scripts/cdn_bot.py`):

```env
CDN_API_TOKEN=...           # CDN Ops REST API bearer token
NOTION_API_TOKEN=...        # Notion integration for asset fetch
SEATALK_WEBHOOK_URL=...     # optional — run summary notification
```

Service account needs **Editor** on `[FFID] Weekly CDN Checklist` (Tool F writes col L). Install Python deps once: `pip install -r requirements.txt`

Open **Banner** → pick sub-week → **Auto Upload** (or `/tool-f` after selecting a week). No office WiFi required if [Phase 0](#cdn-api-connectivity-phase-0) shows Scenario A.

---

## Data flow walkthrough

### Weekly CDN audit (Tool A)

```
User → /tool-a
  → GET /api/week/:weekId
  → GET /api/checklist/:weekId/upload-overrides
  → Server: sheet cache → Google Sheets API
  → Parse grid (merged names, asset tags) → filter sub-week rows
  → CDN health check per row (cached)
  → Mark uploaded → PUT /api/checklist/:weekId/upload-overrides
  → Summarize → client-side unique event list + copy
  → Open CDN upload → client builds cdnops.jingle.cn URL from CDN path
  → Refresh → POST /api/refresh (clears CDN caches + re-checks health)
```

### Daily in-game QA (Tool B)

```
User → /tool-b → pick date
  → GET /api/checklist/:weekId (load saved checks)
  → GET /api/week/:weekId
  → Group APPEAR / DISAPPEAR / Still active
  → Carry-over still-active from previous days
  → Toggle checkbox → PUT /api/checklist/:weekId/check
  → Server: Neon checklist_checks + Google Sheet col M (QA) write-back
```

### Splash upload checker (Tool C)

```
User → /splash → pick sub-week → /tool-c
  → GET /api/splash/week/:weekId
  → GET /api/splash/upload-overrides/:weekId
  → Server: splash cache → ID - Settings (B:Z + O/Q CDN cols)
  → Parse → filter by sub-week overlap (+ optional day)
  → GoPos lookup from banner rows (exact match, Gacha excluded, ≥1 agreeing row)
  → Summarize → client-side unique event list + copy
  → Mark uploaded → PUT /api/splash/upload-overrides/:weekId
  → Refresh → POST /api/splash/refresh (also busts banner week cache)
```

### Splash in-game QA (Tool D)

```
User → /tool-d → Splash or Anno tab → pick date
  → GET /api/splash/week/:weekId
  → GET /api/splash/checklist/:weekId
  → Group APPEAR / DISAPPEAR / Still active (Sort_ID order)
  → Toggle checkbox → PUT /api/splash/checklist/:weekId/check
```

### Splash auto upload (Tool E — Playwright today)

```
User → /tool-e → drop image on row
  → POST /api/auto-upload/upload (proxied to worker)
  → Worker: rename token → Playwright CDN Ops portal upload → generate CDN URL
  → Neon auto_upload_log upsert
  → UI: success + Copy CDN path
  → Retry → DELETE /api/auto-upload/history/:rowId (after confirmation)
```

### Banner bulk auto upload (Tool F)

```
User → /banner → pick sub-week → Auto Upload → /tool-f
  → POST /api/tool-f/run { tabName, subWeekLabel } (proxied to worker, SSE stream)
  → Worker spawns python3 scripts/cdn_bot.py with TOOL_F_SHEET_TAB + TOOL_F_SUB_WEEK
  → Python: selected checklist tab + sub-week section → col B FF URLs, col J Notion/Drive, col L skip if done
  → Fetch asset → match filename/dimensions → CDN REST API (folder → precreate → superfile)
  → Write col L = TRUE on success; SeaTalk summary at end
  → Structured stdout lines → SSE → browser run report; rows saved to tool_f_log
  → Cancel → POST /api/tool-f/cancel (SIGTERM)
  → Previous runs → GET /api/tool-f/jobs, GET /api/tool-f/jobs/:id/log
  → Tool A: Refresh sheet to see updated CDN Uploaded checkboxes
```

---

## Local development

### Prerequisites

- Node.js 18+
- **Python 3** + `pip install -r requirements.txt` (for Tool F on the worker host)
- Google service account:
  - **Viewer** — enough for Tool A/B/C/D/E read-only flows
  - **Editor** on `[FFID] Weekly CDN Checklist` — required for **Tool F** (writes col L)
- Neon `DATABASE_URL` (optional but recommended; persists Tool F job history)
- `ADMIN_PASSWORD` + `SESSION_SECRET` (optional locally; required in production)
- **Tool E / F worker:** `WORKER_URL`, and for Tool F: `CDN_API_TOKEN`, `NOTION_API_TOKEN`

### Run

```bash
npm install
pip install -r requirements.txt   # Tool F (once per machine / in Docker image)
cp .env.example .env
# Edit .env — see Environment variables reference

npm run dev          # client :5173 + server :3001
npm run dev:worker   # worker :3002 — required for Tool E and Tool F
```

- Frontend: http://localhost:5173 (proxies `/api` → :3001)
- Backend: http://localhost:3001
- Worker: http://localhost:3002 (Tool E Playwright + Tool F Python)

### Production build

```bash
npm run build    # builds client + server
npm start        # serves API + static client from server
```

### Deploy on Render (free tier)

1. Connect the GitHub repo as a **Web Service** (Node), region **Singapore** (near Neon SEA).
2. **Build command** (includes Python deps for Tool F — see `render.yaml`):

```bash
pip3 install --break-system-packages -r requirements.txt && npm install --include=dev && npm run build && mkdir -p credentials && printf '%s' "$GOOGLE_SERVICE_ACCOUNT_JSON" > credentials/service-account.json
```

3. **Start command:** `npm start`
4. **Required env vars:** `SHEET_ID`, `DATABASE_URL`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_SERVICE_ACCOUNT_KEY=./credentials/service-account.json`, `ADMIN_PASSWORD`, `SESSION_SECRET` (min 32 chars), `NODE_ENV=production`
5. **Tool F on Render (Scenario A):** set `WORKER_URL` to a worker service (or run worker on same host if you add Python to the image), plus `CDN_API_TOKEN`, `NOTION_API_TOKEN`, optional `SEATALK_WEBHOOK_URL`. Confirm with `GET /api/test-cdn-connectivity` after deploy.
6. **Tool E (Playwright):** still needs a **separate worker** with Chromium — not suitable for Render free tier web service alone; use local Docker (`start.bat`) or a dedicated worker container.
7. Or use the included `render.yaml` Blueprint and set secret env vars in the dashboard.
8. **Optional:** `SPLASH_SHEET_ID` for Tool C/D/E; splash env vars in `render.yaml`.

Render sets `NODE_ENV=production` during build, which skips devDependencies by default — `--include=dev` in the build command fixes that.

**Free tier note:** service sleeps after ~15 min idle; first request after sleep may take 30–60s.

**Scenario B:** if CDN API is unreachable from Render, run `docker-compose` locally with office network and set `WORKER_URL=http://worker:3002` only on the local web container.

### Tests

```bash
npm test    # server + client + worker unit tests
```

---

## Assumptions & known limitations

| Topic | Decision |
|---|---|
| CDN base URL | Constant `https://dl.dir.freefiremobile.com/common/`; OB version is in the path |
| "Latest 4 weeks" | 4 most-recent distinct **sub-week** ranges; rolls forward as new tabs are added |
| Week tab formats | Biweekly containers (`3 – 16 Jun 26`) + explicit single-week tabs (`17 – 24 Jun 26 Before Patch`); generic weekly tabs without year/patch suffix ignored |
| Non-week tabs | Ignored (`Patch Note`, `Master Copy`, etc.) |
| Cross-week carry-over | Tool B shows only the selected sub-week's rows |
| Craftland | Own placement; excluded from Summarize by default; non-URL rows skip CDN health check |
| QA upload overrides | Tool A/C manual marks in Neon only; **Tool F** writes col L via Python; Tool E v2 will write splash cols |
| Summarize scope | Full sub-week (ignores Tool A/C day/placement filters) |
| Checklist + overrides | Neon when configured; in-memory fallback otherwise |
| Write-back to sheet | Tool B writes col M (QA); Tool F writes col L via Python; Tool A–E QA upload overrides stay in Neon only (Tool E sheet write-back planned) |
| Tool F scope | Selected sub-week only (same picker as Tool A/B); not the rightmost sheet tab |
| Dash display | UI normalizes en-dash/em-dash from sheet tab names to ASCII `-` |
| Authentication | Single shared admin account (no Google Sign-In yet) |
| Multi-user audit | No per-user tracking on checklist actions yet |
| Splash tools | Require `SPLASH_SHEET_ID`; share workbook with service account; tab `ID - Settings` |
| Splash CDN columns | O = Anno, Q = Splash; empty O with Q filled is normal — use **Splash** tab in Tool D |
| Splash GoPos lookup | Exact banner name match; **Gacha / Luck Royale** rows excluded; ≥1 remaining row must agree |
| Tool E (today) | Playwright PoC; local worker; office WiFi/VPN for CDN Ops **portal**; CDN OPS login; no sheet write-back |
| Tool E (planned) | CDN REST API like Tool F; auto-fetch from Notion/Drive; sheet write-back; **no office WiFi** (Scenario A confirmed) |
| Tool F | CDN REST API via worker; **no office WiFi** on Scenario A; writes col L; needs `CDN_API_TOKEN` + `NOTION_API_TOKEN` |

---

## Phase 2 roadmap

- ~~Persistent checklist state~~ ✅ Neon PostgreSQL
- ~~CDN check result caching~~ ✅ Client + server TTL cache
- ~~Simple admin auth~~ ✅ Session cookie login
- ~~QA upload overrides (mark as uploaded)~~ ✅ Neon + in-memory
- ~~Summarize unique events + copy report~~ ✅
- ~~Merged-cell name inheritance + asset tags~~ ✅
- ~~CDN Ops upload deep-link~~ ✅ Client-side folder URL
- ~~Splash & Anno Tool C/D (upload checker + in-game QA)~~ ✅
- ~~Tool E — Splash/Anno auto upload to CDN Ops (Playwright PoC)~~ ✅
- ~~Tool F — Banner bulk auto upload (CDN REST API + Python)~~ ✅
- **Tool E v2** — replace Playwright with CDN REST API; Notion/Drive auto-fetch; splash sheet write-back (cols O/Q, Status, GoPos); no office WiFi on Scenario A
- Multi-user / per-QA audit trail
- Google Sign-In or team SSO
- ~~Banner sheet write-back (col L)~~ ✅ Tool F; splash write-back planned in Tool E v2
- Slack daily digest
- Mobile-optimised layout
- Historical week comparison
- Expanded week range beyond latest 4

---

## Environment variables reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `SHEET_ID` | Yes | — | Banner Google Sheet ID from URL |
| `SPLASH_SHEET_ID` | No | — | Splash workbook ID (`ID - Settings`); omit for banner-only |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Yes | — | Path to service account JSON file |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Deploy | — | Full JSON body (Render build writes to file) |
| `CDN_BASE_URL` | No | `https://dl.dir.freefiremobile.com/common/` | CDN prefix for relative paths |
| `DATABASE_URL` | No* | — | Neon PostgreSQL connection string |
| `ADMIN_USERNAME` | No | `admin` | Admin login username |
| `ADMIN_PASSWORD` | Prod | — | Admin password; enables auth when set |
| `SESSION_SECRET` | Prod | — | Cookie signing secret (min 32 chars) |
| `PORT` | No | `3001` | Server port (Render sets automatically) |
| `CACHE_TTL_MS` | No | `300000` | Banner sheet data cache TTL (5 min) |
| `SPLASH_CACHE_TTL_MS` | No | `300000` | Splash sheet parse cache TTL (5 min) |
| `SPLASH_RECENT_WEEKS` | No | `4` | Only keep splash rows active in the last N weeks |
| `SPLASH_RECENT_ROW_WINDOW` | No | `250` | Bottom N rows to fetch from `ID - Settings` |
| `CDN_CHECK_CACHE_TTL_MS` | No | `600000` | CDN health check cache TTL (10 min) |
| `WORKER_URL` | Tool E + F | — | Worker base URL (e.g. `http://localhost:3002` or `http://worker:3002` in Docker) |
| `WORKER_PORT` | Tool E + F | `3002` | Worker listen port |
| `CDN_OB_VERSION` | Tool E | Auto-detected | Fallback OB version (e.g. `OB53`) |
| `CDNOPS_STORAGE_STATE` | Tool E | `./credentials/cdnops-auth.json` | Saved CDN OPS session (from `setup:cdnops-auth`) |
| `CDNOPS_USERNAME` | Tool E | — | Optional auto-login (alternative to storage state) |
| `CDNOPS_PASSWORD` | Tool E | — | Optional auto-login |
| `CDN_API_TOKEN` | Tool F | Yes (worker) | CDN Ops REST API bearer token |
| `NOTION_API_TOKEN` | Tool F | Yes (worker) | Notion integration for asset fetch |
| `SEATALK_WEBHOOK_URL` | Tool F | No | SeaTalk webhook for run summary |
| `TOOL_F_DOWNLOAD_BASE` | Tool F | `/tmp/tool-f-downloads` | Temp download dir for Python script |
| `SHEET_TITLE` | Tool F | `[FFID] Weekly CDN Checklist` | Workbook title passed to `cdn_bot.py` |
| `TOOL_F_SHEET_TAB` | Tool F | — | Set by worker at run time — Google Sheet tab name for selected sub-week |
| `TOOL_F_SUB_WEEK` | Tool F | — | Set by worker at run time — col B section label (e.g. `10 - 16 Jun`) |
| `PYTHON_COMMAND` | Tool F | `python` (Win) / `python3` (Unix) | Override Python executable on worker |
| `NODE_ENV` | No | `development` | `production` enables static file serving + requires auth secrets |

\*Required for persistent checklist and upload overrides in production; strongly recommended for team use.

---

*FFID LiveOps QA Tools — built for Free Fire Indonesia LiveOps QA*
