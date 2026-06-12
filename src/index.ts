// Host-coupled `@/lib/database` runtime imports are replaced with
// injected deps via getGoogleCalendarDeps(). Boot wires concrete impls
// via registerGoogleCalendarConnector(deps) in
// src/lib/register-transport-connectors.ts.
import { getGoogleCalendarDeps } from "./deps";

type StoredCalendarAppointment = {
  id: string;
  title: string;
  description?: string;
  bookingPageUrl: string;
  lastFetchedAt?: string;
};

type GoogleCalendarSettings = {
  calendarAppointments?: StoredCalendarAppointment[];
  calendarAppointmentsSyncedAt?: string;
};

function getSettingsConnectorId(userId?: string) {
  return userId ? `google_calendar_user:${userId}` : "google_calendar";
}

function readSettings(userId?: string) {
  return getGoogleCalendarDeps().readConnectorConfigFromDatabase<GoogleCalendarSettings>(getSettingsConnectorId(userId), {});
}

function writeSettings(value: GoogleCalendarSettings, userId?: string) {
  getGoogleCalendarDeps().writeConnectorConfigToDatabase(getSettingsConnectorId(userId), value);
}

function isPublicScheduleUrl(value: string) {
  try {
    return new URL(value).hostname === "calendar.app.google";
  } catch {
    return false;
  }
}

function sanitizeAppointments(appointments: StoredCalendarAppointment[] | undefined) {
  return (appointments ?? []).filter((appointment) => isPublicScheduleUrl(appointment.bookingPageUrl));
}

function normalizeBookingPageUrl(input: string) {
  const parsed = new URL(input);
  if (parsed.protocol !== "https:") {
    throw new Error("Appointment schedule links must use https.");
  }
  if (parsed.hostname !== "calendar.app.google") {
    throw new Error("Use a public Google Calendar appointment schedule link from calendar.app.google.");
  }
  return parsed.toString();
}

function buildScheduleId(url: string) {
  const parsed = new URL(url);
  const path = parsed.pathname.replace(/^\/+|\/+$/g, "");
  return path || parsed.toString();
}

function extractMetaContent(html: string, name: string) {
  const pattern = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)["']`, "i");
  const match = html.match(pattern);
  return match?.[1]?.trim();
}

function extractTitle(html: string) {
  const match = html.match(/<title>([^<]+)<\/title>/i);
  return match?.[1]?.trim();
}

async function fetchAppointmentSchedule(url: string): Promise<StoredCalendarAppointment> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Cinatra/1.0",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Unable to load the appointment schedule page (${response.status}).`);
  }

  const html = await response.text();
  const title =
    extractMetaContent(html, "og:title") ??
    extractMetaContent(html, "twitter:title") ??
    extractTitle(html) ??
    "Google Calendar appointment schedule";
  const description =
    extractMetaContent(html, "og:description") ??
    extractMetaContent(html, "description") ??
    extractMetaContent(html, "twitter:description") ??
    undefined;
  const normalizedUrl = normalizeBookingPageUrl(url);

  return {
    id: buildScheduleId(normalizedUrl),
    title,
    description,
    bookingPageUrl: normalizedUrl,
    lastFetchedAt: new Date().toISOString(),
  };
}

export function getStoredGoogleCalendarAppointments(userId?: string) {
  const settings = readSettings(userId);
  const appointments = sanitizeAppointments(settings.calendarAppointments);

  if (appointments.length !== (settings.calendarAppointments ?? []).length) {
    writeSettings({
      calendarAppointments: appointments,
      calendarAppointmentsSyncedAt: settings.calendarAppointmentsSyncedAt,
    }, userId);
  }

  return {
    appointments,
    syncedAt: settings.calendarAppointmentsSyncedAt,
  };
}

