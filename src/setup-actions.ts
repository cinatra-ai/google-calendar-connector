"use server";

// Google Calendar appointment-schedule server action — relocated from the
// central `@cinatra-ai/connectors` host hub into the connector itself as part of
// the SDK-only decouple. Gated by the SDK's `requireExtensionAction(pkg, "read")` —
// the google-calendar descriptor is `defaultVisibility: "workspace"` and the
// setup page gates on `enforceConnectorPolicy(..., "read")`, so this user-scoped
// self-service action (save MY OWN appointment schedule) must NOT require admin.
// `"read"` admits any workspace member; the operation is self-scoped to the
// session user id. The hub copy used `requireAuthSession()` (any signed-in user)
// — `"read"` is the host-bound, workspace-scoped equivalent, fail-closed. The
// guard runs FIRST; the session user id is resolved AFTER the guard via the
// connector's injected `requireSessionUserId` dep (so there is NO `@/lib/*`
// import), then the schedule is saved through the connector's own
// `addUserGoogleCalendarAppointmentSchedule`.

import { redirect } from "next/navigation";
import { requireExtensionAction } from "@cinatra-ai/sdk-extensions";
import { getGoogleCalendarDeps } from "./deps";
import { addUserGoogleCalendarAppointmentSchedule } from "./index";

const GOOGLE_CALENDAR_PACKAGE_ID = "@cinatra-ai/google-calendar-connector";
const SETUP_PAGE = "/connectors/cinatra-ai/google-calendar-connector/setup";

export async function addGoogleCalendarAppointmentScheduleAction(formData: FormData) {
  await requireExtensionAction(GOOGLE_CALENDAR_PACKAGE_ID, "read");

  const userId = await getGoogleCalendarDeps().requireSessionUserId();
  const url = String(formData.get("bookingPageUrl") ?? "").trim();

  try {
    await addUserGoogleCalendarAppointmentSchedule(userId, url);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to add the Google Calendar appointment schedule.";
    redirect(`${SETUP_PAGE}?error=${encodeURIComponent(message)}`);
  }

  redirect(`${SETUP_PAGE}?saved=1`);
}
