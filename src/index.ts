// This package's root export ("." / main / types) carries ONLY the
// connector's host-DI registration contract — the boot-time binding that lets
// the host wire concrete impls (the connector-level Google OAuth status probe
// + the per-user connection Check/Disconnect actions) into this connector's
// serverEntry register(ctx) (see ./register.ts). The host base alias resolves
// this file, so it cannot be deleted even though the package otherwise has no
// standalone appointment-schedule surface left.
//
// The appointment-schedule store, the calendar.app.google URL allowlist, the
// og-scrape enrichment, and the settings types that used to live here moved to
// the dedicated @cinatra-ai/google-appointment-schedules-connector
// (cinatra-ai/cinatra#2367 S1/S2) along with the "Appointment schedules" tab,
// the `google_calendar_appointments_list` MCP tool, and the
// chat-user-context / appointment-schedules capability providers.
export { registerGoogleCalendarConnector } from "./deps";
export type { GoogleCalendarConnectorDeps } from "./deps";
