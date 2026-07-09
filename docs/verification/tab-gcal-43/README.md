# Verification evidence — google-calendar-connector#43

Dedicated "Appointment schedules" tab + Help last, per the connector-setup-tabs
epic (cinatra-ai/cinatra#1101) tablist conformance contract.

Screenshots captured via Playwright against a live, production-equivalent local
dev-boot (real Postgres/Redis/Next.js dev server) — not a stub or fixture route.

1. `01-connection-tab.png` — default state, Connection (primary) tab selected,
   full tab order visible (Connection, Appointment schedules, Help), etched
   paired-line rule to the page edge.
2. `02-appointments-tab-empty.png` — Appointment schedules tab selected (real
   mouse click), narrow (max-w-xl) content, empty state.
3. `03-help-tab.png` — Help tab, always last, read-only content, narrow
   content.
4. `04-keyboard-focus-ring.png` — real (trusted) keyboard ArrowRight from
   Connection landing on Appointment schedules, with a visible focus-visible
   ring.

This branch carries only the evidence images; it is not merged into `main`.
