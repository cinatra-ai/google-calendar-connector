<!-- refreshed: 2026-06-09 -->
# Architecture

**Analysis Date:** 2026-06-09

## System Overview

```text
┌──────────────────────────────────────────────────────────────┐
│                     Host Application                         │
│  (Next.js app — registers deps at boot, routes setup page)   │
└──────┬────────────────────┬──────────────────────────────────┘
       │ registerGoogleCalendarConnector(deps)   ExtensionHostContext
       ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│              Connector Public API  (src/index.ts)            │
│  getStoredGoogleCalendarAppointments()                       │
│  addGoogleCalendarAppointmentSchedule()                      │
│  addUserGoogleCalendarAppointmentSchedule()                  │
│  refreshGoogleCalendarAppointments()                         │
│  clearStoredGoogleCalendarAppointments()                     │
└──────┬──────────────────┬──────────────────────────────────┘
       │                  │
       ▼                  ▼
┌────────────┐   ┌─────────────────────────────────────────┐
│  src/deps  │   │  HTTP fetch (calendar.app.google pages)  │
│  (DI sink) │   │  fetchAppointmentSchedule()              │
└────────────┘   └─────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│   Host-injected database callbacks                           │
│   readConnectorConfigFromDatabase / writeConnectorConfigToDatabase │
└──────────────────────────────────────────────────────────────┘
```

Secondary surface layers (UI + MCP) call back into the Public API:

