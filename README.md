# FFID LiveOps QA Tools

Web application for the Free Fire Indonesia LiveOps QA team to automate weekly **banner** and **Splash & Anno** CDN upload checks and in-game QA checklists. The tool reads from the master Google Sheet (`[FFID] Weekly CDN Checklist`) and, optionally, the Splash workbook (`ID - Settings` tab). It surfaces what needs CDN upload, what should appear/disappear in-game each day, and whether CDN links resolve.

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
- Per-row checkbox with **persistent storage** (Neon) keyed by `week + date + row`
- **Still-active carry-over**: banners checked on a previous day in the same week auto-appear checked on later days
- **Show all** progress aggregates checks from every day in the week (unique rows checked / total week rows)
- Progress bar: `X / Y checked`
- **Asset tags** on rows that share an event name (same as Tool A)
- **Open CDN upload** per row
- Placement filter; optional Craftland section

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

### Landing & entry points

| Route | Purpose |
|---|---|
| `/` | Tool selector — Banner QA vs Splash & Anno QA |
| `/banner` | Banner scope — week or date, then Tool A / B |
| `/splash` | Splash scope — same sub-week picker as Banner, then Tool C / D |

**Banner (`/banner`)** and **Splash (`/splash`)** both use the same sub-week list (e.g. `27 May–2 Jun`, `3–9 Jun`, `10–16 Jun`, `17–24 Jun`) plus optional date-picker. Each entry page has a **Refresh weeks** button that busts the server cache and reloads the dropdown (use this after a new sheet tab is added — **Refresh sheet** inside Tool A/C only reloads row data for the already-selected week).

`SPLASH_SHEET_ID` is **optional** — if unset, splash API returns `503` and banner tools are unaffected.

### Admin login (`/login`)

When `ADMIN_PASSWORD` is set, all app routes and API endpoints (except health + auth) require a signed session cookie after login. Omit `ADMIN_PASSWORD` locally to disable auth during development.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (React SPA via Vite)                                   │
│  - Tool selector, Banner (/banner) + Splash (/splash) entry    │
│  - Tool A/B (banner), Tool C/D (splash & anno), Login           │
│  - CDN health: <img> + cached server HEAD fallback              │
│  - Summarize modal, CDN Ops upload links, upload overrides UI   │
│  - Zustand: week/date filters, checklist + override state       │
└──────────────────────────┬──────────────────────────────────────┘
                           │ /api/*  (credentials: cookie)
┌──────────────────────────▼──────────────────────────────────────┐
│  Node.js + Express + TypeScript (server/)                         │
│  - Admin session auth (signed cookie, optional)                   │
│  - Google Sheets API (service account, read-only)                 │
│  - Banner parsing (tabs, sub-weeks, sections, dates)              │
│  - Splash parsing (ID - Settings, B:Z + O/Q CDN columns)        │
│  - In-memory TTL cache (banner + splash sheet + CDN checks)       │
│  - CDN HEAD proxy (/api/cdn-check)                                │
│  - Checklist + overrides (/api/checklist/*, /api/splash/*)        │
└──────────┬─────────────────────────────┬────────────────────────┘
           │                             │
           ▼                             ▼
  Google Sheets API v4          Neon PostgreSQL (optional)
  - [FFID] Weekly CDN Checklist (checklist_checks, cdn_upload_overrides)
  - Splash workbook / ID - Settings (splash_checks, splash_upload_overrides)
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
│   │   ├── pages/            # ToolSelector, EntryPoint, SplashEntry, ToolA–D, Login
│   │   ├── components/       # Banner + splash tables, filters, CDN health
│   │   │   └── splash/       # SplashCdnTable, GoposField, AssetTypeTabs, etc.
│   │   ├── api/              # client.ts, checklist.ts, splash.ts, auth.ts
│   │   ├── store/            # useAppStore, useSplashStore, useAuthStore
│   │   └── utils/            # splashFilters, splashChecklist, uploadOverrides, date
│   └── vite.config.ts        # Dev proxy → localhost:3001
└── server/                   # Express backend
    ├── src/
    │   ├── auth/             # Session token create/verify
    │   ├── db/               # Neon client, checklist + splash repos
    │   ├── google/           # Sheets client, splashSheetsClient (B:Z + O/Q)
    │   ├── middleware/       # requireAuth
    │   ├── parsing/          # Banner + splashParser (header-based columns)
    │   ├── routes/           # api.ts, splashApi.ts, auth.ts, checklist.ts
    │   ├── services/         # dataService, splashService, splashWeekService
    │   ├── scripts/          # testDb.ts, migrateSplash.ts
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

### 3. Neon database (checklist persistence)

1. Create a free project at [neon.tech](https://neon.tech)
2. Copy the **pooled** connection string
3. Set `DATABASE_URL` in `.env` — tables are created automatically on server start:
   - Banner: `checklist_checks`, `cdn_upload_overrides`, `confirmed_bugs`
   - Splash: `splash_checks`, `splash_upload_overrides` (auto-migrates legacy `month_id` → `week_id`)

Without `DATABASE_URL`, checklist and upload-override state use in-memory storage (resets on server restart).

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

**Carry-over:** On day N, rows in **Still active** that were checked on any earlier day in the same week appear pre-checked (saved to day N automatically). Same behaviour for Tool D (`splash_checks`).

**Show all:** Progress unions all per-day checks across the week vs total unique rows in the week.

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
6. **Optional:** set `SPLASH_SHEET_ID` to enable Tool C/D (see `render.yaml` splash env vars).

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
| "Latest 4 weeks" | 4 most-recent distinct **sub-week** ranges; rolls forward as new tabs are added |
| Week tab formats | Biweekly containers (`3 – 16 Jun 26`) + explicit single-week tabs (`17 – 24 Jun 26 Before Patch`); generic weekly tabs without year/patch suffix ignored |
| Non-week tabs | Ignored (`Patch Note`, `Master Copy`, etc.) |
| Cross-week carry-over | Tool B shows only the selected sub-week's rows |
| Craftland | Own placement; excluded from Summarize by default; non-URL rows skip CDN health check |
| QA upload overrides | Overlay on sheet `CDN Uploaded`; not written back to Google Sheets |
| Summarize scope | Full sub-week (ignores Tool A/C day/placement filters) |
| Checklist + overrides | Neon when configured; in-memory fallback otherwise |
| Write-back to sheet | Not supported (read-only) |
| Authentication | Single shared admin account (no Google Sign-In yet) |
| Multi-user audit | No per-user tracking on checklist actions yet |
| Splash tools | Require `SPLASH_SHEET_ID`; share workbook with service account; tab `ID - Settings` |
| Splash CDN columns | O = Anno, Q = Splash; empty O with Q filled is normal — use **Splash** tab in Tool D |
| Splash GoPos lookup | Exact banner name match; **Gacha / Luck Royale** rows excluded; ≥1 remaining row must agree |

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
| `NODE_ENV` | No | `development` | `production` enables static file serving + requires auth secrets |

\*Required for persistent checklist and upload overrides in production; strongly recommended for team use.

---

*FFID LiveOps QA Tools — built for Free Fire Indonesia LiveOps QA*
