// -----------------------------------------------------------------------------
// Google Calendar setup codes-only flash protocol.
//
// The add-appointment-schedule server action ("use server", src/setup-actions.ts)
// reports its outcome by redirecting to the setup page with a stable CODE on
// `?notice=<code>` (success) or `?error=<code>` (failure) — never the raw
// exception message, which would let a crafted `?error=<spoofed text>` toast
// attacker-controlled content. The <SearchParamToast> island mounted at the
// setup page maps each code to a STATIC message here; a code with no entry in
// either map is ignored (mirrors the host setup-wizard's src/app/setup/setup-flash.ts).
// -----------------------------------------------------------------------------

import type { SearchParamToastConfig } from "@cinatra-ai/sdk-ui/search-param-toast";

export const GOOGLE_CALENDAR_NOTICE_MESSAGES = {
  "schedule-saved": "Appointment schedule saved.",
} as const;

export const GOOGLE_CALENDAR_ERROR_MESSAGES = {
  "invalid-protocol": "Appointment schedule links must use https.",
  "invalid-host":
    "Use a public Google Calendar appointment schedule link from calendar.app.google.",
  "fetch-failed":
    "Could not load that appointment schedule page. Check the link and try again.",
  unexpected: "Unable to add the Google Calendar appointment schedule.",
} as const;

export type GoogleCalendarSetupNoticeCode = keyof typeof GOOGLE_CALENDAR_NOTICE_MESSAGES;
export type GoogleCalendarSetupErrorCode = keyof typeof GOOGLE_CALENDAR_ERROR_MESSAGES;

// One <SearchParamToast> config entry per code: notice codes toast success,
// error codes toast error, both with the STATIC message above. Passed to the
// island mounted in src/setup-page.tsx.
export const GOOGLE_CALENDAR_SETUP_FLASH_TOASTS: SearchParamToastConfig[] = [
  ...Object.entries(GOOGLE_CALENDAR_NOTICE_MESSAGES).map(([code, message]) => ({
    param: "notice",
    value: code,
    message,
    variant: "success" as const,
  })),
  ...Object.entries(GOOGLE_CALENDAR_ERROR_MESSAGES).map(([code, message]) => ({
    param: "error",
    value: code,
    message,
    variant: "error" as const,
  })),
];

// Maps the exception thrown by addUserGoogleCalendarAppointmentSchedule (see
// src/index.ts: normalizeBookingPageUrl + fetchAppointmentSchedule) to a
// canonical error code. Matched on the known static messages the connector
// itself throws; anything else (a malformed URL the WHATWG parser rejects
// before normalizeBookingPageUrl runs, a network failure, etc.) falls back to
// "unexpected" rather than ever forwarding the raw message text.
export function mapAppointmentScheduleErrorToCode(error: unknown): GoogleCalendarSetupErrorCode {
  const message = error instanceof Error ? error.message : "";

  if (message === "Appointment schedule links must use https.") {
    return "invalid-protocol";
  }
  if (
    message ===
    "Use a public Google Calendar appointment schedule link from calendar.app.google."
  ) {
    return "invalid-host";
  }
  if (message.startsWith("Unable to load the appointment schedule page")) {
    return "fetch-failed";
  }

  return "unexpected";
}
