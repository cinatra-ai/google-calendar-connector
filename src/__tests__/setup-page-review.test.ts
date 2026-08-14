// Regression pins for the setup page, re-specified for the contract-safe
// appointment-schedules extraction (cinatra-ai/google-calendar-connector#55 /
// cinatra-ai/cinatra#2367 S2). The setup page is an async server component
// composed from `@cinatra-ai/sdk-ui/*` primitives that this connector package
// does not resolve in isolation (host-provided at build time), so — matching
// the node-only test environment of this repo — these pins assert against the
// authored source of `../setup-page.tsx`.
//
// Change 1 & 2 carry forward the owner review pull/45 pins (still true of the
// retained connection UI). Change 3 replaces the old "appointment form isn't
// card-wrapped" pin — that form is gone — with the grep-proof assertion that
// no appointment surface (tab, form, prose) remains on this page.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const src = readFileSync(
  fileURLToPath(new URL("../setup-page.tsx", import.meta.url)),
  "utf8",
);

// Collapse insignificant JSX whitespace so multi-line elements match as text.
const flat = src.replace(/\s+/g, " ");

describe("setup-page — owner review pull/45 changes (carried forward)", () => {
  it('change 1: the connect button label is "Connect" (spec), not "Connect Google Calendar"', () => {
    expect(src).toContain('connectLabel="Connect"');
    expect(src).not.toContain('connectLabel="Connect Google Calendar"');
    // No stray full-label copy left anywhere on the page.
    expect(src).not.toContain("Connect Google Calendar");
  });

  it('change 2: the "Not connected" card holds only the credentials line, with "Google OAuth credentials" linking to the google-oauth setup page', () => {
    // The exact requested sentence, with the link on "Google OAuth credentials".
    expect(flat).toContain(
      'Connecting requires shared{" "} ' +
        '<Link href="/connectors/cinatra-ai/google-oauth-connector/setup"> ' +
        "Google OAuth credentials </Link> .",
    );
    // Everything else the card used to carry in the not-connected state is gone:
    // no "Not connected" status text, and none of the old card's multi-link
    // prerequisite prose ("Save your client ID and secret in …"). (The Help tab
    // keeps its own how-to prose — not this card — so those links live on there,
    // which is why the assertions below are scoped to the removed card copy.)
    expect(src).not.toContain("Not connected");
    expect(src).not.toContain("Save your client ID and secret in");
  });
});

describe("setup-page — appointment-schedules extraction (cinatra#2367 S2)", () => {
  it("carries no Appointment schedules tab, form, or saved-schedule rendering", () => {
    // Checks the LIVE surface (JSX tags / user-facing copy), not the file's
    // explanatory comments — those legitimately name the old tab/feature to
    // document where it moved to.
    expect(src).not.toContain('<TabsTrigger value="appointments">');
    expect(src).not.toContain('value="appointments"');
    expect(src).not.toContain("Add an appointment schedule");
    expect(src).not.toContain("Add schedule");
    expect(src).not.toContain("bookingPageUrl");
    expect(src).not.toContain("Saved schedules");
    expect(src).not.toContain("No appointment schedules saved yet");
  });

  it("no longer imports the appointment store, the add-schedule action, or the appointment-only form components", () => {
    expect(src).not.toContain("getStoredGoogleCalendarAppointments");
    expect(src).not.toContain("addGoogleCalendarAppointmentScheduleAction");
    expect(src).not.toContain("./components/ui/field");
    expect(src).not.toContain("./components/ui/input-group");
  });

  it("the Help tab carries no appointment-schedule prose", () => {
    expect(src).not.toContain("appointment-schedule share links");
    expect(src).not.toContain("booking link");
    expect(src).not.toContain("calendar.app.google");
  });

  it("the tab list is exactly Setup then Help", () => {
    const triggerValues = [...flat.matchAll(/<TabsTrigger value="([^"]+)"/g)].map(
      (m) => m[1],
    );
    expect(triggerValues).toEqual(["setup", "help"]);
  });

  it("still retains the Check/Disconnect connection actions", () => {
    expect(src).toContain("checkGoogleCalendarStatusAction");
    expect(src).toContain("disconnectGoogleCalendarConnectionAction");
    expect(src).toContain("DisconnectAction");
    expect(src).toContain("ConnectionStatusPanel");
  });
});
