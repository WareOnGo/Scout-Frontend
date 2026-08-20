# Scout Frontend — Warehouse Submission Form

A single-purpose, mobile-first form used by WareOnGo field scouts to submit a warehouse
while standing at the site. One route, one form, one success screen.

- **Stack:** React 19, Vite 8, plain CSS, axios, lucide-react. **No UI framework.**
- **Auth:** the scout's Employee ID (`empID`), verified server-side
- **Backend:** [`Dashboard_Backend`](https://github.com/WareOnGo/Dashboard_Backend) — submissions land in the review queue, not the live list
- **Sibling app:** the internal dashboard (`WAG_Dashboard`), where these submissions get reviewed

---

## Table of contents

- [What it does](#what-it-does)
- [Key design decisions](#key-design-decisions)
- [Architecture](#architecture)
- [The form](#the-form)
- [File uploads](#file-uploads)
- [Project layout](#project-layout)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Testing](#testing)
- [Gotchas](#gotchas)

---

## What it does

```
Scout fills a 7-step form
        │  (Employee ID entered in step 1 — this is the auth token)
        ▼
POST /api/warehouses/scout          media PUT straight to Cloudflare R2
        │                            via presigned URLs (never through the API)
        ▼
Backend: verifyScoutToken → strict Zod → StagedWarehouse (PENDING)
        │
        ▼
Reviewer approves in the dashboard → promoted to the master Warehouse table
        │
        ▼
Scout sees a success screen with the submission id
```

Nothing this app submits goes live directly. Every submission is reviewed first.

---

## Key design decisions

### 1. No UI framework, on purpose
The dashboard uses Ant Design; this app uses hand-written CSS and native inputs. Scouts open
it on mid-range Android phones over patchy mobile data at a warehouse site, so the priority
is a small bundle and fast first paint. The only runtime dependencies are React, axios, and
`lucide-react` for icons. Even toasts are hand-rolled (`utils/toast.js`) — a ~50-line DOM
helper instead of a notification library.

The trade-off is real: form controls, modals, and validation display are all custom code
that the dashboard gets for free from antd. That's accepted here because the surface is one
form and it will not grow into an app.

### 2. Employee ID *is* the credential
There's no login screen and no session. The scout types their Employee ID into the
"Employee ID" field in step 1, and it's sent as `uploadedBy` in the submission body (and to
the presigned-URL endpoint). The backend's `verifyScoutToken` middleware looks it up in
`VerifiedNumber`, rejects unknown IDs with 401 and revoked scouts with 403, and attaches the
resolved identity to the request.

This is a deliberately low-friction, low-privilege design: the endpoint can only *create*
staged submissions, everything it creates is reviewed by a human, and the endpoint is
rate-limited per IP (15 submissions/hour, 200 presigned URLs/hour). A leaked empID cannot
read data, cannot publish anything, and cannot self-approve — the backend forces
`wogVerified: false` and `visibility: false` on every staged row regardless of what's sent.

### 3. Step-gated validation, with the failing field scrolled into view
The form is 7 steps. `validateStep(n)` only validates the fields declared for that step
(`formSteps[n].fields`), so a scout can't be blocked by a field they haven't reached, and
can't skip past a required one either. On failure the first offending field is scrolled into
view — on a phone the error is otherwise off-screen and the Next button just looks broken.

### 4. Phone validation warns, it doesn't reject
`utils/phone.looksLikePhone()` is tolerant: it strips whitespace, dashes, parens and a
`+91`/`91`/`0` prefix, then accepts 8–11 national digits (Indian mobiles and landlines).
It returns `true` for empty input, because "required" is a separate check. The goal is to
catch a typo without blocking a scout who has an unusual but real number.

### 5. Fields are submitted even when their inputs are hidden
RCC-only fields (`totalFloors`, lift details) render only when `warehouseType === 'RCC'`,
but they're always included in the payload. Switching type away from RCC hides the inputs
without silently discarding data the scout already entered.

### 6. Media is double-written
The payload carries both `media` (the JSONB shape `{ images, videos, docs }`) and `photos`
(the legacy comma-separated URL string), flattened from the same list. Consumers that
haven't migrated off `photos` keep working. `utils/mediaUtils.getMediaFromWarehouse()`
reads either shape.

### 7. Remount-to-reset instead of a reset function
Cancel and "submit another" both bump `formKey`, remounting `WarehouseForm` from
`INITIAL_VALUES`. With ~90 fields plus nested media state, a remount is far harder to get
subtly wrong than a hand-written reset. Cancel is confirmed with `window.confirm` first.

### 8. Errors are parsed once, centrally
`utils/errorHandler.js` maps an axios error to `{ type, message, issues, statusCode }` —
400 surfaces the backend's Zod issues, 401 says "check your Employee ID", network failures
say so — and renders it as a toast. Components call `handleOperationError(err, 'create')`
rather than reading `error.response.data` themselves.

### 9. District-level city lists, bundled
`INDIA_STATE_CITIES` in `WarehouseForm.jsx` is a hard-coded state → district/city map
covering all states and UTs. It's a large literal, but it means city entry is a constrained
dropdown rather than free text, which is what makes the data usable downstream. State also
drives the backend's zone derivation, so a canonical state name matters.

---

## Architecture

Deliberately flat — four layers, no state-management library, no router.

```
App.jsx                  submit / reset orchestration, success-vs-form switch
   │
   ├─ WarehouseForm      7-step form, all field state, per-step validation
   │     └─ FileUpload   classify → presign → PUT to R2 → collect URLs
   │
   └─ SuccessPage        submission id + "submit another"

services/warehouseService  →  services/apiClient (axios instance)
utils/{errorHandler,toast,phone,mediaUtils}
hooks/{useViewport,useErrorHandler}
```

All form state lives in `WarehouseForm` as a single `values` object with a `set(field)`
curried setter. There is no context and no store: one screen, one owner.

---

## The form

| # | Step | Required fields |
|---|---|---|
| 1 | Owner Details | `listing_type`, `contactPerson`, `contactNumber`, `uploadedBy` (Employee ID) |
| 2 | Location Details | `address`, `city`, `state` |
| 3 | Technical Specs | `warehouseType`, `totalSpaceSqft` (`chargeableArea` is optional, but format-checked) |
| 4 | Compliances | `compliances` |
| 5 | Commercials | `ratePerSqft` |
| 6 | Media | — |
| 7 | Scout Notes | — |

`alt_phone_number` is optional but phone-shape-checked when filled. `totalSpaceSqft` is an
array (a site can have multiple blocks); values must be positive whole numbers.

Selecting **Delhi** or **Chandigarh** auto-fills the city, since the state and the city are
effectively the same choice there.

Notably **not** collected: `zone` — the backend derives it from `state` so the value stays
canonical no matter how the record was entered.

---

## File uploads

`FileUpload` handles images, videos, and documents in one control.

1. **Classify** by MIME, falling back to file extension — phone cameras often report
   `application/octet-stream` or nothing at all, so `resolveMime()` maps the extension back
   to a real content type before presigning.
2. **Presign:** `POST /api/warehouses/scout/presigned-url` with the resolved content type
   and the scout's `uploadedBy` (this endpoint has no JWT, so the empID travels in the body).
3. **Upload:** `PUT` the file directly to Cloudflare R2 with a bare axios call —
   deliberately outside `apiClient` so no interceptor or default header interferes with the
   signed request.
4. **Collect** the returned public URL into `{ images, videos, docs }`.

R2 failures are translated to human messages (403 → expired/invalid URL, 413 → file too
large). Default max size is 50 MB. Uploads report progress upward via `onUploadingChange`,
so the form can block submit while media is still in flight.

Accepted: `jpg jpeg png gif webp heic heif` · `mp4 mov avi mkv webm` · `pdf doc docx xls xlsx`.

---

## Project layout

```
src/
├── App.jsx                  # submit/reset orchestration, form ⇄ success switch
├── main.jsx
├── components/
│   ├── WarehouseForm.jsx    # the 7-step form (state, validation, payload assembly)
│   ├── FileUpload.jsx       # classify → presign → direct-to-R2 upload
│   ├── ResponsiveModal.jsx
│   └── SuccessPage.jsx
├── services/
│   ├── apiClient.js         # thin axios wrapper (no interceptors — nothing to inject)
│   └── warehouseService.js  # create, presign, R2 upload
├── hooks/
│   ├── useViewport.js       # drives mobile-vs-desktop layout in JS
│   └── useErrorHandler.js
├── utils/
│   ├── errorHandler.js      # axios error → typed, human message
│   ├── toast.js             # ~50-line stacked toast implementation
│   ├── phone.js             # tolerant phone-shape check
│   └── mediaUtils.js        # media JSONB ⇄ legacy photos CSV
└── test/setup.js
```

Tests sit next to their subjects as `*.test.js(x)` rather than in a `__tests__/` directory.

---

## Getting started

```bash
git clone https://github.com/rs0125/Scout-Frontend.git
cd Scout-Frontend
npm install
npm run dev          # Vite on :5174 (strictPort — it will fail rather than pick another)
```

The port is pinned to **5174** because the backend's CORS allow-list names it explicitly. If
you change it, add the new origin to `corsOptions.origin` in the backend's `src/app.js`.

You'll also need a valid `empID` in the backend's `VerifiedNumber` table to submit anything;
generate one with the backend's `npm run backfill:empids` or insert a row directly.

```bash
npm run build      # → dist/
npm run preview
npm run lint
npm test
```

---

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3001/api` | Backend API root |

That's the entire config surface. Note the name is `VITE_API_URL` — **not**
`VITE_API_BASE_URL` as in the dashboard repo. There is no `.env.example` committed; create
`.env` yourself if you need to point at a deployed backend.

Baked in at build time, so changing it needs a rebuild.

---

## Testing

Vitest + Testing Library + jsdom. Coverage via v8, excluding `main.jsx` and the test
scaffolding.

```bash
npm test              # single run
npm run test:watch
npm run test:coverage
```

Existing specs: `WarehouseForm`, `FileUpload`, `SuccessPage`, `apiClient`,
`warehouseService`, `errorHandler`, `toast`, `phone`, `mediaUtils`, `useViewport`.

[`CI_TESTS.md`](CI_TESTS.md) is the full intended test plan — every scenario written as a
numbered, 1:1-implementable case (step navigation, validation, upload lifecycle, error
paths, E2E smoke). It describes more coverage than currently exists; treat it as the backlog
and the spec for what "done" looks like.

There is **no CI workflow in this repo** — no `.github/`. Lint, test, and build are manual.
`CI_TESTS.md` §2 describes the gates that ought to run (`npm ci` → lint → unit → build).

---

## Gotchas

- **A submission is not a live warehouse.** It sits `PENDING` until a reviewer approves it
  in the dashboard. The id on the success screen is the created record's id — a scout
  checking the public list won't find it yet.
- **The empID field is auth, not metadata.** A typo reads as a 401, not a validation error.
  The error handler says "check your Employee ID" for exactly this reason.
- **Port 5174 is load-bearing** (`strictPort: true` + the backend CORS list).
- **Adding a field means three edits here** — `INITIAL_VALUES`, the input in the right step,
  and the payload object in `handleSubmit` — plus the backend's `Warehouse` +
  `StagedWarehouse` schema and `warehouseValidator`. A field missing from the payload
  assembly is silently dropped; the form will look like it worked.
- **`INDIA_STATE_CITIES` is a large inline literal** near the top of `WarehouseForm.jsx`.
  Scroll past it; the component logic starts below.
- **`apiClient` has no interceptors** by design. If you add auth here, don't copy the
  dashboard's refresh-queue machinery — there is no token to refresh.

---

## Related

- Backend `README.md` — the staging pipeline these submissions feed
- Backend `docs/STAGING_VALIDATION_LAYER.md` — review-before-publish design spec
- [`CI_TESTS.md`](CI_TESTS.md) — full test plan
