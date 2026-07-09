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
//
// Outcome protocol: codes-only (cinatra-ai/cinatra#1107 / #1186). This redirects
// with a stable `notice`/`error` CODE — never the raw exception message — so a
// crafted `?error=<text>` can't inject arbitrary toast content. The setup page's
// <SearchParamToast> island (src/setup-flash.ts) maps each code to a STATIC
// message.

import { redirect } from "next/navigation";
import { requireExtensionAction } from "@cinatra-ai/sdk-extensions";
import { flashHref } from "@cinatra-ai/sdk-extensions/flash-href";
import { getGoogleCalendarDeps } from "./deps";
import { addUserGoogleCalendarAppointmentSchedule } from "./index";
import { mapAppointmentScheduleErrorToCode } from "./setup-flash";

const GOOGLE_CALENDAR_PACKAGE_ID = "@cinatra-ai/google-calendar-connector";
const SETUP_PAGE = "/connectors/cinatra-ai/google-calendar-connector/setup";

export async function addGoogleCalendarAppointmentScheduleAction(formData: FormData) {
  await requireExtensionAction(GOOGLE_CALENDAR_PACKAGE_ID, "read");

  const userId = await getGoogleCalendarDeps().requireSessionUserId();
  const url = String(formData.get("bookingPageUrl") ?? "").trim();

  try {
    await addUserGoogleCalendarAppointmentSchedule(userId, url);
  } catch (error) {
    redirect(flashHref(SETUP_PAGE, { error: mapAppointmentScheduleErrorToCode(error) }));
  }

  redirect(flashHref(SETUP_PAGE, { notice: "schedule-saved" }));
}
