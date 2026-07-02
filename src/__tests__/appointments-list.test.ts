// Unit tests for the agent-facing `google_calendar_appointments_list` MCP
// primitive handler — pins that it reads the INVOKING USER's per-user store
// (`google_calendar_user:<id>`), resolving the trusted actor from EITHER the
// host-injected `resolveActor` (MCP-module path) OR `request.actor.userId`
// (in-process primitive/passthrough path). Regression cover for the storage-key
// bug where the handler read the legacy instance key `google_calendar` and so
// never saw the user's schedules.

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ExtensionPrimitiveRequest, ExtensionMcpToolServer } from "@cinatra-ai/sdk-extensions";

import {
  registerGoogleCalendarConnector,
  _resetGoogleCalendarDepsForTests,
  type GoogleCalendarConnectorDeps,
} from "../deps";
import { createGoogleCalendarPrimitiveHandlers } from "../mcp/handlers";
import { createGoogleCalendarModule } from "../mcp/module";

type Store = Record<string, unknown>;

function stubDeps(store: Store) {
  const reads: string[] = [];
  const writes: Array<{ id: string; value: unknown }> = [];
  const deps: GoogleCalendarConnectorDeps = {
    readConnectorConfigFromDatabase<T>(connectorId: string, fallback: T): T {
      reads.push(connectorId);
      return connectorId in store ? (store[connectorId] as T) : fallback;
    },
    writeConnectorConfigToDatabase(connectorId: string, value: unknown): void {
      writes.push({ id: connectorId, value });
      store[connectorId] = value;
    },
    requireSessionUserId: async () => {
      throw new Error("requireSessionUserId is not exercised by the list handler");
    },
    oauth: {
      getStatus: async () => ({ status: "not_connected" as const }),
    },
  };
  return { deps, reads, writes };
}

// A public schedule (kept) + a non-public one (dropped by sanitize).
const SCHEDULES_U1 = {
  calendarAppointments: [
    { id: "a1", title: "Intro call", bookingPageUrl: "https://calendar.app.google/abc123" },
    { id: "a2", title: "Not public", bookingPageUrl: "https://evil.example.com/xyz" },
  ],
  calendarAppointmentsSyncedAt: "2026-01-01T00:00:00.000Z",
};

const INTRO_CALL = { title: "Intro call", bookingPageUrl: "https://calendar.app.google/abc123" };

function req(actor: unknown, input: unknown = {}): ExtensionPrimitiveRequest<unknown> {
  return { primitiveName: "google_calendar_appointments_list", input, actor, mode: "agentic" };
}

const AGENT_ACTOR = { actorType: "model", source: "agent" };

beforeEach(() => {
  _resetGoogleCalendarDepsForTests();
  vi.restoreAllMocks();
});

