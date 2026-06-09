# Technology Stack

**Analysis Date:** 2026-06-09

## Languages

**Primary:**
- TypeScript — all source files under `src/` (`.ts` and `.tsx`)

**Secondary:**
- TSX/JSX — React UI components in `src/setup-page.tsx` and `src/components/ui/`

## Runtime

**Environment:**
- Node.js 24 (specified in `.github/workflows/ci.yml` via `actions/setup-node@v4`, `node-version: "24"`)

**Package Manager:**
- pnpm (via corepack — CI runs `corepack enable`)
- `.npmrc` sets `auto-install-peers=false`
- No committed lockfile (source-mirror repo pattern; monorepo host resolves deps)

## Frameworks

**Core:**
- React 19 (`react ^19.2.3`) — peer dependency, UI rendering for `setup-page.tsx`
- Next.js — implied by `"use server"` directive in `src/setup-actions.ts` and use of `next/navigation` (`redirect`)

**Build/Dev:**
- TypeScript compiler (`tsc`) — `tsconfig.json` targets ES2023, `ESNext` modules, `bundler` module resolution
- Output: `dist/` directory (declarations + sourcemaps)

**Cinatra SDK (peer, provided by host monorepo):**
- `@cinatra-ai/sdk-extensions` — `ExtensionHostContext`, `requireExtensionAction`, MCP tool server types
- `@cinatra-ai/sdk-ui` — UI primitives (`Main`, `PageHeader`, `PageContent`, `NangoUserConnectButton`)

## Key Dependencies

**UI Utilities:**
- `class-variance-authority ^0.7.1` — variant-based className composition (`src/components/ui/`)
- `clsx ^2.1.1` — className merging utility
- `tailwind-merge ^3.5.0` — Tailwind class deduplication (`src/lib/utils.ts`)
- `radix-ui ^1.4.3` — headless accessible UI primitives

**Schema/Validation:**
- `zod` — used in `src/mcp/registry.ts` for MCP tool input schemas (declared as a transitive dep; not in `package.json` directly, resolved via host workspace)

**Peer (host-provided):**
- `react ^19.2.3`
- `react-dom ^19.2.3`
- `@cinatra-ai/sdk-extensions` (optional peer)
- `@cinatra-ai/sdk-ui` (optional peer)

## Configuration

**TypeScript (`tsconfig.json`):**
- `target`: ES2023
- `module`: ESNext, `moduleResolution`: bundler
- `jsx`: react-jsx
- `strict: true`, `noImplicitAny: false`, `isolatedModules: true`, `verbatimModuleSyntax: true`
- `outDir`: `dist/`, `rootDir`: `src/`
- Declarations and sourcemaps enabled

**Package exports (`package.json`):**
- `.` → `src/index.ts`
- `./register` → `src/register.ts`
- `./setup-page` → `src/setup-page.tsx`
- `./setup-actions` → `src/setup-actions.ts`
- `./mcp-module` → `src/mcp/module.ts`
- `./mcp-handlers` → `src/mcp/handlers.ts`

**Cinatra connector manifest (inside `package.json` `cinatra` key):**
- `apiVersion`: `cinatra.ai/v1`
- `kind`: `connector`
- `displayName`: Google Calendar
- `serverEntry`: `./register`
- `requestedHostPorts`: `mcp`, `settings`, `authSession`, `nango`
- `sdkAbiRange`: `^2`
- `devFixtures`: `cinatra/dev-fixtures.json`

**NPM registry:**
- `.npmrc` — `auto-install-peers=false`; no registry token (note: file present, secrets not read)

## Platform Requirements

**Development:**
- Node.js 24+, pnpm via corepack
- Must be consumed from within the cinatra host monorepo workspace (not standalone-installable due to host-internal `@cinatra-ai/*` peer deps)

**Production:**
- Deployed as a Cinatra connector extension inside the cinatra host application
- No standalone build artifact — host monorepo builds and bundles the connector

---

*Stack analysis: 2026-06-09*
