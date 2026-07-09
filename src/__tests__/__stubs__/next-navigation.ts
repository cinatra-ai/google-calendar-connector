// TEST STUB — a minimal controllable stand-in for next/navigation's
// useSearchParams/usePathname/useRouter/redirect, aliased in vitest.config.ts
// so search-param-toast.test.tsx (client) and setup-actions.test.ts (server
// action) can drive this repo's toast-migration wiring without a real Next.js
// runtime (this repo has no Next dependency installed standalone — see
// flash-href.ts stub comment).
import { useSyncExternalStore } from "react";

let current = new URLSearchParams();
const pathname = "/connectors/cinatra-ai/google-calendar-connector/setup";
let replaceCalls: string[] = [];
let redirectCalls: string[] = [];
const listeners = new Set<() => void>();

// Real next/navigation's redirect() throws a special NEXT_REDIRECT error to
// unwind the Server Action — a caller relying on "the function returns after
// redirect()" would be wrong in production too. This stub records the target
// then throws the same way, so a test exercising the real control flow (e.g.
// the catch-block redirect in setup-actions.ts) can't silently fall through
// to a second redirect() call the way a no-op stub would let it.
class StubRedirectSignal extends Error {}

export function redirect(url: string): never {
  redirectCalls.push(url);
  throw new StubRedirectSignal(`NEXT_REDIRECT:${url}`);
}

export function __getRedirectCalls(): string[] {
  return redirectCalls;
}

export function __isRedirectSignal(error: unknown): boolean {
  return error instanceof StubRedirectSignal;
}

function notify() {
  for (const l of listeners) l();
}

export function __setSearchParams(qs: string) {
  current = new URLSearchParams(qs);
  notify();
}

export function __getReplaceCalls(): string[] {
  return replaceCalls;
}

export function __resetNavigationStub() {
  current = new URLSearchParams();
  replaceCalls = [];
  redirectCalls = [];
}

export function useSearchParams() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
}

export function usePathname() {
  return pathname;
}

export function useRouter() {
  return {
    replace: (url: string) => {
      replaceCalls.push(url);
      const [, qs] = url.split("?");
      current = new URLSearchParams(qs ?? "");
      notify();
    },
  };
}
