// The google-calendar connector's `register(ctx)` server entry.
//
// Proof slice for the `mcp` + `settings` host ports: registers a UNIQUELY-named
// diagnostic tool via ctx.mcp.registerTool whose handler also round-trips
// ctx.settings (set → get → delete). The tool is NOT registered by any static
// module, so its presence in tools/list + a working tools/call UNAMBIGUOUSLY
// proves the register(ctx) → ctx.mcp path; and the round-trip proves the
// request-time `settings` port works from a handler that captured `ctx` at
// register time. The connector's real primitive `google_calendar_appointments_list`
// is still served by the static mcp-module — left untouched.

import type { ExtensionHostContext } from "@cinatra-ai/sdk-extensions";

export const SELFCHECK_TOOL_NAME = "google_calendar_extension_selfcheck";
const PACKAGE_NAME = "@cinatra-ai/google-calendar-connector";

export function register(ctx: ExtensionHostContext): void {
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