// Chat user-context provider record for the host's generic capability
// registry (capability id "chat-user-context"). The CONNECTOR owns the
// section formatting; the chat runner just appends whatever the live
// providers return — it no longer imports this package by name. Registered
// at serverEntry activation (`register.ts`) and, transitionally, by the
// host's boot bridge; both registrations carry this record's packageName, so
// the registry idempotently dedupes. Structurally typed on purpose (no SDK
// type import needed — the host SDK contract is additive and lands with the
// host-side consumer): `{ packageName, impl: { buildSections } }`.
// `buildSections` is cheap + local by contract: it reads the already-synced
// appointment-schedule store; no network.
export const googleCalendarChatUserContextProvider = {
  packageName: "@cinatra-ai/google-calendar-connector",
  impl: {
    buildSections({ userId }: { userId?: string }): string[] {
      const { appointments } = getStoredGoogleCalendarAppointments(userId);
      if (appointments.length === 0) return [];
      const list = appointments
        .map((a) => `"${a.title}" (${a.bookingPageUrl})`)
        .join(", ");
      return [`Appointment schedules: ${list}`];
    },
  },
};

// Appointment-schedules provider record (capability id
// "appointment-schedules", cinatra#151 Stage 4): the STRUCTURED counterpart
// of the chat-user-context contribution above. The host's CTA server action
// (packages/agents cta-actions) resolves the live providers and lists the
// user's bookable appointment schedules instead of value-importing
// `getStoredGoogleCalendarAppointments`. `getSchedules` is cheap + local by
// contract (reads the already-synced appointment store; no network).
// Structurally typed on purpose (no SDK type import needed — the host SDK
// contract is additive and lands with the host-side consumer).
export const googleCalendarAppointmentSchedulesProvider = {
  packageName: "@cinatra-ai/google-calendar-connector",
  impl: {
    getSchedules({ userId }: { userId?: string }): { title: string; bookingPageUrl: string }[] {
      const { appointments } = getStoredGoogleCalendarAppointments(userId);
      return appointments.map((a) => ({ title: a.title, bookingPageUrl: a.bookingPageUrl }));
    },
  },
};

export async function clearStoredGoogleCalendarAppointments() {
  writeSettings({});
}

export async function clearStoredUserGoogleCalendarAppointments(userId: string) {
  writeSettings({}, userId);
}

export async function refreshGoogleCalendarAppointments() {
  const settings = readSettings();
  const appointments = await Promise.all(
    sanitizeAppointments(settings.calendarAppointments).map((appointment) => fetchAppointmentSchedule(appointment.bookingPageUrl)),
  );

  appointments.sort((left, right) => left.title.localeCompare(right.title));

  writeSettings({
    calendarAppointments: appointments,
    calendarAppointmentsSyncedAt: new Date().toISOString(),
  });

  return appointments;
}

export async function addGoogleCalendarAppointmentSchedule(url: string) {
  const schedule = await fetchAppointmentSchedule(url);
  const settings = readSettings();
  const appointments = [...sanitizeAppointments(settings.calendarAppointments)];
  const existingIndex = appointments.findIndex((appointment) => appointment.bookingPageUrl === schedule.bookingPageUrl);

  if (existingIndex >= 0) {
    appointments[existingIndex] = schedule;
  } else {
    appointments.push(schedule);
  }

  appointments.sort((left, right) => left.title.localeCompare(right.title));
  writeSettings({
    calendarAppointments: appointments,
    calendarAppointmentsSyncedAt: new Date().toISOString(),
  });

  return schedule;
}

export async function addUserGoogleCalendarAppointmentSchedule(userId: string, url: string) {
  const schedule = await fetchAppointmentSchedule(url);
  const settings = readSettings(userId);
  const appointments = [...sanitizeAppointments(settings.calendarAppointments)];
  const existingIndex = appointments.findIndex((appointment) => appointment.bookingPageUrl === schedule.bookingPageUrl);

  if (existingIndex >= 0) {
    appointments[existingIndex] = schedule;
  } else {
    appointments.push(schedule);
  }

  appointments.sort((left, right) => left.title.localeCompare(right.title));
  writeSettings(
    {
      calendarAppointments: appointments,
      calendarAppointmentsSyncedAt: new Date().toISOString(),
    },
    userId,
  );

  return schedule;
}


// Dependency-injection registration keeps host coupling at the boot boundary.
export { registerGoogleCalendarConnector } from "./deps";
export type { GoogleCalendarConnectorDeps } from "./deps";
