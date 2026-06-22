// The google-calendar connector's `register(ctx)` server entry.
//
// Transport-registration cutover: the host no longer statically wires this connector — this entry binds
// the connector's host deps AT ACTIVATION (legacy connector-config KV adapted
// from the `@cinatra-ai/host:connector-config` capability service, resolved
// LAZILY per call; the session user id from the granted `ctx.authSession`
// port). SDK imports here stay TYPE-ONLY (host-peer value-import gate).
//
// It also keeps the original proof slice for the `mcp` + `settings` host
// ports: a UNIQUELY-named diagnostic tool whose handler round-trips
// ctx.settings (set → get → delete), proving the register(ctx) → ctx.mcp path
// and the request-time `settings` port from a handler that captured `ctx` at
// register time. The connector's real primitive
// `google_calendar_appointments_list` is still served by the static mcp-module.

import type {
  ExtensionHostContext,
  HostConnectorConfigService,
  HostGoogleOAuthService,
} from "@cinatra-ai/sdk-extensions";
import { registerGoogleCalendarConnector } from "./deps";
import {
  googleCalendarAppointmentSchedulesProvider,
  googleCalendarChatUserContextProvider,
} from "./index";

export const SELFCHECK_TOOL_NAME = "google_calendar_extension_selfcheck";
const PACKAGE_NAME = "@cinatra-ai/google-calendar-connector";

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

export function register(ctx: ExtensionHostContext): void {
  registerGoogleCalendarConnector({
    readConnectorConfigFromDatabase: (connectorId, fallback) =>
      hostConfig(ctx).read(connectorId, fallback),
    writeConnectorConfigToDatabase: (connectorId, value) =>
      hostConfig(ctx).write(connectorId, value),
    oauth: {
      getStatus: () => hostGoogleOAuth(ctx).getStatus(),
    },
    requireSessionUserId: async () => {
      const actor = await ctx.authSession.getActor();
      const userId = actor?.userId;
      if (!userId) {
        throw new Error(`${PACKAGE_NAME}: no authenticated session user.`);
      }
      return userId;
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

  ctx.mcp.registerTool({
    name: SELFCHECK_TOOL_NAME,
    description:
      "Diagnostic: confirms the google-calendar connector activated through the extension host ports " +
      "(register(ctx) → ctx.mcp + a ctx.settings round-trip). Returns { ok, via, packageName, settingsRoundTrip }.",
    handler: async () => {
      // Request-time settings round-trip via the ctx captured at register time.
      const probeKey = "selfcheck_probe";
      await ctx.settings.set(probeKey, { probedVia: "register(ctx)" });
      const readBack = await ctx.settings.get<{ probedVia?: string }>(probeKey);
      await ctx.settings.delete(probeKey);
      return {
        ok: true,
        via: "register(ctx)",
        packageName: PACKAGE_NAME,
        settingsRoundTrip: readBack?.probedVia === "register(ctx)",
      };
    },
  });
}
