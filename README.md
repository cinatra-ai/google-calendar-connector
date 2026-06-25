# Google Calendar

Surface your Google Calendar appointment booking pages inside Cinatra so agents can share them automatically. Each user registers their public `calendar.app.google` scheduling links once, and Cinatra agents insert the right "book a time with me" link into outbound messages and other surfaces without manual copy-paste.

## Works with

- Cinatra (connector kind: `connector`)

## Capabilities

- Register a Google Calendar appointment-schedule link for a user
- Surface a list of bookable appointment schedules to Cinatra agents
- Refresh the stored title and description from each public booking page
- Insert the right scheduling link into outbound messages

---

## Purpose

The Google Calendar connector bridges Google Calendar's public appointment-scheduling feature with Cinatra's agent runtime. Users paste a public booking-page URL (a `calendar.app.google/…` share link, not a full calendar sync), and Cinatra stores the link's title and description. From that point on, agents can look up the right scheduling URL for a given user and embed it in messages or call-to-action surfaces — no manual link management required.

The connector does **not** read or write calendar events; it stores and serves appointment-schedule *links* only.

## Install

This connector ships as part of the Cinatra platform. It is not installed independently — the Cinatra marketplace distributes it as a first-party connector under the package name `@cinatra-ai/google-calendar-connector`.

To enable it on your Cinatra instance, go to **Connectors** in the admin panel and activate **Google Calendar**.

## Configuration

### Prerequisites

1. **Google OAuth credentials** — The Google Calendar connector shares the OAuth client configured in the **Google OAuth** connector. Set your Google Cloud Console OAuth client ID and secret there first (`Connectors → Google OAuth → Setup`). Create credentials at [Google Cloud Console → APIs & credentials](https://console.cloud.google.com/apis/credentials) if you have not done so.

2. **Connect your Google Calendar account** — Once OAuth credentials are in place, open `Connectors → Google Calendar → Setup` and click **Connect Google Calendar**. Authenticate with the Google account whose appointment schedules you want to share.

### Adding an appointment schedule

After connecting, paste a public appointment-schedule booking URL into the **Booking page URL** field on the setup page and click **Add schedule**.

A valid URL looks like:

```
https://calendar.app.google/AbCdEfGhIj123
```

To obtain a public appointment-schedule link in Google Calendar:

1. Open Google Calendar and click **Create → Appointment schedule**.
2. Configure your availability and save.
3. Click **Share** and copy the public booking link.
4. Paste it into the Cinatra setup page.

You can register multiple scheduling links. Cinatra stores each link's title and description (fetched from the public booking page) and makes all of them available to agents.

### Per-user scoping

Appointment schedules are stored per workspace member. Each user manages their own links from the connector setup page. Saving a schedule requires a workspace membership (workspace `read` access is sufficient — no admin role needed).

## Usage

Once at least one appointment-schedule link is saved, Cinatra agents automatically have access to it. Agents use the `google_calendar_appointments_list` tool to retrieve the current list of stored schedules for a user:

**Example response from `google_calendar_appointments_list`:**

```json
{
  "items": [
    {
      "title": "30-minute intro call",
      "bookingPageUrl": "https://calendar.app.google/AbCdEfGhIj123"
    }
  ],
  "total": 1,
  "syncedAt": "2025-01-15T10:30:00.000Z"
}
```

Agents receive `items` (a list of title + booking URL pairs), `total` (count), and `syncedAt` (when the store was last written). The agent picks the appropriate link and includes it in the outbound message or surface.

## API contract

The connector exposes one MCP tool and two capability providers to the Cinatra host.

### MCP tool: `google_calendar_appointments_list`

Returns the stored appointment schedules.

| Field | Type | Description |
|---|---|---|
| `items` | `{ title: string; bookingPageUrl: string }[]` | Stored schedules (sanitized: only `calendar.app.google` URLs are returned) |
| `total` | `number` | Number of items |
| `syncedAt` | `string \| null` | ISO 8601 timestamp of the last write, or `null` if the store is empty |

Input: none (empty object).

### Capability: `chat-user-context`

Contributes the user's appointment schedules to the chat system prompt as a formatted string so models can reference them without an explicit tool call.

### Capability: `appointment-schedules`

Returns structured `{ title, bookingPageUrl }` rows for a given `userId`. Used by the host's call-to-action server actions to embed scheduling links in rendered surfaces.

## Development

### Requirements

- Node.js (version matching the workspace toolchain)
- The `@cinatra-ai/sdk-extensions` and `@cinatra-ai/sdk-ui` peer packages (provided by the Cinatra host)

### Running tests

```bash
npm test
```

Tests use [Vitest](https://vitest.dev/). The test suite covers:

- `register(ctx)` capability registration shape: verifies that `chat-user-context` and `appointment-schedules` providers are registered and that no host-service I/O occurs at activation time.
- `appointment-schedules` provider: verifies that only public `calendar.app.google` URLs are returned (non-matching URLs are silently dropped during sanitization).

### Linting

```bash
npm run lint
```

### Host dependency injection

The connector uses a dependency-injection pattern (`src/deps.ts`) to avoid importing host internals directly. At activation, the host calls `registerGoogleCalendarConnector(deps)` to bind:

- `readConnectorConfigFromDatabase` / `writeConnectorConfigToDatabase` — connector-scoped key-value persistence
- `requireSessionUserId` — resolves the authenticated session user's ID (throws if no session)
- `oauth.getStatus()` — checks whether the shared Google OAuth client is configured

In tests, call `registerGoogleCalendarConnector(stubDeps)` in your setup block and `_resetGoogleCalendarDepsForTests()` in teardown.

## Troubleshooting

### "Save your Google OAuth client ID and secret in Google OAuth configuration first"

The **Connect Google Calendar** button is disabled because no shared Google OAuth credentials are configured. Go to `Connectors → Google OAuth → Setup`, enter your Google Cloud Console client ID and secret, and save. Then return to the Google Calendar setup page.

### "Use a public Google Calendar appointment schedule link from calendar.app.google"

Only `calendar.app.google/…` URLs are accepted. Make sure you are pasting a **public appointment-schedule share link**, not a calendar URL, event link, or invite URL. The link must start with `https://calendar.app.google/`.

### "Appointment schedule links must use https"

The URL you submitted uses `http` instead of `https`. Google Calendar share links are always `https`; copy the link directly from Google Calendar to avoid this.

### "Unable to load the appointment schedule page"

Cinatra fetches the booking page to read its title and description. This error means the URL returned an HTTP error (the status code is included in the message). Check that:

- The URL is correct and the appointment schedule exists.
- The schedule is set to **public** visibility in Google Calendar.
- There are no network restrictions blocking outbound requests to `calendar.app.google` from your Cinatra host.

### Saved schedules disappear after reconnecting

Appointment schedules are stored independently from the OAuth connection. Reconnecting (or disconnecting) your Google Calendar account does not clear saved schedule links. If schedules are missing, check that the correct workspace user is logged in — schedules are stored per user.

### Diagnostic: selfcheck tool

The connector registers a `google_calendar_extension_selfcheck` MCP tool that performs a settings round-trip (set → get → delete) and returns `{ ok, via, packageName, settingsRoundTrip }`. Run it from the Cinatra MCP inspector to confirm the connector's host port wiring is healthy.
