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
} from "@cinatra-ai/sdk-extensions";
import { registerGoogleCalendarConnector } from "./deps";
import {
  googleCalendarAppointmentSchedulesProvider,
  googleCalendarChatUserContextProvider,
} from "./index";

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
}
