# Codebase Concerns

**Analysis Date:** 2026-06-09

## Tech Debt

**Global mutable singleton for dependency injection:**
- Issue: `_deps` in `src/deps.ts` is a module-level mutable singleton. Re-registration silently overwrites the previous deps with no warning, and there is no idempotency guard.
- Files: `src/deps.ts`
- Impact: In test environments (or if the host accidentally calls `registerGoogleCalendarConnector` more than once), the second call silently replaces deps. A crash-after-register scenario leaves the global in a bad state until the process restarts.
- Fix approach: Add an "already registered" guard that either no-ops (idempotent) or throws on re-registration, similar to how other singleton registries handle double-init.

**`writeSettings` is fire-and-forget (no await/return):**
- Issue: `writeConnectorConfigToDatabase` in `src/deps.ts` is typed as `void` (not `Promise<void>`), making it synchronous or unobservably async. Callers in `src/index.ts` (`writeSettings(...)`) never handle a potential async failure.
- Files: `src/deps.ts`, `src/index.ts`
- Impact: If the host implementation is actually async, write failures are silently swallowed. Data written after `writeSettings` returns may not have been persisted.
- Fix approach: Type `writeConnectorConfigToDatabase` as `() => void | Promise<void>` and add `await` at call sites, or document the sync contract explicitly in the interface.

**`addGoogleCalendarAppointmentSchedule` and `addUserGoogleCalendarAppointmentSchedule` are near-duplicates:**
- Issue: `src/index.ts` contains two almost-identical functions (`addGoogleCalendarAppointmentSchedule` at line 147 and `addUserGoogleCalendarAppointmentSchedule` at line 168) that differ only in whether a `userId` is passed. The same pattern applies to `clearStoredGoogleCalendarAppointments` / `clearStoredUserGoogleCalendarAppointments`.
- Files: `src/index.ts`
- Impact: Any bug fix or behavior change must be applied in two places. Already diverged slightly (the non-user variant sets `calendarAppointmentsSyncedAt`; both currently do, but the risk of future divergence is high).
- Fix approach: Merge into single functions with an optional `userId?: string` parameter, matching the pattern already used by `getStoredGoogleCalendarAppointments` and `readSettings`/`writeSettings`.

**Hardcoded setup page path string:**
- Issue: `SETUP_PAGE` in `src/setup-actions.ts` is a hardcoded string literal (`"/connectors/cinatra-ai/google-calendar-connector/setup"`).
- Files: `src/setup-actions.ts`
- Impact: If the dispatch route path changes in the host, this string silently breaks redirect behavior after save/error without a type or compile-time error.
- Fix approach: Derive or import the path from a shared constant, or accept it as a parameter injected at registration time.

**`cinatra/dev-fixtures.json` fixture mismatch:**
- Issue: `cinatra/dev-fixtures.json` declares a fixture for `demoDefaultCalendarView` (a generic calendar view setting), but the connector's actual data model revolves around appointment schedules. No fixture exists for `calendarAppointments` or `calendarAppointmentsSyncedAt`.
- Files: `cinatra/dev-fixtures.json`
- Impact: Developers running local fixtures get a fixture that does not exercise the connector's real data path, making local dev/testing misleading.
- Fix approach: Replace or augment the fixture with a `calendarAppointments` entry that seeds at least one sample appointment schedule.

## Known Bugs

**`refreshGoogleCalendarAppointments` uses global (non-user) scope only:**
- Symptoms: `refreshGoogleCalendarAppointments` in `src/index.ts` (line 131) always reads and writes to the global `google_calendar` connector ID (no `userId`), even though the connector stores appointments per-user via `google_calendar_user:{userId}`.
- Files: `src/index.ts`
- Trigger: Calling `refreshGoogleCalendarAppointments` refreshes the wrong (shared, non-user) store when the connector is used in user-scoped mode.
- Workaround: None; the function is exported and may be called by the host for background refresh jobs.

**`normalizeBookingPageUrl` can throw inside `fetchAppointmentSchedule` after a successful fetch:**
- Symptoms: `normalizeBookingPageUrl` (line 44) is called AFTER `fetchAppointmentSchedule` already fetched the URL and validated it with `isPublicScheduleUrl`. However, `normalizeBookingPageUrl` re-validates protocol and hostname — if the redirect chain caused the final URL to differ, the throw occurs after the network cost is paid.
- Files: `src/index.ts`
- Trigger: Rare; only if the fetch follows a redirect to a non-`calendar.app.google` URL.
- Workaround: The error is surfaced to the user via the form's error redirect, so UX degrades gracefully but the fetch is wasted.

## Security Considerations

**HTML title/meta extraction via regex on untrusted external content:**
- Risk: `extractMetaContent` and `extractTitle` in `src/index.ts` use regex on raw HTML fetched from an external URL. While the connector validates the hostname to `calendar.app.google`, a compromised or malicious page at that hostname could embed content that, when stored and later rendered in the setup page, causes XSS if the host or UI does not escape output.
- Files: `src/index.ts`, `src/setup-page.tsx`
- Current mitigation: React's JSX rendering in `src/setup-page.tsx` auto-escapes string interpolation, providing XSS protection at the display layer. No HTML is injected as raw markup.
- Recommendations: Add a max-length cap on stored `title` and `description` fields to prevent abnormally large payloads being written to the database. Consider sanitizing extracted strings (strip control characters, trim to a reasonable length like 512 chars) before storage.

