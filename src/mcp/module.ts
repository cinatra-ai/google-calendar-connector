import type { ExtensionMcpToolServer } from "@cinatra-ai/sdk-extensions";
import { registerGoogleCalendarPrimitives } from "./registry";
import type { GoogleCalendarActorResolver } from "./handlers";

// The host calls this factory (manifest-discovered) with a uniform options
// object carrying `resolveActor` — the trusted request/run actor resolver.
// Thread it into the primitive handlers so `google_calendar_appointments_list`
// reads the invoking user's per-user store. Connectors that ignore it degrade
// to instance-scoped reads (the pre-fix behavior); this one consumes it.
export function createGoogleCalendarModule(deps?: { resolveActor?: GoogleCalendarActorResolver }) {
  return {
    registerCapabilities: (server: ExtensionMcpToolServer) =>
      registerGoogleCalendarPrimitives(server, deps?.resolveActor),
  };
}
