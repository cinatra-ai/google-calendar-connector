# Google Calendar

Google Calendar connector for Cinatra. Lets a workspace member connect their Google Calendar account via OAuth through Nango, so other Cinatra features can identify which calendar to act on. Full documentation lives in the Integrations hub at https://docs.cinatra.ai/integrations/

## Works with

- Cinatra (connector kind: `connector`)
- `@cinatra-ai/google-appointment-schedules-connector` — the dependent connector that stores and surfaces users' appointment-schedule booking links, reusing this connector's account connection

## Capabilities

- Connect / reconnect / disconnect a workspace member's Google Calendar account via Nango OAuth
- Report the connection status (connected / disconnected) via a live re-probe (the Check action)
- Gate the connect flow on the shared Google OAuth client's configuration state
