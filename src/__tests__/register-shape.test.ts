// serverEntry `register(ctx)` — capability registration shape, re-specified
// for the contract-safe extraction (cinatra-ai/google-calendar-connector#55 /
// cinatra-ai/cinatra#2367 S2): the appointment-schedules and chat-user-context
// capability providers this entry used to register moved to
// @cinatra-ai/google-appointment-schedules-connector along with the store that
// backed them (S1/S2). register(ctx) now performs NO capability-provider
// registration at all — it only binds the connection-management deps
// (oauth.getStatus / getUserConnectionStatus / disconnectUserConnection) via
// registerGoogleCalendarConnector, with no host-service I/O at activation.

import { describe, it, expect, vi, beforeEach } from "vitest";

import { register } from "../register";
import { _resetGoogleCalendarDepsForTests, getGoogleCalendarDeps } from "../deps";
import type { ExtensionHostContext } from "@cinatra-ai/sdk-extensions";

type Registered = Map<string, { packageName: string; impl: unknown }[]>;

function makeCtx() {
  const registered: Registered = new Map();
  const resolveProviders = vi.fn((capability: string) =>
    capability === "@cinatra-ai/host:google-oauth"
      ? [{ packageName: "@cinatra-ai/host", impl: { getStatus: vi.fn(async () => ({ status: "connected" as const })) } }]
      : capability === "nango-system"
        ? [
            {
              packageName: "@cinatra-ai/host",
              impl: {
                getPrimarySavedNangoConnection: vi.fn(),
                deleteNangoConnection: vi.fn(),
                clearNangoConnectionRecords: vi.fn(),
              },
            },
          ]
        : [],
  );
  const ctx = {
    capabilities: {
      registerProvider: (capability: string, provider: { packageName: string; impl: unknown }) => {
        const list = registered.get(capability) ?? [];
        list.push(provider);
        registered.set(capability, list);
      },
      resolveProviders,
    },
    authSession: { getActor: vi.fn(async () => ({ userId: "u1" })) },
    nango: { getPrimarySavedConnections: vi.fn(async () => ({})) },
  } as unknown as ExtensionHostContext;
  return { ctx, registered, resolveProviders };
}

beforeEach(() => {
  vi.clearAllMocks();
  _resetGoogleCalendarDepsForTests();
});

describe("register(ctx) — capability shape (post-extraction)", () => {
  it("registers NO capability providers and performs NO host-service I/O at activation", () => {
    const { ctx, registered, resolveProviders } = makeCtx();
    register(ctx);
    expect([...registered.keys()]).toEqual([]);
    expect(resolveProviders).not.toHaveBeenCalled();
  });

  it("binds only the connection-management deps (oauth, getUserConnectionStatus, disconnectUserConnection)", () => {
    const { ctx } = makeCtx();
    register(ctx);
    const deps = getGoogleCalendarDeps();
    expect(Object.keys(deps).sort()).toEqual([
      "disconnectUserConnection",
      "getUserConnectionStatus",
      "oauth",
    ]);
  });

  it("oauth.getStatus() lazily resolves the host google-oauth service (no eager I/O)", async () => {
    const { ctx, resolveProviders } = makeCtx();
    register(ctx);
    expect(resolveProviders).not.toHaveBeenCalled();

    const status = await getGoogleCalendarDeps().oauth.getStatus();
    expect(resolveProviders).toHaveBeenCalledWith("@cinatra-ai/host:google-oauth");
    expect(status).toEqual({ status: "connected" });
  });
});
