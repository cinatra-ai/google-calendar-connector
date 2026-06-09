# Coding Conventions

**Analysis Date:** 2026-06-09

## Naming Patterns

**Files:**
- `kebab-case` for all source files: `setup-page.tsx`, `setup-actions.ts`, `input-group.tsx`
- Component files use `.tsx`; pure logic files use `.ts`
- UI primitives live as individual files: `src/components/ui/button.tsx`, `src/components/ui/alert.tsx`

**Functions:**
- `camelCase` for all functions: `getStoredGoogleCalendarAppointments`, `addGoogleCalendarAppointmentSchedule`, `fetchAppointmentSchedule`
- Factory functions prefixed with `create`: `createGoogleCalendarPrimitiveHandlers`, `createGoogleCalendarModule`
- Register functions prefixed with `register`: `registerGoogleCalendarConnector`, `registerGoogleCalendarPrimitives`
- Boolean-returning helpers prefixed with `is`: `isPublicScheduleUrl`
- Internal/test-only helpers prefixed with `_`: `_resetGoogleCalendarDepsForTests` in `src/deps.ts`

**Variables:**
- `camelCase` throughout
- Constants in `SCREAMING_SNAKE_CASE` for top-level module constants: `SELFCHECK_TOOL_NAME`, `PACKAGE_NAME`, `GOOGLE_CALENDAR_PACKAGE_ID`, `SETUP_PAGE`, `TOOL_META`

**Types:**
- `PascalCase` for type aliases and interfaces: `StoredCalendarAppointment`, `GoogleCalendarSettings`, `GoogleCalendarConnectorDeps`, `ConnectorSetupPageProps`
- Types defined close to where they are used (local to module, not a shared types barrel)
- Interface used for dependency injection contract (`GoogleCalendarConnectorDeps`); type aliases used for data shapes

**React Components:**
- `PascalCase` function components: `Button`, `GoogleCalendarConnectorSetupPage`
- Props typed inline with `React.ComponentProps<"button"> & VariantProps<...> & {...}` pattern (see `src/components/ui/button.tsx`)
- `data-slot` attribute used to mark component roots for CSS targeting

## Code Style

**Formatting:**
- No Prettier or ESLint config files detected in the repo root — formatting is enforced at the monorepo level (this repo is a source mirror)
- Double quotes for strings in TypeScript (consistent throughout)
- 2-space indentation
- Trailing commas used in multi-line objects and arrays
- Single blank line between top-level declarations

**TypeScript:**
- `strict: true` in `tsconfig.json`, but `noImplicitAny: false` (relaxed)
- `verbatimModuleSyntax: true` — type-only imports must use `import type`
- `isolatedModules: true` — each file must be independently compilable
- Target: `ES2023`, module: `ESNext`, moduleResolution: `bundler`
- `import type` used consistently for type-only imports: `import type { ExtensionHostContext }`, `import type { ExtensionPrimitiveRequest }`

**Module Exports:**
- Named exports used throughout; no default exports except React page components
- Re-exports in `src/index.ts` for the public API surface: `export { registerGoogleCalendarConnector } from "./deps"`
- Each entry point (`./register`, `./setup-page`, `./mcp-module`, etc.) maps to a separate source file in `package.json` exports

## Import Organization

**Order:**
1. External packages (`react`, `next/navigation`, `class-variance-authority`, `radix-ui`, `zod`)
2. Internal `@cinatra-ai/*` peer packages (`@cinatra-ai/sdk-extensions`, `@cinatra-ai/sdk-ui/*`)
3. Relative imports (`./deps`, `./index`, `../index`, `../../lib/utils`)

**Path Aliases:**
- No path aliases configured; all internal imports use relative paths

## Error Handling

**Patterns:**
- `throw new Error(message)` with descriptive human-readable messages — see `src/deps.ts` (missing deps guard), `src/index.ts` (`normalizeBookingPageUrl`)
- Server actions catch errors and redirect with `?error=<encoded-message>` query param rather than throwing to the client: `src/setup-actions.ts`
- `try/catch` with fallback return value for URL parsing: `isPublicScheduleUrl` in `src/index.ts`
- Thrown errors from `fetchAppointmentSchedule` surface HTTP status codes in the message string
- Defensive null-check guard in `src/setup-page.tsx` with an explicit `throw new Error(...)` before proceeding with user-scoped data

**Guard Pattern:**
- Dependency injection singleton throws with a registration-instruction message when accessed before being initialized (`getGoogleCalendarDeps` in `src/deps.ts`)

## Dependency Injection

**Pattern:**
- Module-level `let _deps: T | null = null` singleton in `src/deps.ts`
- `registerXxx(deps)` called at boot by the host to bind concrete implementations
- `getXxxDeps()` called at request time; throws if not registered
- `_resetXxxDepsForTests()` exported for test teardown (prefixed `_` to signal internal use)

## Logging

**Framework:** None — no logging library detected. Console not used directly in source.

**Patterns:**
- Errors are surfaced via `throw` or redirect with error query params; no log statements observed

## Comments

**When to Comment:**
- File-level block comments explain architectural decisions, rationale, and security policy: `src/setup-actions.ts`, `src/register.ts`, `src/deps.ts`
- Inline comments used for non-obvious decisions (e.g., URL normalization edge cases)
- `//` single-line comments, no JSDoc/TSDoc annotations on exported functions

**Style:**
- Multi-sentence prose comments for non-obvious design decisions
- Comments document "why" not "what" — especially around security constraints and host-port inversion

## UI Component Style

**Pattern:**
- `cva` (class-variance-authority) used for variant-driven component classes in `src/components/ui/button.tsx`
- `cn()` utility from `src/lib/utils.ts` (wraps `clsx` + `tailwind-merge`) used everywhere for className composition
- Radix UI primitives wrapped with local styling via `Slot.Root` from `radix-ui`
- `data-slot`, `data-variant`, `data-size` HTML attributes used for CSS targeting

## Function Design

**Size:** Functions are small and single-purpose. Helper functions (`extractMetaContent`, `extractTitle`, `buildScheduleId`, `sanitizeAppointments`) are private (unexported) within `src/index.ts`.

**Parameters:** Functions take typed parameters; server actions take `FormData` per Next.js convention.

**Return Values:** Async functions return typed objects; synchronous helpers return primitives or filtered arrays. `void` used for write/side-effect functions (`writeSettings`, `registerGoogleCalendarConnector`).

## Module Design

**Exports:** Selective named exports; internals are not exported. Public API concentrated in `src/index.ts`.

**Barrel Files:** No barrel index files. Each entry point is a dedicated file mapped in `package.json` exports.

---

*Convention analysis: 2026-06-09*
