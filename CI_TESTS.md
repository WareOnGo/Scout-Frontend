# Scout Frontend — CI Test Plan

This document specifies the test surface for the Scout warehouse-submission form.
It is structured so each entry can be translated 1:1 into a CI test case (unit, integration, or E2E).

> Source files this plan covers:
> `src/App.jsx`, `src/components/WarehouseForm.jsx`, `src/components/FileUpload.jsx`,
> `src/components/SuccessPage.jsx`, `src/services/apiClient.js`,
> `src/services/warehouseService.js`, `src/utils/errorHandler.js`, `src/utils/toast.js`,
> `src/utils/mediaUtils.js`, `src/hooks/useViewport.js`, `src/hooks/useErrorHandler.js`.

---

## 1. Tooling recommendation

| Layer | Stack |
|---|---|
| Unit + component | **Vitest** + **@testing-library/react** + **@testing-library/user-event** + **jsdom** |
| Network mocking | **MSW** (Mock Service Worker) for `/warehouses/*` and presigned-URL endpoints |
| File / blob mocks | `new File([...], 'name.ext', { type })` + `XMLHttpRequest` mock (e.g. `xhr-mock` or MSW) |
| E2E (smoke) | **Playwright** — runs against `vite preview` build with backend stubbed |
| Linting | `eslint .` (already in `package.json`) |
| Build sanity | `vite build` runs in CI on every PR |

CI gates (recommended): lint → unit → integration → build → E2E smoke.

---

## 2. Build & lint gates (no source changes)

| ID | What | Pass criterion |
|---|---|---|
| BUILD-1 | `npm ci` succeeds | Lockfile resolves with no peer-dep errors |
| BUILD-2 | `npm run lint` | Exit 0 |
| BUILD-3 | `npm run build` | Vite build emits `dist/` and exits 0 |
| BUILD-4 | `VITE_API_URL` injection | Build run with `VITE_API_URL=https://example.test/api` produces a bundle that uses that URL (grep `dist/assets/*.js`) |

---

## 3. App shell (`App.jsx`)

| ID | Scenario | Expected |
|---|---|---|
| APP-1 | Initial mount | Header renders ("Warehouse Data Form"); `WarehouseForm` is visible; `SuccessPage` is not. |
| APP-2 | Successful submit | `warehouseService.create` is called once with the form payload; on resolve, `SuccessPage` mounts with `warehouseId` = returned `id`; window scrolls to top. |
| APP-3 | Failed submit | `handleOperationError(error, 'create')` is invoked; `WarehouseForm` stays mounted; form values are NOT cleared; error is re-thrown so the form can mark itself non-submitting. |
| APP-4 | Cancel confirmed | `window.confirm` returns `true` → `formKey` changes (form remounts) → form values are reset to `INITIAL_VALUES`; scrolls to top. |
| APP-5 | Cancel declined | `window.confirm` returns `false` → form is NOT remounted; values preserved. |
| APP-6 | Start over from success | Click "Submit another warehouse" → `createdWarehouse` cleared, `formKey` updated, form remounts blank. |
| APP-7 | Loading state propagation | While `warehouseService.create` is pending, `loading` prop on `WarehouseForm` is `true` (busy overlay should appear). |

---

## 4. `WarehouseForm` — step navigation

| ID | Scenario | Expected |
|---|---|---|
| NAV-1 | Initial step | `currentStep === 0` ("Owner Details"); Previous button hidden, Next visible, Submit hidden. |
| NAV-2 | Step indicator labels (desktop) | All 6 step titles rendered: Owner Details, Location Details, Technical Specs, Compliances, Commercials, Media. |
| NAV-3 | Step indicator labels (mobile) | Only current step title rendered in `.form-steps__mobile-title`; numbered badges visible. |
| NAV-4 | Next on invalid step | Required fields missing → `validateStep` fails; step does NOT advance; first errored field has `data-field` attribute scrolled into view. |
| NAV-5 | Next on valid step | All required fields present → `currentStep` increments by 1; page scrolls to top. |
| NAV-6 | Previous | Decrements `currentStep`; values preserved; scrolls to top. |
| NAV-7 | Click backward on completed step | Allowed (all prior steps still valid); navigates directly. |
| NAV-8 | Click forward to a step whose prerequisites are invalid | `canNavigateToStep` returns false; badge button is disabled; click does nothing. |
| NAV-9 | Final step UI | On step 5 (Media): Submit button replaces Next; submit is **disabled for ~500ms** after arriving (`submitReady`). After 500ms it is enabled (assuming no media uploading). |
| NAV-10 | Step class names | Completed steps get `form-steps__item--complete`, current gets `--current`, future get `--todo`, navigable ones get `--clickable`. |

