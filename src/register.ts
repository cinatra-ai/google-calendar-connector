// The google-calendar connector's `register(ctx)` server entry.
//
// Transport-registration cutover: the host no longer statically wires this
// connector — this entry binds the connector's host deps AT ACTIVATION (the
// connector-level Google-OAuth status probe + the per-user connection
// Check/Disconnect actions). SDK imports here stay TYPE-ONLY (host-peer
// value-import gate).
//
// The appointment-schedule store, its MCP tool, and the chat-user-context /
// appointment-schedules capability providers this entry used to also register
// moved to @cinatra-ai/google-appointment-schedules-connector (cinatra-ai/
// cinatra#2367 S1/S2) — register(ctx) now only binds the connection-management
// deps above. It requests no `mcp`/`settings` host ports: a diagnostic
// selfcheck probe that once exercised them was removed (it was exposed to
// agents in production with no runtime purpose).

import type {
  ExtensionHostContext,
  HostGoogleOAuthService,
  NangoSystemSurface,
} from "@cinatra-ai/sdk-extensions";
import { registerGoogleCalendarConnector } from "./deps";

const PACKAGE_NAME = "@cinatra-ai/google-calendar-connector";

// The connector's own Nango key — the shared Google OAuth per-service
// connection this connector reads/deletes. Matches the `googleCalendar` key the
// host's `ctx.nango.getPrimarySavedConnections()` roll-up returns.
const GOOGLE_CALENDAR_NANGO_KEY = "googleCalendar";

function hostGoogleOAuth(ctx: ExtensionHostContext): HostGoogleOAuthService {
  const provider = ctx.capabilities.resolveProviders("@cinatra-ai/host:google-oauth")[0];
  if (!provider) {
    throw new Error(
      `${PACKAGE_NAME}: host service "@cinatra-ai/host:google-oauth" is not registered — ` +
        `the host boot wiring (register-transport-connectors) must run before connector calls.`,
    );
  }
  return provider.impl as HostGoogleOAuthService;
}

// The nango gateway (a `systemExtension`, activated unguarded on every boot)
// registers its full host-facing surface under the reserved `nango-system`
// capability id. Resolve it LAZILY per call (probe-safe), like the other host
// services above. Used only by the user-scoped Disconnect action.
function nangoSystem(ctx: ExtensionHostContext): NangoSystemSurface {
  const provider = ctx.capabilities.resolveProviders("nango-system")[0];
  if (!provider) {
    throw new Error(
      `${PACKAGE_NAME}: system capability "nango-system" is not registered — ` +
        `the nango systemExtension must activate before connector calls.`,
    );
  }
  return provider.impl as NangoSystemSurface;
}

async function requireUserId(ctx: ExtensionHostContext): Promise<string> {
  const actor = await ctx.authSession.getActor();
  const userId = actor?.userId;
  if (!userId) {
    throw new Error(`${PACKAGE_NAME}: no authenticated session user.`);
  }
  return userId;
}

export function register(ctx: ExtensionHostContext): void {
  registerGoogleCalendarConnector({
    oauth: {
      getStatus: () => hostGoogleOAuth(ctx).getStatus(),
    },
    getUserConnectionStatus: async () => {
      const userId = await requireUserId(ctx);
      // Read the user's saved Nango connections via the SDK render port (the
      // same source the setup page's initial render reads). A missing
      // `googleCalendar` entry (or a host too old to expose the getter) means
      // no connection → disconnected.
      const connections = await ctx.nango.getPrimarySavedConnections?.({
        scope: "user",
        userId,
      });
      return connections?.[GOOGLE_CALENDAR_NANGO_KEY] ? "connected" : "disconnected";
    },
    disconnectUserConnection: async () => {
      const userId = await requireUserId(ctx);
      const nango = nangoSystem(ctx);
      // Revoke the upstream Nango connection, then clear this connector's saved
      // pointer records so the next status read fails closed. (The #952
      // connection-identity soft-delete lives in the host `@/lib` disconnect
      // path and is best-effort even there; the delete below removes the
      // credential itself.)
      const saved = nango.getPrimarySavedNangoConnection(GOOGLE_CALENDAR_NANGO_KEY, {
        scope: "user",
        userId,
      });
      if (saved) {
        await nango.deleteNangoConnection(saved.providerConfigKey, saved.connectionId);
      }
      await nango.clearNangoConnectionRecords(GOOGLE_CALENDAR_NANGO_KEY, {
        scope: "user",
        userId,
      });
    },
  });
}
