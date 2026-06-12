// serverEntry `register(ctx)` — capability registration shape (cinatra#151
// Stage 4).
//
// Pins:
//   - the capability id set register(ctx) publishes (the appointment-schedules
//     surface joins chat-user-context; the selfcheck MCP tool keeps riding
//     ctx.mcp);
//   - the appointment-schedules impl: structured `{ title, bookingPageUrl }`
//     rows read through the ctx-bound deps (host connector-config service) —
//     the host's CTA server action consumes exactly this shape instead of
//     value-importing getStoredGoogleCalendarAppointments;
//   - registration-only activation (no host-service I/O at register time).

import { describe, it, expect, vi, beforeEach } from "vitest";

import { register } from "../register";
import type { ExtensionHostContext } from "@cinatra-ai/sdk-extensions";

type Registered = Map<string, { packageName: string; impl: unknown }[]>;

function makeCtx(configRows: Record<string, unknown>) {
  const registered: Registered = new Map();
  const read = vi.fn((connectorId: string, fallback: unknown) => {
    return configRows[connectorId] ?? fallback;
  });
  const write = vi.fn();
  const ctx = {
    capabilities: {
      registerProvider: (capability: string, provider: { packageName: string; impl: unknown }) => {
        const list = registered.get(capability) ?? [];
        list.push(provider);
        registered.set(capability, list);
      },
      resolveProviders: (capability: string) =>
        capability === "@cinatra-ai/host:connector-config"
          ? [{ packageName: "@cinatra-ai/host", impl: { read, write, delete: vi.fn() } }]
          : [],
    },
    authSession: { getActor: vi.fn(async () => ({ userId: "u1" })) },
    mcp: { registerTool: vi.fn() },
    settings: { set: vi.fn(), get: vi.fn(), delete: vi.fn() },
  } as unknown as ExtensionHostContext;
  return { ctx, registered, read };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("register(ctx) — capability shape", () => {
  it("registers chat-user-context + appointment-schedules and performs NO host-service I/O at activation", () => {
    const { ctx, registered, read } = makeCtx({});
    register(ctx);
    expect([...registered.keys()].sort()).toEqual([
      "appointment-schedules",
      "chat-user-context",
    ]);
    expect(read).not.toHaveBeenCalled();
  });

  it("appointment-schedules: structured per-user schedules from the synced store (sanitized: public booking URLs only)", () => {
    const { ctx, registered } = makeCtx({
      "google_calendar_user:u1": {
        calendarAppointments: [
          {
            id: "a1",
            title: "Intro call",
            bookingPageUrl: "https://calendar.app.google/abc123",
          },
          {
            id: "a2",
            title: "Private link (dropped by sanitize)",
            bookingPageUrl: "https://evil.example.com/xyz",
          },
        ],
      },
    });
    register(ctx);
    const provider = registered.get("appointment-schedules")?.[0];
    expect(provider?.packageName).toBe("@cinatra-ai/google-calendar-connector");
    const impl = provider?.impl as {
      getSchedules(input: { userId?: string }): { title: string; bookingPageUrl: string }[];
    };
    expect(impl.getSchedules({ userId: "u1" })).toEqual([
      { title: "Intro call", bookingPageUrl: "https://calendar.app.google/abc123" },
    ]);
  });

  it("appointment-schedules: empty store -> empty schedules (no throw)", () => {
    const { ctx, registered } = makeCtx({});
    register(ctx);
    const impl = registered.get("appointment-schedules")?.[0]?.impl as {
      getSchedules(input: { userId?: string }): unknown[];
    };
    expect(impl.getSchedules({ userId: "u1" })).toEqual([]);
  });
});