---

## 5. `WarehouseForm` — required-field validation per step

Required fields are defined in `formSteps[].fields` and enforced in `getStepErrors`.

### Step 0 — Owner Details

| ID | Field | Rule | Error message |
|---|---|---|---|
| VAL-OWN-1 | `listing_type` | non-empty | "Listing type is required" |
| VAL-OWN-2 | `contactPerson` | non-empty after trim | "Contact person is required" |
| VAL-OWN-3 | `contactNumber` | non-empty after trim | "Contact number is required" |
| VAL-OWN-4 | `uploadedBy` (Employee ID) | non-empty after trim | "Uploaded by is required" |

### Step 1 — Location Details

| ID | Field | Rule |
|---|---|---|
| VAL-LOC-1 | `address` | non-empty after trim |
| VAL-LOC-2 | `city` | non-empty after trim |
| VAL-LOC-3 | `state` | non-empty after trim |
| VAL-LOC-4 | `zone` | non-empty (must be one of `ZONES` or preserved `(current)` value) |

### Step 2 — Technical Specs

| ID | Field | Rule |
|---|---|---|
| VAL-TEC-1 | `warehouseType` | non-empty after trim (now a dropdown; placeholder option is `value=""`) |
| VAL-TEC-2 | `totalSpaceSqft` | at least one value > 0 → otherwise "At least one space value is required" |
| VAL-TEC-3 | `totalSpaceSqft` | all values must be integers — decimal entry → "Space values must be whole numbers (no decimals)" |
| VAL-TEC-4 | `chargeableArea` | optional; when present, must be a non-negative whole number (Number.isInteger, ≥ 0) |

### Step 3 — Compliances

| ID | Field | Rule |
|---|---|---|
| VAL-COM-1 | `compliances` | non-empty |

### Step 4 — Commercials

| ID | Field | Rule |
|---|---|---|
| VAL-CRC-1 | `ratePerSqft` | non-empty (`0` allowed because of `!values.ratePerSqft && values.ratePerSqft !== 0` check) |

### Cross-cutting validation behaviour

| ID | Scenario | Expected |
|---|---|---|
| VAL-X-1 | Error on first invalid field clears as user types | `set(field)` clears `errors[field]`. |
| VAL-X-2 | First errored field scrolls into view | `document.querySelector('[data-field="…"]').scrollIntoView({ behavior: 'smooth', block: 'center' })` is called within 50ms. |
| VAL-X-3 | Validation is per-step, not global | Filling Step 0 then advancing does not surface errors for Step 4 fields. |
| VAL-X-4 | `canNavigateToStep` re-runs all earlier `getStepErrors` | Editing a Step-0 field to be invalid disables direct navigation to later steps via badges. |

---

## 6. `WarehouseForm` — draft persistence (localStorage)

Key: `warehouseForm:draft:v1`. Shape: `{ values, currentStep, savedAt }`.

| ID | Scenario | Expected |
|---|---|---|
| DRAFT-1 | Fresh open with no draft | Form initialises from `INITIAL_VALUES`; no draft banner. |
| DRAFT-2 | Open with existing draft | Banner "Restored unsaved draft from your last session." appears; form values match draft; `currentStep` matches draft. |
| DRAFT-3 | Open in edit mode (`initialData` present) | Draft is NEVER restored; form uses `toFormValues(initialData)`. |
| DRAFT-4 | Debounced save | On change, draft is written after 400ms idle; rapid edits coalesce into one write. |
| DRAFT-5 | No write in edit mode | When `initialData` is non-null, no localStorage write occurs on field changes. |
| DRAFT-6 | Quota / unavailable storage | `localStorage.setItem` throwing must NOT propagate. (Mock by stubbing `setItem` to throw.) |
| DRAFT-7 | Corrupt draft | If `JSON.parse` fails or shape is invalid (missing `values`), `loadDraft` returns null and form uses defaults. |
| DRAFT-8 | Discard draft button | Calls `clearDraft`, hides banner, resets values, resets step to 0. |
| DRAFT-9 | Keep banner button | Hides banner but values are preserved. |
| DRAFT-10 | Submit success → draft cleared | After successful `onSubmit`, key `warehouseForm:draft:v1` is removed. |
| DRAFT-11 | Submit failure → draft retained | After `onSubmit` rejects, draft is still in localStorage so user can retry. |
| DRAFT-12 | Cancel resets form | `handleCancel` removes draft, hides banner, resets values, clears errors, calls `clearErrors()` (which destroys toasts) and parent `onCancel`. |

