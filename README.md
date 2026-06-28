# Google Calendar

Google Calendar connector for Cinatra. Stores users' public appointment-schedule booking links (`calendar.app.google`) and surfaces them to Cinatra agents, so agents can embed the right scheduling URL in outbound messages without manual link management. Full documentation lives in the Integrations hub at https://docs.cinatra.ai/integrations/google-calendar/

## Works with

- Cinatra (connector kind: `connector`)

## Capabilities

- Register a Google Calendar appointment-schedule link per workspace user
- List stored appointment schedules via the `google_calendar_appointments_list` MCP tool
- Contribute scheduling links to the chat system prompt via the `chat-user-context` capability
- Surface structured `{ title, bookingPageUrl }` rows to host call-to-action surfaces via the `appointment-schedules` capability
- Diagnostic settings round-trip via the `google_calendar_extension_selfcheck` MCP tool
