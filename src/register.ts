// The google-calendar connector's `register(ctx)` server entry.
//
// Transport-registration cutover: the host no longer statically wires this connector — this entry binds
// the connector's host deps AT ACTIVATION (legacy connector-config KV adapted
// from the `@cinatra-ai/host:connector-config` capability service, resolved
// LAZILY per call; the session user id from the granted `ctx.authSession`
// port). SDK imports here stay TYPE-ONLY (host-peer value-import gate).
//
// The connector's real primitive `google_calendar_appointments_list` is served
// by the manifest-discovered mcp-module (src/mcp/module.ts), NOT via `ctx.mcp`,
// so register(ctx) only binds deps + registers the chat-user-context and
// appointment-schedules capability providers. It requests no `mcp`/`settings`
// host ports: a diagnostic selfcheck probe that once exercised them was removed
// (it was exposed to agents in production with no runtime purpose).

import type {
  ExtensionHostContext,
  HostConnectorConfigService,
  HostGoogleOAuthService,
  NangoSystemSurface,
} from "@cinatra-ai/sdk-extensions";
import { registerGoogleCalendarConnector } from "./deps";
import {
  googleCalendarAppointmentSchedulesProvider,
  googleCalendarChatUserContextProvider,
} from "./index";

const PACKAGE_NAME = "@cinatra-ai/google-calendar-connector";

// The connector's own Nango key — the shared Google OAuth per-service
// connection this connector reads/deletes. Matches the `googleCalendar` key the
// host's `ctx.nango.getPrimarySavedConnections()` roll-up returns.
const GOOGLE_CALENDAR_NANGO_KEY = "googleCalendar";

function hostConfig(ctx: ExtensionHostContext): HostConnectorConfigService {
  const provider = ctx.capabilities.resolveProviders("@cinatra-ai/host:connector-config")[0];
  if (!provider) {
    throw new Error(
      `${PACKAGE_NAME}: host service "@cinatra-ai/host:connector-config" is not registered — ` +
        `the host boot wiring (register-transport-connectors) must run before connector calls.`,
    );
  }
  return provider.impl as HostConnectorConfigService;
}

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
    readConnectorConfigFromDatabase: (connectorId, fallback) =>
      hostConfig(ctx).read(connectorId, fallback),
    writeConnectorConfigToDatabase: (connectorId, value) =>
      hostConfig(ctx).write(connectorId, value),
    oauth: {
      getStatus: () => hostGoogleOAuth(ctx).getStatus(),
    },
    requireSessionUserId: () => requireUserId(ctx),
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

  // Chat user-context: contributes the user's appointment schedules to the
  // chat system prompt, registration-driven (the chat runner resolves this
  // capability instead of importing this package by name). The record carries
  // this package's name, so the host's transitional boot-bridge registration
  // of the SAME record idempotently collapses with this one.
  //
  // GUARDED: this connector's serverEntry is already activated by hosts whose
  // CHECKED-IN generated manifest predates this package's `capabilities` port
  // request — there the granted-port proxy fail-louds on access. Until the
  // host regenerates the manifest, degrade silently (the host boot bridge
  // registers the same record), and never let the grant gap skip the
  // registrations that follow below.
  try {
    ctx.capabilities.registerProvider(
      "chat-user-context",
      googleCalendarChatUserContextProvider,
    );
  } catch (err) {
    console.warn(
      `${PACKAGE_NAME}: chat-user-context registration skipped (capabilities port not granted yet):`,
      err instanceof Error ? err.message : err,
    );
  }

  // Structured appointment schedules for the host's CTA server action
  // (cinatra#151 Stage 4): packages/agents resolves `appointment-schedules`
  // instead of value-importing getStoredGoogleCalendarAppointments. Same
  // grant-gap guard as above (and the same cheap+local contract).
  try {
    ctx.capabilities.registerProvider(
      "appointment-schedules",
      googleCalendarAppointmentSchedulesProvider,
    );
  } catch (err) {
    console.warn(
      `${PACKAGE_NAME}: appointment-schedules registration skipped (capabilities port not granted yet):`,
      err instanceof Error ? err.message : err,
    );
  }
}
