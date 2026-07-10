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
// Tab order (checklist items 16–17): Setup first, then the connector's own
// "Appointment schedules" custom tab, then the reserved Help tab LAST. One
// Google Calendar account per user; schedules are stored sub-records under it
// (single connection).

import type { ExtensionHostContext } from "@cinatra-ai/sdk-extensions";
import { ConnectorSetupPage } from "@cinatra-ai/sdk-ui/connector-setup-page";
import { ConnectorSetupColumns } from "@cinatra-ai/sdk-ui/connector-setup-columns";
import { Tabs, TabsContent, TabsListRow, TabsTrigger } from "@cinatra-ai/sdk-ui/tabs";
import { SearchParamToast } from "@cinatra-ai/sdk-ui/search-param-toast";
import { NangoUserConnectButton } from "@cinatra-ai/sdk-ui/nango";
import { LinkIcon } from "lucide-react";
import { Button } from "./components/ui/button";
import { Link } from "./components/ui/link";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "./components/ui/input-group";
import { Field, FieldDescription, FieldLabel } from "./components/ui/field";
import { GCAL_FLASH_TOASTS } from "./gcal-flash";
import { ConnectionStatusPanel, DisconnectAction } from "./setup-client";
import {
  addGoogleCalendarAppointmentScheduleAction,
  checkGoogleCalendarStatusAction,
  disconnectGoogleCalendarConnectionAction,
} from "./setup-actions";
import { getStoredGoogleCalendarAppointments } from "./index";
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

function pick(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleString();
}

export default async function GoogleCalendarConnectorSetupPage({
  searchParams,
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

  const { appointments, syncedAt } = getStoredGoogleCalendarAppointments(
    actor.userId,
  );

  // The add-schedule action redirects back here with no `tab` param, so default
  // to the Appointment schedules tab whenever there is feedback to show for it;
  // otherwise Setup (the primary tab) is the entry point.
  const notice = pick(searchParams.notice);
  const error = pick(searchParams.error);
  const defaultTab =
    notice === "schedule-saved" || error === "schedule-add-failed"
      ? "appointments"
      : "setup";

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

      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsListRow aria-label="Google Calendar connector setup">
          <TabsTrigger value="setup">Setup</TabsTrigger>
          <TabsTrigger value="appointments">Appointment schedules</TabsTrigger>
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

        {/* APPOINTMENT SCHEDULES — the connector's own custom tab. A custom
            tab's content NARROWS to max-w-xl · 576px, flush-left (item 19). */}
        <TabsContent
          value="appointments"
          forceMount
          className="mt-6 flex max-w-xl flex-col gap-6 data-[state=inactive]:hidden"
        >
          {/* No wrapping card (owner review pull/45): a custom config tab's
              content sits card-less, flush-left under the tabs, per the
              app-connectors.html additional-config-tab treatment. */}
          <section>
            <h2 className="mb-3 text-sm font-semibold text-foreground">
              Add an appointment schedule
            </h2>
            <form
              action={addGoogleCalendarAppointmentScheduleAction}
              className="grid gap-4"
            >
              <Field>
                <FieldLabel>Booking page URL</FieldLabel>
                <InputGroup>
                  <InputGroupAddon>
                    <LinkIcon aria-hidden="true" />
                  </InputGroupAddon>
                  <InputGroupInput
                    type="url"
                    name="bookingPageUrl"
                    required
                    placeholder="https://calendar.app.google/..."
                  />
                </InputGroup>
                <FieldDescription>
                  A public Google Calendar appointment-schedule link
                  (calendar.app.google/…) the assistant shares so people can book
                  time with you — a share link, not a calendar sync. Get one in
                  Google Calendar:{" "}
                  <Link
                    href="https://support.google.com/calendar/answer/10729749"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Create → Appointment schedule
                  </Link>
                  , then paste its public link here.
                </FieldDescription>
              </Field>
              <div>
                <Button type="submit">Add schedule</Button>
              </div>
            </form>
          </section>

          {appointments.length > 0 ? (
            <section className="soft-panel rounded-panel p-5 flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-foreground">
                Saved schedules
              </h2>
              {appointments.map((schedule) => (
                <div
                  key={schedule.id}
                  className="rounded-control border border-line bg-surface px-4 py-3"
                >
                  <p className="text-sm font-semibold text-foreground">{schedule.title}</p>
                  <p className="mt-1 break-all text-sm text-muted-foreground">
                    {schedule.bookingPageUrl}
                  </p>
                  {schedule.description ? (
                    <p className="mt-2 text-sm text-muted-foreground">{schedule.description}</p>
                  ) : null}
                </div>
              ))}
              {syncedAt ? (
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Last updated {formatTimestamp(syncedAt)}
                </p>
              ) : null}
            </section>
          ) : (
            <section className="soft-panel rounded-panel p-5">
              <p className="text-sm text-muted-foreground">
                No appointment schedules saved yet.
              </p>
            </section>
          )}
        </TabsContent>

        {/* HELP — reserved, always LAST, read-only (no form, no Save). Narrow. */}
        <TabsContent
          value="help"
          forceMount
          className="mt-6 flex max-w-xl flex-col gap-5 data-[state=inactive]:hidden"
        >
          <p className="text-sm leading-6 text-muted-foreground">
            Cinatra keeps a list of your Google Calendar appointment-schedule
            share links on file so agents can hand the right booking link to
            someone who wants time on your calendar, without you managing the
            link by hand. It does not read your calendar events.
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
              account the schedules belong to. Use Disconnect to remove the
              connection; the connector stops working until you connect again.
            </p>
          </div>
          <div>
            <h3 className="mb-1 text-sm font-semibold text-foreground">Add a booking link</h3>
            <p className="text-sm leading-6 text-muted-foreground">
              In Google Calendar, choose Create → Appointment schedule, then copy
              its public link (calendar.app.google/…) into the Appointment
              schedules tab.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </ConnectorSetupPage>
  );
}