```text
src/setup-page.tsx  ──► src/index.ts (getStoredGoogleCalendarAppointments)
src/setup-actions.ts ──► src/index.ts (addUserGoogleCalendarAppointmentSchedule)
src/mcp/handlers.ts  ──► src/index.ts (getStoredGoogleCalendarAppointments)
src/register.ts      ──► @cinatra-ai/sdk-extensions ctx (MCP + settings ports)
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Public API | CRUD for stored appointment schedules; fetches remote page metadata | `src/index.ts` |
| DI container | Module-level singleton holding host-injected runtime deps; validated at call time | `src/deps.ts` |
| Server entry | Registers diagnostic selfcheck MCP tool via `ExtensionHostContext` | `src/register.ts` |
| MCP registry | Declares MCP tool metadata (description, Zod schema) and wires handlers to `server.registerTool` | `src/mcp/registry.ts` |
| MCP handlers | Calls `getStoredGoogleCalendarAppointments` and shapes response for the MCP protocol | `src/mcp/handlers.ts` |
| MCP module | Factory that returns `{ registerCapabilities }` consumed by SDK host | `src/mcp/module.ts` |
| Setup page | React Server Component (Next.js) for the connector's `/setup` route | `src/setup-page.tsx` |
| Setup actions | Next.js Server Action: validates auth, resolves userId, calls `addUserGoogleCalendarAppointmentSchedule` | `src/setup-actions.ts` |
| UI primitives | Headless-style Radix/CVA components (button, input, alert, etc.) local to the connector | `src/components/ui/` |

## Pattern Overview

**Overall:** Dependency-injection connector with three independently-importable surface layers (MCP, setup UI, server entry).

**Key Characteristics:**
- No direct `@/lib/*` host imports. All host coupling is inverted through `GoogleCalendarConnectorDeps` in `src/deps.ts`.
- The connector is a source-distributed npm package (no build step; `"main": "src/index.ts"`).
- Three named package exports cover server (`./register`), UI (`./setup-page`, `./setup-actions`), and MCP (`./mcp-module`, `./mcp-handlers`) without cross-contaminating each other.
- State is fully delegated to the host database; the connector is stateless between calls.

## Layers

**Public API Layer:**
- Purpose: Core domain logic — URL validation, HTML scraping, appointment CRUD
- Location: `src/index.ts`
- Contains: Pure functions and exported async functions; types `StoredCalendarAppointment`, `GoogleCalendarSettings`
- Depends on: `src/deps.ts` (via `getGoogleCalendarDeps()`), native `fetch`
- Used by: `src/mcp/handlers.ts`, `src/setup-page.tsx`, `src/setup-actions.ts`

**DI / Dependency Layer:**
- Purpose: Module-level singleton holding host-injected callbacks; validated at access time
- Location: `src/deps.ts`
- Contains: `GoogleCalendarConnectorDeps` interface, `registerGoogleCalendarConnector`, `getGoogleCalendarDeps`, `_resetGoogleCalendarDepsForTests`
- Depends on: Nothing (no imports)
- Used by: `src/index.ts`, `src/setup-actions.ts`

**MCP Surface Layer:**
- Purpose: Expose connector capabilities to AI agents via the MCP protocol
- Location: `src/mcp/`
- Contains: `module.ts` (factory), `registry.ts` (tool declaration + Zod schemas), `handlers.ts` (logic adapters)
- Depends on: `src/index.ts`, `@cinatra-ai/sdk-extensions`
- Used by: Host SDK MCP server via the `./mcp-module` export

**Server Entry Layer:**
- Purpose: Register a diagnostic selfcheck MCP tool using the `ExtensionHostContext` port API
- Location: `src/register.ts`
- Contains: `register(ctx)` function; `SELFCHECK_TOOL_NAME` constant
- Depends on: `@cinatra-ai/sdk-extensions`
- Used by: Host boot sequence via the `./register` export; declared as `"serverEntry"` in `package.json#cinatra`

**Setup UI Layer:**
- Purpose: React Server Component setup page + co-located Server Action for the connector's admin/user config surface
- Location: `src/setup-page.tsx`, `src/setup-actions.ts`
- Contains: Default-exported async RSC, form rendering, Nango connection section
- Depends on: `src/index.ts`, `src/deps.ts`, `@cinatra-ai/sdk-extensions`, `@cinatra-ai/sdk-ui`, local UI primitives
- Used by: Host Next.js routing dispatch for `/connectors/cinatra-ai/google-calendar-connector/setup`

**UI Primitives Layer:**
- Purpose: Locally-vendored Radix + CVA + Tailwind components scoped to this connector
- Location: `src/components/ui/`
- Contains: `alert.tsx`, `button.tsx`, `field.tsx`, `input-group.tsx`, `input.tsx`, `label.tsx`, `separator.tsx`, `textarea.tsx`
- Depends on: `radix-ui`, `class-variance-authority`, `clsx`, `tailwind-merge`
- Used by: `src/setup-page.tsx`

## Data Flow

### Appointment Schedule Add (user-initiated via setup UI)

1. User submits form on setup page → `addGoogleCalendarAppointmentScheduleAction(formData)` (`src/setup-actions.ts:25`)
2. `requireExtensionAction(pkg, "read")` gates the action (host SDK)
3. `getGoogleCalendarDeps().requireSessionUserId()` resolves current user id
4. `addUserGoogleCalendarAppointmentSchedule(userId, url)` called (`src/index.ts:168`)
5. `fetchAppointmentSchedule(url)` hits `calendar.app.google` and scrapes og/twitter/title meta tags (`src/index.ts:72`)
6. Merged appointment list written via `writeConnectorConfigToDatabase` (host callback)
7. Next.js `redirect` to `/setup?saved=1`

### MCP Tool Invocation (agent listing appointments)

1. AI agent calls MCP tool `google_calendar_appointments_list`
2. `registerGoogleCalendarPrimitives` routes call to handler (`src/mcp/registry.ts:12`)
3. Handler calls `getStoredGoogleCalendarAppointments()` (`src/mcp/handlers.ts:7`)
4. `readConnectorConfigFromDatabase` fetches persisted settings (host callback)
5. Appointments are sanitized (only `calendar.app.google` URLs kept) and returned as JSON

### Diagnostic Selfcheck (server entry registration)

1. Host boot calls `register(ctx)` (`src/register.ts:17`)
2. `ctx.mcp.registerTool` registers `google_calendar_extension_selfcheck`
3. On invocation: settings round-trip via `ctx.settings.set/get/delete` proves port wiring

**State Management:**
- No in-process state. Settings are read/written exclusively through host-injected `readConnectorConfigFromDatabase` / `writeConnectorConfigToDatabase`. The DI singleton in `src/deps.ts` is the only module-level mutable variable.

## Key Abstractions

**GoogleCalendarConnectorDeps:**
- Purpose: Interface that decouples the connector from host `@/lib/*` imports
- Examples: `src/deps.ts`
- Pattern: Module-level singleton with `register`/`get` functions; test helper `_resetGoogleCalendarDepsForTests` for isolation

**StoredCalendarAppointment:**
- Purpose: Persisted representation of a public Google Calendar appointment schedule
- Examples: `src/index.ts:7`
- Pattern: Plain object type; id derived from URL path; validated on read via `isPublicScheduleUrl`

**ExtensionHostContext:**
- Purpose: Host-provided context object surfacing ports (`mcp`, `settings`, `authSession`, `nango`)
- Examples: `src/register.ts`, `src/setup-page.tsx`
- Pattern: Passed at setup-page render time and at `register(ctx)` call; connector never constructs it

## Entry Points

**`./register` (serverEntry):**
- Location: `src/register.ts`
- Triggers: Host boot sequence (declared as `"serverEntry"` in `package.json#cinatra`)
- Responsibilities: Registers the selfcheck MCP tool through the host extension port

**`./mcp-module`:**
- Location: `src/mcp/module.ts`
- Triggers: Host MCP server initialization
- Responsibilities: Returns `{ registerCapabilities }` factory used to bind MCP tools

**`./setup-page`:**
- Location: `src/setup-page.tsx`
- Triggers: Host Next.js dispatch route for `/connectors/cinatra-ai/google-calendar-connector/setup`
- Responsibilities: Renders Nango connection card, appointment form, saved schedules list

**`./setup-actions`:**
- Location: `src/setup-actions.ts`
- Triggers: Form submission on the setup page
- Responsibilities: Auth-gated Server Action to add a user-scoped appointment schedule

**`.` (default):**
- Location: `src/index.ts`
- Triggers: Import by host for direct API calls (e.g. refresh, clear)
- Responsibilities: Exports all core CRUD functions and re-exports DI registration helpers

## Architectural Constraints

- **No host imports:** All `@/lib/*` coupling removed; host binds deps via `registerGoogleCalendarConnector(deps)` at boot.
- **Source distribution:** No build step. The package ships `.ts`/`.tsx` files directly; the host's bundler compiles them.
- **Global state:** Single module-level `_deps` variable in `src/deps.ts`. Safe because it is set once at boot and never mutated after.
- **Circular imports:** None detected. `src/index.ts` → `src/deps.ts` only; surface layers → `src/index.ts` only.
- **React version:** Peer-depends on React 19 (RSC + Server Actions).

## Anti-Patterns

### Importing from sibling connector packages

**What happens:** A connector imports from `@cinatra-ai/nango-connector` or `@cinatra-ai/connectors` directly.
**Why it's wrong:** Creates hard cross-connector coupling that prevents independent deployment and versioning.
**Do this instead:** Use the `ctx.nango.*` host port injected via `ExtensionHostContext` as shown in `src/setup-page.tsx:51-53`.

### Calling `getGoogleCalendarDeps()` before `registerGoogleCalendarConnector`

**What happens:** Any exported function from `src/index.ts` is called before the host has registered deps.
**Why it's wrong:** `getGoogleCalendarDeps()` throws immediately with a clear error message, crashing the call site.
**Do this instead:** Ensure `registerGoogleCalendarConnector(deps)` is called during host boot (see `"serverEntry"` in `package.json#cinatra`).

## Error Handling

**Strategy:** Throw-on-invalid-input; caller catches and redirects (setup actions) or propagates (MCP handlers).

**Patterns:**
- `normalizeBookingPageUrl` throws `Error` with user-facing message on bad URLs (`src/index.ts:44`)
- `fetchAppointmentSchedule` throws on non-OK HTTP response (`src/index.ts:77`)
- `setup-actions.ts` catches errors and redirects to setup page with `?error=` query param (`src/setup-actions.ts:35-38`)
- `getGoogleCalendarDeps()` throws if deps not registered, giving a clear boot-order diagnostic

## Cross-Cutting Concerns

**Logging:** Not present — no logging framework or console calls detected.
**Validation:** URL validation via `isPublicScheduleUrl` (hostname check) and `normalizeBookingPageUrl` (protocol + hostname enforcement) in `src/index.ts`.
**Authentication:** Delegated to host via `requireExtensionAction(pkg, "read")` (setup action) and `ctx.authSession.getActor()` (setup page). Connector never handles auth tokens directly.

---

*Architecture analysis: 2026-06-09*