describe("google_calendar_appointments_list — storage-key resolution", () => {
  it("reads the per-user key via the host-injected resolveActor (MCP-module path)", async () => {
    const store: Store = { "google_calendar_user:u1": SCHEDULES_U1 };
    const { deps, reads } = stubDeps(store);
    registerGoogleCalendarConnector(deps);

    const handlers = createGoogleCalendarPrimitiveHandlers(async () => ({ userId: "u1" }));
    // MCP-module path: the synthesized request actor carries NO userId.
    const result = await handlers.google_calendar_appointments_list(req(AGENT_ACTOR));

    expect(reads).toContain("google_calendar_user:u1");
    expect(reads).not.toContain("google_calendar");
    expect(result).toEqual({ items: [INTRO_CALL], total: 1, syncedAt: "2026-01-01T00:00:00.000Z" });
  });

  it("reads the per-user key from request.actor.userId (in-process primitive path)", async () => {
    const store: Store = { "google_calendar_user:u1": SCHEDULES_U1 };
    const { deps, reads } = stubDeps(store);
    registerGoogleCalendarConnector(deps);

    // No resolveActor — this is exactly how the manifest primitive-handlers
    // factory is invoked (createGoogleCalendarPrimitiveHandlers()).
    const handlers = createGoogleCalendarPrimitiveHandlers();
    const result = await handlers.google_calendar_appointments_list(
      req({ actorType: "human", userId: "u1", orgId: "o1" }),
    );

    expect(reads).toContain("google_calendar_user:u1");
    expect(result.items).toEqual([INTRO_CALL]);
    expect(result.total).toBe(1);
  });

  it("does NOT surface the legacy instance store when a user is present", async () => {
    // The instance key holds DIFFERENT data; the per-user store must win.
    const store: Store = {
      google_calendar: {
        calendarAppointments: [
          { id: "x", title: "Instance leak", bookingPageUrl: "https://calendar.app.google/instance" },
        ],
      },
      "google_calendar_user:u1": SCHEDULES_U1,
    };
    const { deps } = stubDeps(store);
    registerGoogleCalendarConnector(deps);

    const handlers = createGoogleCalendarPrimitiveHandlers(async () => ({ userId: "u1" }));
    const result = await handlers.google_calendar_appointments_list(req(AGENT_ACTOR));

    expect(result.items).toEqual([INTRO_CALL]);
  });

  it("falls back to the legacy instance key only when no actor supplies a userId", async () => {
    const store: Store = {
      google_calendar: {
        calendarAppointments: [
          { id: "x", title: "Instance", bookingPageUrl: "https://calendar.app.google/instance" },
        ],
        calendarAppointmentsSyncedAt: "2026-02-02T00:00:00.000Z",
      },
    };
    const { deps, reads } = stubDeps(store);
    registerGoogleCalendarConnector(deps);

    const handlers = createGoogleCalendarPrimitiveHandlers();
    const result = await handlers.google_calendar_appointments_list(req(AGENT_ACTOR));

    expect(reads).toContain("google_calendar");
    expect(result.items).toEqual([
      { title: "Instance", bookingPageUrl: "https://calendar.app.google/instance" },
    ]);
  });

  it("fails closed (empty) when the resolver and the request actor disagree", async () => {
    const store: Store = {
      "google_calendar_user:u1": SCHEDULES_U1,
      "google_calendar_user:u2": {
        calendarAppointments: [
          { id: "b1", title: "Other user", bookingPageUrl: "https://calendar.app.google/other" },
        ],
      },
    };
    const { deps } = stubDeps(store);
    registerGoogleCalendarConnector(deps);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const handlers = createGoogleCalendarPrimitiveHandlers(async () => ({ userId: "u1" }));
    const result = await handlers.google_calendar_appointments_list(
      req({ actorType: "human", userId: "u2", orgId: "o1" }),
    );

    expect(result).toEqual({ items: [], total: 0, syncedAt: null });
    expect(warn).toHaveBeenCalledOnce();
  });

  it("drops non-public booking URLs (sanitize) before returning", async () => {
    const store: Store = { "google_calendar_user:u1": SCHEDULES_U1 };
    const { deps } = stubDeps(store);
    registerGoogleCalendarConnector(deps);

    const handlers = createGoogleCalendarPrimitiveHandlers(async () => ({ userId: "u1" }));
    const result = await handlers.google_calendar_appointments_list(req(AGENT_ACTOR));

    expect(result.items).toHaveLength(1);
    expect(result.items.every((i) => i.bookingPageUrl.startsWith("https://calendar.app.google/"))).toBe(true);
  });

  it("module→registry wiring threads resolveActor into the registered tool", async () => {
    const store: Store = { "google_calendar_user:u1": SCHEDULES_U1 };
    const { deps, reads } = stubDeps(store);
    registerGoogleCalendarConnector(deps);

    let captured: ((input: unknown, extra?: unknown) => Promise<{ structuredContent?: Record<string, unknown> }>) | undefined;
    const fakeServer = {
      registerTool: (
        _name: string,
        _config: unknown,
        handler: (input: unknown, extra?: unknown) => Promise<{ structuredContent?: Record<string, unknown> }>,
      ) => {
        captured = handler;
      },
    };

    createGoogleCalendarModule({ resolveActor: async () => ({ userId: "u1" }) }).registerCapabilities(
      fakeServer as unknown as ExtensionMcpToolServer,
    );

    expect(captured).toBeTypeOf("function");
    const wrapped = await captured!({});
    expect(reads).toContain("google_calendar_user:u1");
    expect(wrapped.structuredContent).toEqual({
      items: [INTRO_CALL],
      total: 1,
      syncedAt: "2026-01-01T00:00:00.000Z",
    });
  });
});
