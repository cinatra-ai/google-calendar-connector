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

let _deps: GoogleCalendarConnectorDeps | null = null;

export function registerGoogleCalendarConnector(deps: GoogleCalendarConnectorDeps): void {
  _deps = deps;
}

export function getGoogleCalendarDeps(): GoogleCalendarConnectorDeps {
  if (!_deps) {
    throw new Error(
      "@cinatra-ai/google-calendar-connector: host runtime deps not registered. " +
        "Call registerGoogleCalendarConnector(deps) at boot.",
    );
  }
  return _deps;
}

export function _resetGoogleCalendarDepsForTests(): void {
  _deps = null;
}
