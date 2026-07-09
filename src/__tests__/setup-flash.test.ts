// Unit tests for the codes-only flash protocol (cinatra-ai/cinatra#1107 /
// #1186, google-calendar-connector#44): pins mapAppointmentScheduleErrorToCode
// against every static message addUserGoogleCalendarAppointmentSchedule can
// throw (src/index.ts), and that the exported flash-toast config carries the
// exact static message for every notice/error code — never derived from
// runtime text.
import { describe, expect, it } from "vitest";
import {
  GOOGLE_CALENDAR_ERROR_MESSAGES,
  GOOGLE_CALENDAR_NOTICE_MESSAGES,
  GOOGLE_CALENDAR_SETUP_FLASH_TOASTS,
  mapAppointmentScheduleErrorToCode,
} from "../setup-flash";

describe("mapAppointmentScheduleErrorToCode", () => {
  it("maps the https-required error to invalid-protocol", () => {
    expect(
      mapAppointmentScheduleErrorToCode(
        new Error("Appointment schedule links must use https."),
      ),
    ).toBe("invalid-protocol");
  });

  it("maps the wrong-host error to invalid-host", () => {
    expect(
      mapAppointmentScheduleErrorToCode(
        new Error(
          "Use a public Google Calendar appointment schedule link from calendar.app.google.",
        ),
      ),
    ).toBe("invalid-host");
  });

  it("maps a load-failure error (any status) to fetch-failed", () => {
    expect(
      mapAppointmentScheduleErrorToCode(
        new Error("Unable to load the appointment schedule page (404)."),
      ),
    ).toBe("fetch-failed");
    expect(
      mapAppointmentScheduleErrorToCode(
        new Error("Unable to load the appointment schedule page (503)."),
      ),
    ).toBe("fetch-failed");
  });

  it("falls back to unexpected for an unrecognized Error", () => {
    expect(mapAppointmentScheduleErrorToCode(new Error("boom"))).toBe("unexpected");
  });

  it("falls back to unexpected for a malformed-URL TypeError (new URL() throw)", () => {
    expect(mapAppointmentScheduleErrorToCode(new TypeError("Invalid URL"))).toBe(
      "unexpected",
    );
  });

  it("falls back to unexpected for a non-Error thrown value", () => {
    expect(mapAppointmentScheduleErrorToCode("not an Error instance")).toBe("unexpected");
    expect(mapAppointmentScheduleErrorToCode(undefined)).toBe("unexpected");
  });

  it("never echoes the raw exception message into the returned code", () => {
    // A crafted/attacker-controlled message must still resolve to a fixed,
    // finite code — the anti-pattern this migration retires (URL-derived text
    // reflected into a toast).
    const code = mapAppointmentScheduleErrorToCode(
      new Error("<script>alert(1)</script>"),
    );
    expect(code).toBe("unexpected");
    expect(code).not.toContain("<script>");
  });
});

describe("GOOGLE_CALENDAR_SETUP_FLASH_TOASTS", () => {
  it("has one entry per notice code, on the notice param, success variant", () => {
    for (const code of Object.keys(GOOGLE_CALENDAR_NOTICE_MESSAGES)) {
      const entry = GOOGLE_CALENDAR_SETUP_FLASH_TOASTS.find(
        (t) => t.param === "notice" && t.value === code,
      );
      expect(entry).toBeDefined();
      expect(entry?.variant).toBe("success");
      expect(entry?.message).toBe(
        GOOGLE_CALENDAR_NOTICE_MESSAGES[code as keyof typeof GOOGLE_CALENDAR_NOTICE_MESSAGES],
      );
    }
  });

  it("has one entry per error code, on the error param, error variant", () => {
    for (const code of Object.keys(GOOGLE_CALENDAR_ERROR_MESSAGES)) {
      const entry = GOOGLE_CALENDAR_SETUP_FLASH_TOASTS.find(
        (t) => t.param === "error" && t.value === code,
      );
      expect(entry).toBeDefined();
      expect(entry?.variant).toBe("error");
      expect(entry?.message).toBe(
        GOOGLE_CALENDAR_ERROR_MESSAGES[code as keyof typeof GOOGLE_CALENDAR_ERROR_MESSAGES],
      );
    }
  });

  it("carries exactly the known notice + error codes (no stray entries)", () => {
    expect(GOOGLE_CALENDAR_SETUP_FLASH_TOASTS).toHaveLength(
      Object.keys(GOOGLE_CALENDAR_NOTICE_MESSAGES).length +
        Object.keys(GOOGLE_CALENDAR_ERROR_MESSAGES).length,
    );
  });
});