---

## 7. `WarehouseForm` — field-level behaviour

| ID | Scenario | Expected |
|---|---|---|
| FIELD-1 | `contactNumber` background patch | If parent updates `initialData.contactNumber` after open, and the user hasn't touched the field, the new number is patched in without resetting other fields. Touching the field once disables this background patch. |
| FIELD-2 | `totalSpaceSqft` add | "+ Add Space Value" appends an empty entry. |
| FIELD-3 | `totalSpaceSqft` remove | Remove (−) button only renders when length > 1; clicking removes the entry by index. |
| FIELD-4 | `totalSpaceSqft` numeric coercion | Empty input stays `''`; non-empty input is coerced via `Number(v)`. |
| FIELD-5 | `isBroker` toggle | ToggleSwitch flips between `'Yes'` and `'No'` strings (not booleans). |
| FIELD-6 | `is_builder` toggle | ToggleSwitch flips boolean `true` / `false`. |
| FIELD-7 | `ccRoads`, `insulationPresent` toggles | Stored as boolean; serialised to `'true'` / `'false'` string at submit time. |
| FIELD-8 | `fireNocAvailable`, `vaastuCompliance` toggles | Stored as boolean, sent as boolean (`Boolean(...)`) inside `warehouseData`. |
| FIELD-9 | `chargeableArea` invalid input | Decimal like `12.5` or negative → validation error on Step 2; integer like `1000` accepted. |

---

## 8. `WarehouseForm` — `SelectInput` `(current)` preservation

`SelectInput` renders a special `(current)` option when the saved value is non-empty and not in the `options` list.

| ID | Scenario | Expected |
|---|---|---|
| SEL-1 | New form, no value | Placeholder option shown and selected; no `(current)` option. |
| SEL-2 | Value matches an option | Option is selected; no `(current)` option. |
| SEL-3 | Value is off-list (e.g. `"Tin Shed"` in `warehouseType`) | Extra option `Tin Shed (current)` rendered and selected; submitting unchanged sends `"Tin Shed"`. |
| SEL-4 | Off-list value, user picks a standard option | The `(current)` option disappears on re-render. Submitting sends the new value. |
| SEL-5 | `data-field` attribute | Passed through via `{...rest}` so scroll-to-error still finds the `<select>`. |

Applies to: `listing_type`, `warehouseOwnerType`, `owner_warmnth`, `owner_of_multiple_sites`,
`zone`, `landType`, `pollutionZone`, `warehouseType`.

---

## 9. `WarehouseForm` — submit payload shape

Build a fully-populated form, submit, and capture the argument passed to `onSubmit`.

| ID | Expected payload assertion |
|---|---|
| PAY-1 | Top-level keys present: `warehouseOwnerType`, `warehouseType`, `address`, `googleLocation`, `city`, `state`, `postalCode`, `zone`, `contactPerson`, `contactNumber`, `totalSpaceSqft`, `numberOfDocks`, `clearHeightFt`, `compliances`, `otherSpecifications`, `ratePerSqft`, `availability`, `uploadedBy`, `isBroker`, `photos`, `media`, plus all newly-added fields, and a `warehouseData` object. |
| PAY-2 | `totalSpaceSqft` filtered: only entries `v != null && v > 0` are sent. |
| PAY-3 | Numeric fields sent as strings: `numberOfDocks`, `clearHeightFt`, `ratePerSqft`, `approachRoadWidth`, `powerKva` → `String(v)` if truthy, else `null`. |
| PAY-4 | `chargeableArea` sent as `Number` (not string) or `null`. |
| PAY-5 | `media` is `null` when no images/videos/docs uploaded; the object `{ images, videos, docs }` otherwise. |
| PAY-6 | `photos` is the legacy CSV string of all media URLs (images+videos+docs), or `null` if empty. |
| PAY-7 | `ccRoads` and `insulationPresent` booleans serialise to `'true'`/`'false'` strings. |
| PAY-8 | `warehouseData.vaastuCompliance` boolean serialises to `'true'`/`'false'` string. |
| PAY-9 | `warehouseData.fireNocAvailable` sent as raw boolean. |
| PAY-10 | Empty strings → `null` for optional text fields (e.g. `googleLocation: '' → null`). |
| PAY-11 | Submission ONLY occurs on the last step. Pressing Enter on an earlier step does NOT call `onSubmit`. |
| PAY-12 | Submission blocked while `mediaUploading` is true; an inline warning "Media is still uploading — submit will be enabled once it completes." is rendered. |
| PAY-13 | After successful submit: values reset to `INITIAL_VALUES`, `currentStep` reset to 0, draft cleared. |
| PAY-14 | After failed submit: values preserved, `currentStep` preserved, draft preserved. |

