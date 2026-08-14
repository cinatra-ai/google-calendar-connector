// Host DI singleton for google-calendar.
// See packages/connector-gmail/src/deps.ts for the pattern + rationale.

export interface GoogleCalendarConnectorDeps {
  // Connector-level Google-OAuth status (no userId scope). Host binds this to
  // the `@cinatra-ai/host:google-oauth` service. Drives the connect-button
  // prerequisite on the setup page: connecting Calendar requires the shared
  // OAuth client to be configured first (mirrors gmail-connector's `oauth`).
  oauth: {
    getStatus(): Promise<{
      status: "connected" | "incomplete" | "not_connected";
      accountEmail?: string;
      detail?: string;
    }>;
  };
  // The invoking user's Google Calendar connection status — whether a Nango
  // connection exists for THIS user (app-connectors.html §II Connection status
  // card + Check flow). Host binds this to `ctx.nango.getPrimarySavedConnections`
  // scoped to the session user. Drives the status card badge and the Check
  // action's live re-probe. A probe error PROPAGATES to the caller so the Check
  // island restores the last-known badge rather than misreporting Disconnected.
  getUserConnectionStatus: () => Promise<"connected" | "disconnected">;
  // Disconnect the invoking user's Google Calendar Nango connection
  // (app-connectors.html §II Disconnect confirm). Host binds this to the
  // connector-authored `nango-system` surface: delete the upstream Nango
  // connection, then clear this connector's saved-connection pointer records so
  // the next status read fails closed. Self-scoped to the session user id.
  disconnectUserConnection: () => Promise<void>;
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
