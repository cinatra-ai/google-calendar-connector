// Colocated setup page for the
// `/connectors/cinatra-ai/google-calendar-connector/setup` dispatch route.
//
// Per the extended connector setup-page spec (design/specs/app-connectors.html
// §II), this single-connection connector composes the shared connector-setup
// shell + primitives (it does NOT hand-roll the chrome):
//
//   • ConnectorSetupPage  — header + content in ONE centered Wide column
//     (max-w-3xl · 768px), so the header's left edge aligns with the content
//     frame; renders no divider (the tab row owns the section rule).
//   • Tabs + TabsListRow  — the design-system underline tablist; TabsListRow
//     draws the etched paired-line section rule to the RIGHT of the last tab
//     out to the column edge and drops its own bottom hairline.
//   • ConnectorSetupColumns — the two-column Setup body (wider left = the
//     account connect + actions; narrower 236px right = the Connection status
//     card).
//   • ConnectionStatusCard (via ./setup-client ConnectionStatusPanel) — the
//     status badge + full-width Check re-probe.
//   • SearchParamToast — the codes-only flash island (issue #44), replacing the
//     two in-page transient banners.
//
// Tab order: Setup first, then the reserved Help tab LAST. One Google
// Calendar account per user (single connection). The connector's own
// "Appointment schedules" custom tab + its form moved to
// @cinatra-ai/google-appointment-schedules-connector (cinatra-ai/cinatra#2367
// S1/S2), so this page now composes only the connection-management surface.

import type { ExtensionHostContext } from "@cinatra-ai/sdk-extensions";
import { ConnectorSetupPage } from "@cinatra-ai/sdk-ui/connector-setup-page";
import { ConnectorSetupColumns } from "@cinatra-ai/sdk-ui/connector-setup-columns";
import { Tabs, TabsContent, TabsListRow, TabsTrigger } from "@cinatra-ai/sdk-ui/tabs";
import { SearchParamToast } from "@cinatra-ai/sdk-ui/search-param-toast";
import { NangoUserConnectButton } from "@cinatra-ai/sdk-ui/nango";
import { Link } from "./components/ui/link";
import { GCAL_FLASH_TOASTS } from "./gcal-flash";
import { ConnectionStatusPanel, DisconnectAction } from "./setup-client";
import {
  checkGoogleCalendarStatusAction,
  disconnectGoogleCalendarConnectionAction,
} from "./setup-actions";
import { getGoogleCalendarDeps } from "./deps";

// Nango frontend config + the user's primary saved connection are read from the
// injected host port `ctx.nango.*` (host-port inversion), so the connector
// carries no `@cinatra-ai/nango-connector` import.
type ConnectorSetupPageProps = {
  packageId: string;
  slug: string;
  searchParams: Record<string, string | string[] | undefined>;
  ctx: ExtensionHostContext;
};

