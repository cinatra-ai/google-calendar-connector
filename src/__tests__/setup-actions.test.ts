// Unit test for the flash-code redirect path in
// addGoogleCalendarAppointmentScheduleAction (src/setup-actions.ts): pins the
// exact `notice`/`error` codes redirected on success/failure (never the raw
// exception message), addressing the codex-converge gap that no test
// directly exercised the server action's redirect target (see
// .claude/scratch/toast-gcal-44/codex-verdict2.txt).
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../deps", () => ({
  getGoogleCalendarDeps: () => ({
    requireSessionUserId: async () => "user-1",
  }),
}));

const addUserGoogleCalendarAppointmentSchedule = vi.fn();
vi.mock("../index", () => ({
  addUserGoogleCalendarAppointmentSchedule: (...args: unknown[]) =>
    addUserGoogleCalendarAppointmentSchedule(...args),
}));

import {
  __getRedirectCalls,
  __isRedirectSignal,
  __resetNavigationStub,
} from "./__stubs__/next-navigation";
import { __resetSdkExtensionsStub } from "./__stubs__/sdk-extensions";
import { addGoogleCalendarAppointmentScheduleAction } from "../setup-actions";

function formData(url: string): FormData {
  const fd = new FormData();
  fd.set("bookingPageUrl", url);
  return fd;
}

describe("addGoogleCalendarAppointmentScheduleAction", () => {
  beforeEach(() => {
    __resetNavigationStub();
    __resetSdkExtensionsStub();
    addUserGoogleCalendarAppointmentSchedule.mockReset();
  });

  it("redirects to ?notice=schedule-saved on success", async () => {
    addUserGoogleCalendarAppointmentSchedule.mockResolvedValueOnce({});

    await expect(
      addGoogleCalendarAppointmentScheduleAction(
        formData("https://calendar.app.google/abc123"),
      ),
    ).rejects.toSatisfy((error: unknown) => __isRedirectSignal(error));

    expect(__getRedirectCalls()).toEqual([
      "/connectors/cinatra-ai/google-calendar-connector/setup?notice=schedule-saved",
    ]);
  });

  it("redirects to ?error=invalid-protocol — never the raw message — on the https-required failure", async () => {
    addUserGoogleCalendarAppointmentSchedule.mockRejectedValueOnce(
      new Error("Appointment schedule links must use https."),
    );

    await expect(
      addGoogleCalendarAppointmentScheduleAction(formData("http://calendar.app.google/abc123")),
    ).rejects.toSatisfy((error: unknown) => __isRedirectSignal(error));

    const calls = __getRedirectCalls();
    expect(calls).toEqual([
      "/connectors/cinatra-ai/google-calendar-connector/setup?error=invalid-protocol",
    ]);
    // The anti-pattern this migration retires: the raw exception text must
    // never appear in the redirect target.
    expect(calls[0]).not.toContain("https.");
  });

  it("redirects to ?error=invalid-host on the wrong-host failure", async () => {
    addUserGoogleCalendarAppointmentSchedule.mockRejectedValueOnce(
      new Error(
        "Use a public Google Calendar appointment schedule link from calendar.app.google.",
      ),
    );

    await expect(
      addGoogleCalendarAppointmentScheduleAction(formData("https://example.com/not-a-schedule")),
    ).rejects.toSatisfy((error: unknown) => __isRedirectSignal(error));

    expect(__getRedirectCalls()).toEqual([
      "/connectors/cinatra-ai/google-calendar-connector/setup?error=invalid-host",
    ]);
  });

  it("redirects to ?error=unexpected — not a leaked message — on an unrecognized failure", async () => {
    addUserGoogleCalendarAppointmentSchedule.mockRejectedValueOnce(
      new Error("some unforeseen internal failure detail"),
    );

    await expect(
      addGoogleCalendarAppointmentScheduleAction(formData("https://calendar.app.google/abc123")),
    ).rejects.toSatisfy((error: unknown) => __isRedirectSignal(error));

    const calls = __getRedirectCalls();
    expect(calls).toEqual([
      "/connectors/cinatra-ai/google-calendar-connector/setup?error=unexpected",
    ]);
    expect(calls[0]).not.toContain("unforeseen");
  });
});
