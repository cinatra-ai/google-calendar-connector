# External Integrations

**Analysis Date:** 2026-06-09

## APIs & External Services

**Google Calendar Appointment Scheduling:**
- Service: `calendar.app.google` — public booking page URLs
- SDK/Client: native `fetch` API (no Google SDK dependency)
- Auth: None — only public scheduling URLs are supported; `isPublicScheduleUrl()` enforces `hostname === "calendar.app.google"`
- Usage: `src/index.ts` — `fetchAppointmentSchedule()` issues HTTP GET to public booking pages to scrape title/description from HTML meta tags (`og:title`, `og:description`, `<title>`)
- User-Agent: `Cinatra/1.0` sent with every scrape request

**Nango (OAuth Connection Management):**
- Service: Nango — manages the user's Google Calendar OAuth connection
- SDK/Client: `@cinatra-ai/sdk-ui/nango` — `NangoUserConnectButton` component; host port `ctx.nango.*`
- Auth: Host port injection — `ctx.nango.getFrontendConfig()`, `ctx.nango.getPrimarySavedConnections({ scope: "user", userId })`
- Usage: `src/setup-page.tsx` — renders OAuth connect/reconnect button for `connectorKey: "googleCalendar"`
- Note: Nango integration is mediated entirely through the Cinatra host port (`requestedHostPorts: ["nango"]`); the connector carries no direct `@cinatra-ai/nango-connector` import

## Data Storage

**Databases:**
- Type: Host-provided key-value connector config store
- Connection: No direct DB connection — injected via `GoogleCalendarConnectorDeps` interface (`src/deps.ts`)
- Client: `readConnectorConfigFromDatabase<T>(connectorId, fallback)` / `writeConnectorConfigToDatabase(connectorId, value)` — concrete implementation bound by host at boot via `registerGoogleCalendarConnector(deps)` (`src/deps.ts`)
- Connector IDs: `"google_calendar"` (workspace-scoped) and `"google_calendar_user:{userId}"` (user-scoped)
- Schema: `GoogleCalendarSettings` — `{ calendarAppointments?: StoredCalendarAppointment[], calendarAppointmentsSyncedAt?: string }` (`src/index.ts`)

**File Storage:**
- Not applicable

**Caching:**
- Not applicable — `fetchAppointmentSchedule()` sets `cache: "no-store"` explicitly

## Authentication & Identity

**Auth Provider:**
- Host-provided auth session port (`ctx.authSession`) — `ExtensionHostContext` from `@cinatra-ai/sdk-extensions`
- Implementation: `ctx.authSession.getActor()` in `src/setup-page.tsx` to resolve `userId` before reading user-scoped appointments
- Action guard: `requireExtensionAction(GOOGLE_CALENDAR_PACKAGE_ID, "read")` in `src/setup-actions.ts` — enforces workspace-member permission before any write
- Session userId: injected via `GoogleCalendarConnectorDeps.requireSessionUserId()` so the connector holds no direct `@/lib/*` auth import (`src/deps.ts`, `src/setup-actions.ts`)

## MCP (Model Context Protocol)

**Host Port:** `mcp` — requested in `package.json` `cinatra.requestedHostPorts`
- Static tool registration: `src/mcp/registry.ts` — `registerGoogleCalendarPrimitives(server)` registers the `google_calendar_appointments_list` tool
- Dynamic tool registration: `src/register.ts` — `register(ctx)` registers `google_calendar_extension_selfcheck` diagnostic tool via `ctx.mcp.registerTool`
- Tool schemas: Zod (`z.object({})`) for input validation (`src/mcp/registry.ts`)

## Settings Port

**Host Port:** `settings` — requested in `package.json` `cinatra.requestedHostPorts`
- Used in `src/register.ts` selfcheck handler for diagnostics: `ctx.settings.set`, `ctx.settings.get`, `ctx.settings.delete`

## Monitoring & Observability

**Error Tracking:**
- Not detected — errors surface via thrown `Error` instances caught by Next.js server action flow in `src/setup-actions.ts`, redirected to setup page with `?error=` query param

**Logs:**
- No structured logging framework detected; connector relies on host environment logging

## CI/CD & Deployment

**Hosting:**
- Deployed inside the cinatra host monorepo as a connector extension; not independently hosted

**CI Pipeline:**
- GitHub Actions — `.github/workflows/ci.yml` (push/PR to `main`)
  - Node.js 24, corepack/pnpm
  - Classifies as "source mirror" (has `@cinatra-ai/*` optional peers) and skips standalone install/typecheck/test
  - Validates first-party dep shape: enforces `@cinatra-ai/*` packages appear only as optional peerDependencies
- GitHub Actions — `.github/workflows/release.yml` (present but contents not fully read)

## Webhooks & Callbacks

**Incoming:**
- Not applicable — connector does not expose webhook endpoints

**Outgoing:**
- Not applicable — connector scrapes public URLs via `fetch` on demand; no webhook dispatching

## Environment Configuration

**Required env vars:**
- None declared directly by this connector — all auth, DB, and Nango credentials are injected by the host via the `GoogleCalendarConnectorDeps` interface and `ExtensionHostContext` ports
- `.env` / `.env.*` files: not present in this repo (connector is host-embedded)

**Secrets location:**
- All secrets managed by the cinatra host monorepo; this connector is secret-free by design (host-port inversion pattern)

## Dev Fixtures

**`cinatra/dev-fixtures.json`:**
- Provides a single fixture: `setting` surface, key `demoDefaultCalendarView`, value `"month"` — used for local development within the Cinatra platform

---

*Integration audit: 2026-06-09*
