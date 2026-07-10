// Regression pins for the three setup-page changes requested in the owner
// review on pull/45 (CHANGES_REQUESTED, 2026-07-10). The setup page is an async
// server component composed from `@cinatra-ai/sdk-ui/*` primitives that this
// connector package does not resolve in isolation (host-provided at build
// time), so — matching the node-only test environment of this repo — these
// pins assert against the authored source of `../setup-page.tsx`. Each `it`
// maps 1:1 to one owner-requested change so a regression names the exact ask.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const src = readFileSync(
  fileURLToPath(new URL("../setup-page.tsx", import.meta.url)),
  "utf8",
);

// Collapse insignificant JSX whitespace so multi-line elements match as text.
const flat = src.replace(/\s+/g, " ");

describe("setup-page — owner review pull/45 changes", () => {
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

  it('change 3: the "Add an appointment schedule" form is no longer wrapped in a card at the top of the tab', () => {
    // The heading is preceded by a plain <section>, not a soft-panel card.
    expect(flat).toContain(
      "<section> <h2 " +
        'className="mb-3 text-sm font-semibold text-foreground"> ' +
        "Add an appointment schedule",
    );
    expect(flat).not.toContain(
      '<section className="soft-panel rounded-panel p-5"> ' +
        "<h2 className=\"mb-3 text-sm font-semibold text-foreground\"> " +
        "Add an appointment schedule",
    );
  });
});