export default async function GoogleCalendarConnectorSetupPage({
  ctx,
}: ConnectorSetupPageProps) {
  const actor = await ctx.authSession.getActor();
  if (!actor?.userId) {
    // Dispatch route already gated via enforceConnectorPolicy; defensive null
    // check so a misconfigured port never silently mis-scopes user data.
    throw new Error("[google-calendar-connector] no userId on actor");
  }
  const nangoFrontendConfig = (await ctx.nango.getFrontendConfig?.()) ?? {};
  const connection =
    (await ctx.nango.getPrimarySavedConnections?.({ scope: "user", userId: actor.userId }))?.googleCalendar ?? null;
  const connected = Boolean(connection);

  // Connecting Calendar requires the shared Google OAuth client (clientId +
  // secret, configured in the google-oauth connector) to exist first. Read the
  // connector-level status to gate the connect button. Fail OPEN if the host
  // google-oauth service is unavailable, so a status-read hiccup never blocks
  // an otherwise-working setup (the connect flow still guards server-side).
  let oauthConfigured = true;
  try {
    const oauthStatus = await getGoogleCalendarDeps().oauth.getStatus();
    oauthConfigured = oauthStatus.status === "connected";
  } catch {
    oauthConfigured = true;
  }

  return (
    // Standard connector-setup PAGE chrome — header + content in the SAME Wide
    // column. The status badge that once sat top-right of the header now lives
    // in the Connection status card, so the header carries no actions.
    // `divider={false}` — the section rule is the tab row's etched rule.
    <ConnectorSetupPage
      title="Google Calendar"
      description="Connector setup"
      divider={false}
      className="flex flex-col gap-6 pb-8"
    >
      {/* Banner → toast migration (issue #44): the two legacy in-page banner
          sites are gone; outcome codes toast via the static message map. */}
      <SearchParamToast toasts={GCAL_FLASH_TOASTS} />

      <Tabs defaultValue="setup" className="w-full">
        <TabsListRow aria-label="Google Calendar connector setup">
          <TabsTrigger value="setup">Setup</TabsTrigger>
          {/* Help is RESERVED and ALWAYS LAST (checklist items 16–17). */}
          <TabsTrigger value="help">Help</TabsTrigger>
        </TabsListRow>

        {/* SETUP — the single-connection two-column body. Stays Wide. */}
        <TabsContent
          value="setup"
          forceMount
          className="mt-6 data-[state=inactive]:hidden"
        >
          <ConnectorSetupColumns
            conformanceId="connector-setup"
            state="ready"
            fields={
              <div className="flex flex-col gap-6">
                <section className="soft-panel rounded-panel p-5">
                  {connection ? (
                    <>
                      <p className="text-sm font-medium text-foreground">
                        Google Calendar account
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {`Connected${connection.email ? ` as ${connection.email}` : ""}`}
                      </p>
                    </>
                  ) : (
                    // Not-connected card (owner review pull/45): the card holds
                    // only the OAuth-credentials prerequisite line, with "Google
                    // OAuth credentials" linking to that connector's setup page.
                    <p className="text-sm leading-6 text-muted-foreground">
                      Connecting requires shared{" "}
                      <Link href="/connectors/cinatra-ai/google-oauth-connector/setup">
                        Google OAuth credentials
                      </Link>
                      .
                    </p>
                  )}
                </section>

                {/* Actions — side by side, never stacked (spec §II item 7):
                    Connect (indigo primary, the Nango OAuth trigger) always
                    available, and Disconnect (destructive, unplug) disabled
                    until connected. Connecting requires the shared Google OAuth
                    client to be configured first. */}
                <div className="flex flex-wrap items-center gap-3">
                  <NangoUserConnectButton
                    connectorKey="googleCalendar"
                    reconnectConnectionId={connection?.connectionId}
                    connected={connected}
                    connectLabel="Connect"
                    reconnectLabel="Reconnect"
                    nangoFrontendConfig={nangoFrontendConfig}
                    disabled={!oauthConfigured}
                    prerequisiteErrorMessage={
                      oauthConfigured
                        ? undefined
                        : "Save your Google OAuth client ID and secret in Google OAuth configuration first."
                    }
                  />
                  <DisconnectAction
                    connected={connected}
                    disconnectAction={disconnectGoogleCalendarConnectionAction}
                  />
                </div>
              </div>
            }
            aside={
              /* Connection status card (spec §II items 10–14): heading over a
                 divider, a status badge with icon + label, and a full-width
                 Check action beneath it. Pressing Check swaps in the transient
                 "Checking…" badge until the re-probe resolves. */
              <ConnectionStatusPanel
                initialConnected={connected}
                checkAction={checkGoogleCalendarStatusAction}
              />
            }
          />
        </TabsContent>

        {/* HELP — reserved, always LAST, read-only (no form, no Save). Narrow. */}
        <TabsContent
          value="help"
          forceMount
          className="mt-6 flex max-w-xl flex-col gap-5 data-[state=inactive]:hidden"
        >
          <p className="text-sm leading-6 text-muted-foreground">
            Cinatra uses your connected Google Calendar account to identify
            which calendar other Cinatra features act on. It does not read
            your calendar events.
          </p>
          <div>
            <h3 className="mb-1 text-sm font-semibold text-foreground">Prerequisite</h3>
            <p className="text-sm leading-6 text-muted-foreground">
              Connecting requires a shared Google OAuth client. Save its client
              ID and secret in{" "}
              <Link href="/connectors/cinatra-ai/google-oauth-connector/setup">
                Google OAuth configuration
              </Link>{" "}
              first — create them in the{" "}
              <Link
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google Cloud Console
              </Link>
              .
            </p>
          </div>
          <div>
            <h3 className="mb-1 text-sm font-semibold text-foreground">Connect your account</h3>
            <p className="text-sm leading-6 text-muted-foreground">
              On the Setup tab, sign in with Google. This confirms which Google
              account is connected. Use Disconnect to remove the connection;
              the connector stops working until you connect again.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </ConnectorSetupPage>
  );
}
