import type { ExtensionPrimitiveRequest } from "@cinatra-ai/sdk-extensions";
import { getStoredGoogleCalendarAppointments } from "../index";

export function createGoogleCalendarPrimitiveHandlers() {
  return {
    "google_calendar_appointments_list": async (_request: ExtensionPrimitiveRequest<unknown>) => {
      const { appointments, syncedAt } = getStoredGoogleCalendarAppointments();
      return {
        items: appointments.map((a) => ({
          title: a.title,
          bookingPageUrl: a.bookingPageUrl,
        })),
        total: appointments.length,
        syncedAt: syncedAt ?? null,
      };
    },
  } as const;
}
