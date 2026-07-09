import { defineConfig } from "vitest/config";
import * as path from "node:path";

const repoRoot = path.join(__dirname, "../../..");
const serverOnlyStub = path.join(repoRoot, "tests/__stubs__/server-only.ts");

// Test-only aliases for the host-internal @cinatra-ai/* packages this repo
// declares as OPTIONAL peerDependencies (see package.json +
// .github/workflows/ci.yml — CI skips standalone install/typecheck/test for
// that reason; the cinatra monorepo runs these tests for real when it
// workspace-links this repo). For this repo's own standalone `vitest run` to
// exercise the toast-migration wiring (setup-page.tsx ->
// SearchParamToast / flashHref), the two unresolvable specifiers are aliased
// to byte-faithful vendored stubs under src/__tests__/__stubs__/ — see that
// directory's file comments for provenance + re-vendor instructions.
const stubs = path.join(__dirname, "src/__tests__/__stubs__");

export default defineConfig({
  resolve: {
    alias: [
      { find: "server-only", replacement: serverOnlyStub },
      {
        find: "@/lib/database",
        replacement: path.join(repoRoot, "tests/__stubs__/database.ts"),
      },
      { find: /^@\/(.+)$/, replacement: path.join(repoRoot, "src") + "/$1" },
      { find: "@cinatra-ai/sdk-extensions/flash-href", replacement: path.join(stubs, "flash-href.ts") },
      { find: "@cinatra-ai/sdk-extensions", replacement: path.join(stubs, "sdk-extensions.ts") },
      { find: "@cinatra-ai/sdk-ui/search-param-toast", replacement: path.join(stubs, "search-param-toast.tsx") },
      // next/navigation + sonner: real deps this standalone repo doesn't
      // install (Next host runtime + sdk-ui's peerDependency) — see the
      // stub files' own comments.
      { find: "next/navigation", replacement: path.join(stubs, "next-navigation.ts") },
      { find: "sonner", replacement: path.join(stubs, "sonner.ts") },
    ],
  },
  test: {
    // jsdom (not "node"): search-param-toast.test.tsx renders the toast
    // island into a real DOM. jsdom is a superset for the plain-node unit
    // tests in this suite (no Node-only global is exercised by them).
    environment: "jsdom",
    include: ["src/__tests__/**/*.test.ts", "src/__tests__/**/*.test.tsx"],
    exclude: ["**/node_modules/**"],
  },
});