---

## 10. `FileUpload`

| ID | Scenario | Expected |
|---|---|---|
| FU-1 | Initial render | "Add Files" trigger visible; no thumbs/lists. |
| FU-2 | Classify by MIME | `image/jpeg` → images, `video/mp4` → videos, `application/pdf` → docs. |
| FU-3 | Classify by extension fallback | File with `type: ''` and name `clip.mov` → videos. |
| FU-4 | Unknown type rejected | `type: ''`, name `binary.xyz` → error toast "Unsupported file type…", no upload attempted. |
| FU-5 | Oversize rejected | File `> maxSize` (default 50 MB) → error toast "File must be smaller than 50MB!", no presigned-URL request. |
| FU-6 | `resolveMime` octet-stream fallback | File with `application/octet-stream` for `*.heic` → `image/heic` is sent to `getPresignedUrl`. |
| FU-7 | Happy-path upload | (a) `getPresignedUrl` called with `(mime, uploadedBy)`; (b) XHR PUT to `uploadUrl` with `Content-Type: <mime>` header; (c) success toast; (d) `onChange` called with new URL appended under the correct category. |
| FU-8 | Progress reporting | XHR `progress` event with `lengthComputable=true` updates `progress` from 10 → 95 → 100. |
| FU-9 | `onUploadingChange(true)` and `(false)` | True fires when first file starts, false fires when last in-flight upload settles. |
| FU-10 | Multiple files | Selecting 3 files iterates each through `processFile`; uploads run in parallel; all completed URLs appear in `onChange` payload. |
| FU-11 | Same file re-selected | After upload, `input.value = ''` is set so selecting the identical file again still triggers `onChange` on the input. |
| FU-12 | Remove button disabled while uploading | When `uploading` is true, Delete buttons are disabled. |
| FU-13 | Remove uploaded item | Clicking Delete on an existing URL removes it from the relevant category and calls `onChange`. |
| FU-14 | XHR error path | `error` event → reject with "Network error during upload" → `handleUploadError` toast; URL is NOT added to media. |
| FU-15 | XHR non-200 status | Resolves XHR with `status: 500` → reject with "Upload failed with status 500"; toast shown. |
| FU-16 | XHR timeout | `xhr.timeout = 120000`; firing `timeout` event → reject with "Upload timeout". |
| FU-17 | Disabled prop | `disabled` hides/blocks the trigger and input. |

---

## 11. `warehouseService` & `apiClient`

| ID | Scenario | Expected |
|---|---|---|
| API-1 | `apiClient` baseURL default | `http://localhost:3001/api` when `VITE_API_URL` unset. |
| API-2 | `apiClient` baseURL override | Respects `VITE_API_URL` env at build time. |
| API-3 | `apiClient` headers | Sends `Content-Type: application/json` and 30s timeout. |
| API-4 | `warehouseService.create` | POSTs to `/warehouses/scout`. |
| API-5 | `warehouseService.getPresignedUrl` | POSTs to `/warehouses/scout/presigned-url` with `{ contentType, uploadedBy }`. |
| API-6 | `warehouseService.uploadFileToR2` (legacy axios path) | PUTs to provided URL with `Content-Type: file.type`; `transformRequest` passes file through unchanged. |
| API-7 | R2 403 | Error message replaced with "Upload forbidden - invalid or expired presigned URL". |
| API-8 | R2 413 | Error message replaced with "File too large for upload". |
| API-9 | R2 network error (no response) | Error message replaced with "Network error during file upload". |
| API-10 | R2 unknown status (e.g. 500) | Error message becomes "File upload failed". |

> Note: `WarehouseForm`/`FileUpload` actually upload via `XMLHttpRequest` directly (not `uploadFileToR2`). The service method is still exported and must remain testable in case it's reused. Flag any production call site for cleanup if it stays unused.

