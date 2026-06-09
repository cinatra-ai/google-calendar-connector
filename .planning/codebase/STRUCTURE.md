# Codebase Structure

**Analysis Date:** 2026-06-09

## Directory Layout

```
google-calendar-connector/
├── cinatra/                    # Cinatra platform metadata
│   └── dev-fixtures.json       # Dev-mode fixture data for local testing
├── src/                        # All source code (shipped as-is; no build step)
│   ├── components/
│   │   └── ui/                 # Locally-vendored Radix/CVA/Tailwind UI primitives
│   │       ├── alert.tsx
│   │       ├── button.tsx
│   │       ├── field.tsx
│   │       ├── input-group.tsx
│   │       ├── input.tsx
│   │       ├── label.tsx
│   │       ├── separator.tsx
│   │       └── textarea.tsx
│   ├── mcp/                    # MCP protocol surface layer
│   │   ├── handlers.ts         # Tool handler implementations
│   │   ├── module.ts           # Module factory (registerCapabilities)
│   │   └── registry.ts         # Tool declaration + Zod schemas
│   ├── deps.ts                 # DI singleton (GoogleCalendarConnectorDeps)
│   ├── index.ts                # Public API + re-exports
│   ├── register.ts             # Server entry (selfcheck MCP tool)
│   ├── setup-actions.ts        # Next.js Server Action for setup form
│   └── setup-page.tsx          # React Server Component for setup route
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── release.yml
├── .npmrc
├── package.json                # Cinatra connector manifest + npm metadata
├── tsconfig.json
└── LICENSE
```

## Directory Purposes

**`src/`:**
- Purpose: All connector source code, distributed without compilation
- Contains: Public API, DI container, MCP surface, setup UI, UI primitives
- Key files: `src/index.ts` (public API), `src/deps.ts` (DI), `src/register.ts` (server entry)

**`src/mcp/`:**
- Purpose: MCP protocol surface — tool declarations, Zod input schemas, response shaping
- Contains: `module.ts`, `registry.ts`, `handlers.ts`
- Key files: `src/mcp/registry.ts` (canonical tool metadata location)

**`src/components/ui/`:**
- Purpose: Locally-vendored headless UI components for the setup page; avoids host UI library dependency
- Contains: Radix-UI-based components styled with CVA + Tailwind
- Key files: `src/components/ui/button.tsx`, `src/components/ui/input-group.tsx`

**`cinatra/`:**
- Purpose: Platform-specific configuration consumed by the Cinatra host tooling
- Contains: `dev-fixtures.json` for dev-mode fixture seeding
- Key files: `cinatra/dev-fixtures.json`

**`.github/workflows/`:**
- Purpose: CI and release automation
- Contains: `ci.yml`, `release.yml`

## Key File Locations

**Entry Points:**
- `src/index.ts`: Default package export; public CRUD API + re-exports DI helpers
- `src/register.ts`: `"serverEntry"` export (`./register`); called by host at boot
- `src/mcp/module.ts`: `"./mcp-module"` export; MCP capability factory
- `src/mcp/handlers.ts`: `"./mcp-handlers"` export; MCP tool handler implementations
- `src/setup-page.tsx`: `"./setup-page"` export; React Server Component
- `src/setup-actions.ts`: `"./setup-actions"` export; Next.js Server Action

**Configuration:**
- `package.json`: npm metadata, peer deps, and `"cinatra"` manifest block (kind, serverEntry, requestedHostPorts, sdkAbiRange)
- `tsconfig.json`: TypeScript configuration
- `.npmrc`: npm registry configuration

**Core Logic:**
- `src/index.ts`: URL validation, HTML scraping, appointment CRUD, settings read/write
- `src/deps.ts`: Dependency interface definition and DI singleton management

**Testing:**
- No test files detected in the repository.

## Naming Conventions

**Files:**
- kebab-case for multi-word filenames: `setup-page.tsx`, `setup-actions.ts`, `input-group.tsx`
- Single-word files use no separator: `deps.ts`, `index.ts`, `register.ts`
- UI primitive files named after their component: `button.tsx`, `alert.tsx`

**Directories:**
- kebab-case: `src/components/ui/`
- Short, purpose-scoped names: `mcp/` not `mcp-surface/`

**Functions:**
- camelCase; verb-first for actions: `getStoredGoogleCalendarAppointments`, `addUserGoogleCalendarAppointmentSchedule`, `fetchAppointmentSchedule`
- Internal helpers: concise camelCase: `buildScheduleId`, `extractMetaContent`, `sanitizeAppointments`

**Types:**
- PascalCase interfaces/types: `GoogleCalendarConnectorDeps`, `StoredCalendarAppointment`, `GoogleCalendarSettings`

**MCP tool names:**
- snake_case string literals: `google_calendar_appointments_list`, `google_calendar_extension_selfcheck`

**Connector ID keys:**
- snake_case with colon-separated user scope: `google_calendar`, `google_calendar_user:{userId}`

## Where to Add New Code

**New MCP tool:**
1. Add handler in `src/mcp/handlers.ts` (add key to the returned `const` object)
2. Add tool metadata entry in `TOOL_META` in `src/mcp/registry.ts`
3. No changes to `module.ts` — the registry loop handles registration automatically

**New public API function:**
- Implementation: `src/index.ts` (export directly from this file)
- If the function needs host capabilities: route through `getGoogleCalendarDeps()` from `src/deps.ts`
- If it's a new host capability: add to `GoogleCalendarConnectorDeps` in `src/deps.ts`

**New setup UI section:**
- Add UI to `src/setup-page.tsx`
- Add corresponding Server Action to `src/setup-actions.ts` if form submission is needed

**New UI primitive component:**
- Implementation: `src/components/ui/{component-name}.tsx`
- Follow existing pattern: Radix primitive + CVA variants + `cn()` from `src/lib/utils.ts`

**Utilities:**
- Shared helpers: `src/lib/utils.ts` (currently contains `cn` Tailwind merge utility)

## Special Directories

**`.planning/codebase/`:**
- Purpose: GSD codebase analysis documents
- Generated: Yes (by gsd-map-codebase)
- Committed: Yes (used by planning tooling)

**`cinatra/`:**
- Purpose: Platform metadata for the Cinatra host
- Generated: No (hand-authored)
- Committed: Yes

---

*Structure analysis: 2026-06-09*
