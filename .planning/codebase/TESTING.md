# Testing Patterns

**Analysis Date:** 2026-06-09

## Test Framework

**Runner:**
- Not configured in this repo. No `jest.config.*`, `vitest.config.*`, or test runner script detected in `package.json`.

**Assertion Library:**
- Not applicable — no test files present in the repo.

**Run Commands:**
```bash
# No test script defined. CI runs: corepack pnpm test --if-present
# which exits 0 silently when no test script is present.
```

## Why Tests Are Absent

This repo is a **Cinatra source mirror** (a connector extension extracted from the monorepo). The CI workflow in `.github/workflows/ci.yml` explicitly documents this:

> "Host-internal-peer repos can't run their tests standalone (the tests import @cinatra-ai/* sources that resolve only in the monorepo); the monorepo runs them."

The build job detects the presence of `@cinatra-ai/*` optional peer dependencies and sets `first_party=1`, causing the `Test` step to skip with a documented message. Tests for this connector are located in and executed by the parent cinatra monorepo.

## Test Infrastructure Provisions

Although no test files are present, the source code includes deliberate test-support hooks:

**Test Reset Export (`src/deps.ts`):**
```typescript
export function _resetGoogleCalendarDepsForTests(): void {
  _deps = null;
}
```
This is the only test-facing API. It resets the DI singleton between test cases. The `_` prefix signals it is for internal/test use only and not part of the public API.

**Test Fixture File (`cinatra/dev-fixtures.json`):**
- Present at `cinatra/dev-fixtures.json`
- Referenced in `package.json` via `"cinatra": { "devFixtures": "cinatra/dev-fixtures.json" }`
- Contains connector settings seed data used during development/local testing within the monorepo environment

## Test File Organization

**Location:**
- Not applicable — no test files present in this repo. Tests reside in the cinatra monorepo.

**Naming:**
- Not applicable.

## Test Structure

**Suite Organization:**
- Not applicable — no tests in this repo.

## Mocking

**Framework:**
- Not detected in this repo.

**Dependency Injection Testability:**
The `GoogleCalendarConnectorDeps` interface in `src/deps.ts` defines the injectable boundary:
```typescript
export interface GoogleCalendarConnectorDeps {
  readConnectorConfigFromDatabase: <T>(connectorId: string, fallback: T) => T;
  writeConnectorConfigToDatabase: (connectorId: string, value: unknown) => void;
  requireSessionUserId: () => Promise<string>;
}
```
Tests in the monorepo inject mock implementations via `registerGoogleCalendarConnector(mockDeps)` and reset with `_resetGoogleCalendarDepsForTests()` between cases.

**What to Mock:**
- `readConnectorConfigFromDatabase` — return fixture data
- `writeConnectorConfigToDatabase` — spy/noop
- `requireSessionUserId` — return a test user ID string
- `fetch` (global) — intercept `fetchAppointmentSchedule` HTTP calls

**What NOT to Mock:**
- Pure utility functions (`isPublicScheduleUrl`, `normalizeBookingPageUrl`, `buildScheduleId`, `sanitizeAppointments`) — these are unit-testable without mocking

## Fixtures and Factories

**Test Data:**
- `cinatra/dev-fixtures.json` provides connector setting seeds for the dev environment.

**Location:**
- `cinatra/dev-fixtures.json` — the only fixture file in this repo.

## Coverage

**Requirements:** Not enforced in this repo. Coverage is managed by the parent monorepo.

**View Coverage:**
```bash
# Not applicable — run tests from the cinatra monorepo.
```

## Test Types

**Unit Tests:**
- Not present in this repo; executed in the monorepo. The pure helper functions in `src/index.ts` (URL parsing, HTML extraction, sanitization) are the natural unit-test targets.

**Integration Tests:**
- Not present. The `SELFCHECK_TOOL_NAME` tool registered in `src/register.ts` performs a settings round-trip (`set` → `get` → `delete`) that serves as an integration smoke test when run inside the monorepo's extension host.

**E2E Tests:**
- Not applicable.

## Common Patterns

**Async Testing:**
- Not applicable in this repo. In the monorepo, all exported async functions (`refreshGoogleCalendarAppointments`, `addGoogleCalendarAppointmentSchedule`, `fetchAppointmentSchedule`) would be tested with `await` and mock `fetch`.

**Error Testing:**
- Key error paths to test: `normalizeBookingPageUrl` rejects non-`https` URLs and non-`calendar.app.google` hostnames; `getGoogleCalendarDeps` throws before `registerGoogleCalendarConnector` is called.

---

*Testing analysis: 2026-06-09*