---

## 12. `errorHandler`

| ID | Input | Expected `parseError` output |
|---|---|---|
| ERR-1 | `{ response: { status: 400, data: { error: 'Bad' } } }` | `{ type: 'validation', message: 'Bad', issues: [], statusCode: 400 }` |
| ERR-2 | `{ response: { status: 400, data: { details: { issues: [{ path: ['city'], message: 'required' }] } } } }` | `issues` length 1; `path` and `message` preserved. |
| ERR-3 | `{ response: { status: 401, data: {} } }` | message contains "Unauthorized — check your Employee ID". |
| ERR-4 | `{ response: { status: 403, data: {} } }` | message mentions "scout access may have been revoked". |
| ERR-5 | `{ response: { status: 404 } }` | type `not_found`, message "Warehouse not found". |
| ERR-6 | `{ response: { status: 500 } }` | type `server`. |
| ERR-7 | `{ response: { status: 418, data: { error: 'Teapot' } } }` | message `"Teapot"`. |
| ERR-8 | `{ request: {} }` (no response) | type `network`, message about checking connection. |
| ERR-9 | `{ message: 'foo' }` (request build error) | type `generic`, message `"foo"`. |
| ERR-10 | `handleUploadError` with `response.status=413` | toast message starts with `"Failed to upload <name>: File too large…"`. |
| ERR-11 | `handleOperationError(err, 'create')` with validation error | `showErrorNotification` is invoked (not the short toast variant) with title "Failed to create warehouse". |
| ERR-12 | `clearErrors()` | Toast container is emptied. |
| ERR-13 | `withRetry` succeeds on retry | Operation called twice; resolves with success value. |
| ERR-14 | `withRetry` on validation error | Does NOT retry; throws immediately after first attempt. |
| ERR-15 | `withRetry` exhausts retries | Calls `onError` with final `errorInfo` and re-throws. |

---

## 13. `toast.js`

| ID | Scenario | Expected |
|---|---|---|
| TOAST-1 | First `showToast` call | Creates `#app-toast-root` with `aria-live="polite"`, appends a child with class `toast--info` (default). |
| TOAST-2 | Type variants | `type: 'error'` → `toast--error`; `success` → `toast--success`. |
| TOAST-3 | Auto-dismiss | After `duration` ms, element gets `toast--out` then is removed (220 ms later). |
| TOAST-4 | Click to dismiss | Clicking the toast clears the timer and removes it. |
| TOAST-5 | Multi-line text | A message containing `\n` is rendered with `white-space: pre-wrap`. |
| TOAST-6 | `destroyAllToasts` | Empties the container without removing it. |
| TOAST-7 | SSR safety | Calling `showToast` when `document` is undefined returns silently. |

---

## 14. `mediaUtils.getMediaFromWarehouse`

| ID | Input | Output |
|---|---|---|
| MED-1 | `{ media: { images: ['a','b'], videos: [], docs: ['x'] } }` | Identical object returned. |
| MED-2 | `{ media: null, photos: 'http://a, http://b' }` | `{ images: ['http://a','http://b'], videos: [], docs: [] }` |
| MED-3 | `{ photos: '' }` | `{ images: [], videos: [], docs: [] }` |
| MED-4 | `{ photos: null }` | `{ images: [], videos: [], docs: [] }` |
| MED-5 | Mixed whitespace in CSV | Trims tokens; drops empty segments. |

---

## 15. `useViewport`

| ID | Scenario | Expected |
|---|---|---|
| VP-1 | Width 375 | `isMobile: true`, `isTablet: false`. |
| VP-2 | Width 768 | `isMobile: false`, `isTablet: true`. |
| VP-3 | Width 1024 | `isDesktop: true`. |
| VP-4 | Width 1500 | `isLarge: true`. |
| VP-5 | Resize event | After 150ms debounce, state updates exactly once for a burst of resize events. |
| VP-6 | Orientation | `width > height` → `landscape`. |
| VP-7 | `getResponsiveValue` precedence | large > desktop > tablet > mobile > default. |

---

## 16. Mobile-specific behaviour

| ID | Scenario | Expected |
|---|---|---|
| MOB-1 | `has-virtual-keyboard` class | When `window.visualViewport.height` < `window.innerHeight - 150`, the form root gets `has-virtual-keyboard`. (Stub `visualViewport`.) |
| MOB-2 | Keyboard hidden again | Restoring viewport height removes the class. |
| MOB-3 | Step indicator on mobile | Only current step's title is rendered. |
| MOB-4 | Action bar stack | Buttons stack vertically with `form-actions--stack` class on mobile. |

