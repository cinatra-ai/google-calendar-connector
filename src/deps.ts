// Host DI singleton for google-calendar.
// See packages/connector-gmail/src/deps.ts for the pattern + rationale.

export interface GoogleCalendarConnectorDeps {
  readConnectorConfigFromDatabase: <T>(connectorId: string, fallback: T) => T;
  writeConnectorConfigToDatabase: (connectorId: string, value: unknown) => void;
  // Resolves the current session user id for the relocated user-scoped
  // appointment-schedule action. Host binds this to its auth-session lookup
  // (e.g. requireAuthSession().user.id) so the connector carries no `@/lib/*`
  // import. Throws if there is no authenticated session.
  requireSessionUserId: () => Promise<string>;
}

// Anchor the deps slot on `globalThis` via a namespaced+versioned Symbol so the
// activation-time registration (this connector's serverEntry `register(ctx)`)
// and runtime callers in SEPARATELY-COMPILED Next.js bundles resolve the SAME
// slot. (Same cross-compilation reason as the apify/apollo/gemini/tailscale
// deps slots + the SDK DI contracts.)
const GOOGLE_CALENDAR_DEPS_KEY = Symbol.for(
  "@cinatra-ai/google-calendar-connector:host-deps/v1",
);
type DepsHolder = { [k: symbol]: GoogleCalendarConnectorDeps | null | undefined };
const _holder = globalThis as unknown as DepsHolder;

export function registerGoogleCalendarConnector(deps: GoogleCalendarConnectorDeps): void {
  _holder[GOOGLE_CALENDAR_DEPS_KEY] = deps;
}

export function getGoogleCalendarDeps(): GoogleCalendarConnectorDeps {
  const deps = _holder[GOOGLE_CALENDAR_DEPS_KEY];
  if (!deps) {
    throw new Error(
      "@cinatra-ai/google-calendar-connector: host runtime deps not registered. " +
        "The connector's serverEntry register(ctx) binds them at activation " +
        "(tests: call registerGoogleCalendarConnector(stubDeps) in setup).",
    );
  }
  return deps;
}

export function _resetGoogleCalendarDepsForTests(): void {
  _holder[GOOGLE_CALENDAR_DEPS_KEY] = null;
}
