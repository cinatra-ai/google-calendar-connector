// TEST STUB — minimal stand-in for @cinatra-ai/sdk-extensions's root export
// (a host-internal package this repo declares as an OPTIONAL peerDependency;
// not resolvable from a standalone `pnpm install` here — see
// __stubs__/flash-href.ts for the full rationale). Only
// `requireExtensionAction` is stubbed: the one runtime (non type-only) import
// setup-actions.ts pulls from the package root. It resolves immediately
// (the real guard's pass/fail behavior is out of scope for the
// toast-migration tests this stub supports).
import { vi } from "vitest";

export const requireExtensionAction = vi.fn(async () => undefined);

export function __resetSdkExtensionsStub() {
  requireExtensionAction.mockClear();
}