**User-supplied URL is fetched server-side without rate limiting:**
- Risk: Any authenticated workspace member can submit arbitrary `calendar.app.google` URLs, causing the server to make outbound HTTP requests on their behalf (SSRF-adjacent; limited to `calendar.app.google` by `normalizeBookingPageUrl`).
- Files: `src/index.ts` (lines 72-104), `src/setup-actions.ts`
- Current mitigation: Hostname is validated to `calendar.app.google` before fetch and protocol is restricted to `https:`. `requireExtensionAction(..., "read")` gate restricts to authenticated workspace members.
- Recommendations: Add a per-user rate limit on the add-schedule action to prevent rapid-fire fetches. Consider capping the total number of saved schedules per user.

**No `.env` files detected** — environment configuration is injected via host DI at runtime, which is appropriate.

## Performance Bottlenecks

**`refreshGoogleCalendarAppointments` fetches all schedules in parallel with no concurrency limit:**
- Problem: `Promise.all(...)` in `src/index.ts` (line 133) fires one HTTP request per stored appointment simultaneously.
- Files: `src/index.ts`
- Cause: No concurrency control (e.g., `p-limit`) or batching.
- Improvement path: If appointment counts grow large, add a concurrency limiter. For current typical usage (a handful of schedules per user) this is low risk.

**`getStoredGoogleCalendarAppointments` triggers a write on every read when invalid appointments are found:**
- Problem: Every call to `getStoredGoogleCalendarAppointments` that finds sanitized appointments different from stored ones (line 110-115) immediately calls `writeSettings`, which is a database write on the hot read path.
- Files: `src/index.ts`
- Cause: Inline sanitization side-effect on read.
- Improvement path: Separate the sanitization cleanup into a dedicated maintenance step rather than performing it on every read call.

## Fragile Areas

**Dependency injection singleton (`src/deps.ts`):**
- Files: `src/deps.ts`
- Why fragile: All connector functionality (`readSettings`, `writeSettings`, `requireSessionUserId`) fails at runtime with an uninformative error if `registerGoogleCalendarConnector` was not called. There is no lazy fallback or graceful degradation.
- Safe modification: Always call `registerGoogleCalendarConnector(deps)` before any connector function. In tests, call `_resetGoogleCalendarDepsForTests()` in `afterEach`.
- Test coverage: No test files exist in this repo (tests run in the host monorepo). The `_resetGoogleCalendarDepsForTests` export exists but is untested here.

**MCP handler hardcodes actor/mode context:**
- Files: `src/mcp/registry.ts` (lines 29-32)
- Why fragile: The `actor` and `mode` fields passed to each handler are hardcoded (`actorType: "model"`, `source: "agent"`, `mode: "agentic"`). If handler logic branches on these values, all MCP-registered tools will behave identically regardless of actual invocation context.
- Safe modification: Pass actual invocation context if/when the `ExtensionMcpToolServer` API surfaces it.
- Test coverage: No tests.

## Scaling Limits

**Per-user appointment schedule storage:**
- Current capacity: Unbounded — the connector places no cap on the number of appointment schedules a user can store.
- Limit: Limited only by the host database's document size constraints for the connector config record.
- Scaling path: Add a max-schedules-per-user check in `addUserGoogleCalendarAppointmentSchedule` before pushing to the array.

## Dependencies at Risk

**`lucide-react` used indirectly but not declared:**
- Risk: `src/setup-page.tsx` imports `LinkIcon` from `lucide-react` (line 14), but `lucide-react` does not appear in `package.json` dependencies or peerDependencies.
- Impact: The build succeeds only because the host monorepo provides `lucide-react`. If extracted or used outside the monorepo, this import will fail at resolution time.
- Migration plan: Add `lucide-react` as an optional peerDependency with `peerDependenciesMeta.optional: true`, matching the pattern for other host-provided packages.

**`next/navigation` import in a connector package:**
- Risk: `src/setup-actions.ts` imports `redirect` from `next/navigation`. This couples the connector to Next.js, making it unusable in a non-Next.js host.
- Files: `src/setup-actions.ts`
- Impact: Any host not running Next.js cannot use `setup-actions`.
- Migration plan: Accept a redirect callback via the DI deps interface, or document the Next.js host requirement explicitly in README.

## Missing Critical Features

**No delete/remove schedule action:**
- Problem: Users can add appointment schedules via the setup page but there is no UI or server action to remove a single schedule. Only `clearStoredUserGoogleCalendarAppointments` (wipes all) and `clearStoredGoogleCalendarAppointments` (global wipe) exist.
- Blocks: Self-service schedule management — users cannot remove a stale or incorrect schedule without an admin clearing all schedules.

**`refreshGoogleCalendarAppointments` has no user-scoped variant:**
- Problem: Background refresh of appointment metadata (title, description, lastFetchedAt) only works on the global (non-user) store. User-scoped schedules are never refreshed automatically.
- Blocks: Keeping user-scoped appointment schedule titles/descriptions up to date without manual re-add.

## Test Coverage Gaps

**No tests in this repository:**
- What's not tested: All logic in `src/index.ts` — URL validation, HTML parsing, appointment deduplication, sanitization side-effect on read, sort behavior, and the DI singleton lifecycle.
- Files: `src/index.ts`, `src/deps.ts`, `src/mcp/registry.ts`, `src/mcp/handlers.ts`
- Risk: Regressions in URL validation (`isPublicScheduleUrl`, `normalizeBookingPageUrl`), HTML extraction (`extractMetaContent`, `extractTitle`), or deduplication logic (`findIndex` by `bookingPageUrl`) will not be caught until they surface in production.
- Priority: High — `src/index.ts` contains non-trivial parsing and mutation logic with no automated coverage at the package level. The CI pipeline explicitly skips tests for source-mirror repos that declare `@cinatra-ai/*` optional peers, so these gaps are invisible to CI unless the host monorepo includes the tests.

---

*Concerns audit: 2026-06-09*