---

## 17. `SuccessPage`

| ID | Scenario | Expected |
|---|---|---|
| SUC-1 | With `warehouseId` | Renders the ID inside `.success-page__id-value`. |
| SUC-2 | Without `warehouseId` | Renders `'—'` placeholder. |
| SUC-3 | CTA | Click "Submit another warehouse" → calls `onStartOver`. |

---

## 18. End-to-end smoke (Playwright, against `vite preview`)

Run with MSW or a stub backend.

| ID | Scenario |
|---|---|
| E2E-1 | Happy path: fill all 6 steps with valid data, upload a small JPEG, submit → assert SuccessPage shows the returned ID. |
| E2E-2 | Required-field gating: try to click "Next" with empty Step 0 → assert page does not advance and toast shows. |
| E2E-3 | Draft restore: fill Step 0, reload the page → banner appears, values intact. |
| E2E-4 | Off-list value preservation: seed localStorage with a draft containing `warehouseType: "Tin Shed"` → reload → assert `Tin Shed (current)` option is selected; submit and inspect captured payload. |
| E2E-5 | Submit failure: stub 500 → assert form state is preserved and error toast appears. |
| E2E-6 | Submit blocked during upload: start a slow upload (stub R2 with 3-second delay), arrive at Step 5 → assert submit is disabled and "Media is still uploading…" notice visible; after upload, submit becomes enabled. |
| E2E-7 | Cancel-reset flow: fill Step 0, click Cancel, confirm dialog → form resets and draft is gone. |
| E2E-8 | Mobile viewport (375×812): assert action buttons stack and only current step title is shown in the indicator. |

---

## 19. Regression guards

| ID | What | Why |
|---|---|---|
| REG-1 | Snapshot of `INITIAL_VALUES` keys | Any accidental rename/removal of a field will fail. |
| REG-2 | Snapshot of submit payload keys | Catches accidental payload shape changes that would silently break backend contracts. |
| REG-3 | List of required `data-field` attributes | Required fields must all carry `data-field` so the scroll-into-view error UX keeps working. |
| REG-4 | `formSteps[].fields` covers every required field | Cross-check that every field validated in `getStepErrors` is also listed in the corresponding `formSteps` entry. |
| REG-5 | Dropdown option sets | `ZONES`, `LAND_TYPES`, `POLLUTION_ZONES`, `OWNER_TYPES`, `OWNER_WARMTH_OPTIONS`, `WAREHOUSE_TYPES` — snapshot the arrays. Add an explicit test that asserts `BTS`, `Multiple owners`, etc. remain. |
| REG-6 | Draft key constant | `DRAFT_STORAGE_KEY === 'warehouseForm:draft:v1'` — bumping this is a breaking change for in-flight drafts. |
| REG-7 | API endpoints | Pinned strings: `POST /warehouses/scout`, `POST /warehouses/scout/presigned-url`. |

---

## 20. Coverage targets (suggested)

| Module | Statements |
|---|---|
| `src/utils/errorHandler.js` | ≥ 90 % |
| `src/utils/mediaUtils.js` | 100 % |
| `src/utils/toast.js` | ≥ 80 % (DOM side effects) |
| `src/components/FileUpload.jsx` | ≥ 75 % |
| `src/components/WarehouseForm.jsx` | ≥ 70 % (large file; focus on submit + validation paths) |
| `src/services/*` | ≥ 80 % |

CI should fail the build if global coverage drops below the previous baseline by more than 2 percentage points.

---

## 21. Open follow-ups (not test items, but discovered while drafting)

- `warehouseService.uploadFileToR2` is not used by the UI today (`FileUpload` uses raw `XHR`). Decide: delete or wire it back. Tests for it kept here in case it's reused.
- `withRetry` in `errorHandler.js` is not called anywhere; consider removing or covering with an explicit consumer.
- `BROKER_OPTIONS` was previously defined in the Dashboard form but unused — Scout doesn't define it but the toggle equivalent stores `'Yes'`/`'No'`. Consider unifying to booleans across both forms.
- `loadDraft` does not check `savedAt` age. Decide if stale drafts (e.g. > 7 days) should be discarded; add a test once policy is set.
