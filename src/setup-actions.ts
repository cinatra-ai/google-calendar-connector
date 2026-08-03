"use server";

// Google Calendar setup server actions — relocated from the central
// `@cinatra-ai/connectors` host hub into the connector itself as part of the
// SDK-only decouple. Each is gated by the SDK's
// `requireExtensionAction(pkg, "read")` — the google-calendar descriptor is
// `defaultVisibility: "workspace"` and the setup page gates on
// `enforceConnectorPolicy(..., "read")`, so these user-scoped self-service
// actions (manage MY OWN connection) must NOT require admin. `"read"` admits
// any workspace member; the operation is self-scoped to the session user id
// resolved AFTER the guard via the connector's injected deps (so there is NO
// `@/lib/*` import).
//
// The appointment-schedule add action that used to live here moved to
// @cinatra-ai/google-appointment-schedules-connector (cinatra-ai/cinatra#2367
// S1/S2) along with its store.
//
// Flash protocol (issue #44): actions redirect back with a canonical outcome
// CODE (`?notice=<code>` / `?error=<code>`) — never raw error text — which the
// <SearchParamToast> island in ./setup-page maps to a static message
// (./gcal-flash). No in-page transient banner remains.

import { redirect } from "next/navigation";
import { requireExtensionAction } from "@cinatra-ai/sdk-extensions";
import { getGoogleCalendarDeps } from "./deps";

const GOOGLE_CALENDAR_PACKAGE_ID = "@cinatra-ai/google-calendar-connector";
const SETUP_PAGE = "/connectors/cinatra-ai/google-calendar-connector/setup";

// Re-probe the invoking user's live Google Calendar connection status for the
// Connection status card's Check action (app-connectors.html §II Check flow).
// Returns the badge state; the client island owns the transient "Checking…"
// swap and restores the prior badge on a thrown probe error.
export async function checkGoogleCalendarStatusAction(): Promise<
  "connected" | "disconnected"
> {
  await requireExtensionAction(GOOGLE_CALENDAR_PACKAGE_ID, "read");
  return getGoogleCalendarDeps().getUserConnectionStatus();
}

// Disconnect the invoking user's Google Calendar connection (the destructive
// Disconnect confirm, app-connectors.html §II). Self-scoped to the session user.
export async function disconnectGoogleCalendarConnectionAction() {
  await requireExtensionAction(GOOGLE_CALENDAR_PACKAGE_ID, "read");

  try {
    await getGoogleCalendarDeps().disconnectUserConnection();
  } catch {
    redirect(`${SETUP_PAGE}?error=disconnect-failed`);
  }

  redirect(`${SETUP_PAGE}?notice=disconnected`);
}
