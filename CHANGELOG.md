# Changelog

All notable changes to this project are documented here, derived from the
project's merged pull request and release-tag history.

## v0.1.2 — 2026-06-25

- ci: add truthful-attribution-gate in WARN mode (#16)
- ci: adopt the reusable extension->host IoC conformance gate (org-wide rollout) (#17)
- ci: tag-driven GitHub release on v* (#18)
- ci: adopt secret-scan-gate (#19)
- Add OAuth credential guidance to Calendar setup page (#21)
- Gate connect button on Google OAuth config state (#23)
- Clarify appointment schedules are independent of the connection (#24)

## v0.1.1 — 2026-06-13

- ci(release): grant contents: write + pin reusable workflow to .github HEAD (#13)
- ci: repin reusable release workflow (immutable-safe decoration + corrected build-input provisioning) (#14)
- release: google-calendar-connector v0.1.1 (republish on corrected serverEntry build pipeline) (#15)

## v0.1.0 — 2026-06-03

- Initial release.

## Unreleased

- ci: adopt source-leak-gate (#1)
- ci: adopt source-leak-gate (#2)
- chore: add .gitignore (#3)
- ci: adopt org gates — SHA-pin all uses: refs, bump source-leak-gate to v0.1.0, add actions-pinned + gitignore gate callers (#4)
- chore: keep internal planning notes untracked (#5)
- Self-bind host deps at serverEntry activation; globalize the deps slot (#6)
- Contribute appointment schedules to the chat via the chat-user-context capability (#7)
- chore: npm files allowlist + git-archive export-ignore (packaging hygiene) (#8)
- ci: adopt the org ui-design-system gate (#9)
- feat: register the appointment-schedules capability surface (#10)
- chore: Configure Renovate (#11)
- docs(readme): expand README to the org standard (#25) (#26)
- ci(ui-gate): ramp raw-JSX block to error (#27)
- ci: adopt source-leak-gate (#28)
- ci: adopt source-leak-gate (#29)
- docs(readme): conform to extension-kind-gate strict format (#30)
- ci(ui-gate): re-vendor preset with Block-C (dynamic-import ban) + bump pin to v0.1.1 (#31)
- chore: strip private engineering-tracker refs from public source (#32)
- chore: strip private tracker references from workflow comments (#35)
- ci(release): pin reusable-extension-release to gated v0.1.1 (release-approval wall) (#36)
- fix: appointments-list reads the invoking user's per-user store (#38)
- chore: add cinatra.vendor connector provenance metadata (#39)
- chore(deps): declare cinatra.consumes for closure-gate enrollment (#40)

