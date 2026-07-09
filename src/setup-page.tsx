// Colocated setup page for the
// `/connectors/cinatra-ai/google-calendar-connector/setup` dispatch route.
//
// Per the extended connector setup-page spec (design/specs/app-connectors.html
// §II, single-connection layout with additional configuration tabs), the
// surface is organized into three tabs: the primary "Connection" tab (the
// Nango account connect + shared-OAuth prerequisite), a dedicated
// "Appointment schedules" tab (the add-schedule form + saved-schedule list),
// and a read-only "Help" tab last. One Google Calendar account per user;
// schedules are stored sub-records under it (single-connection).

import type { ExtensionHostContext } from "@cinatra-ai/sdk-extensions";
import { Main, PageHeader, PageContent } from "@cinatra-ai/sdk-ui/marketplace";
import { NangoUserConnectButton } from "@cinatra-ai/sdk-ui/nango";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@cinatra-ai/sdk-ui/tabs";
import { Button } from "./components/ui/button";
import { Link } from "./components/ui/link";
import { Separator } from "./components/ui/separator";
import { LinkIcon } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "./components/ui/input-group";
import { Alert, AlertDescription } from "./components/ui/alert";
import { Field, FieldDescription, FieldLabel } from "./components/ui/field";
import { getStoredGoogleCalendarAppointments } from "./index";
import { getGoogleCalendarDeps } from "./deps";
import { addGoogleCalendarAppointmentScheduleAction } from "./setup-actions";

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

  const saved = pick(searchParams.saved) === "1";
  const error = pick(searchParams.error);
  // The add-schedule action redirects back here with no `tab` param, so
  // default to the Appointment schedules tab whenever there is feedback to
  // show for it; otherwise Connection (the primary tab) is the entry point.
  const defaultTab = saved || error ? "appointments" : "connection";

  return (
    <Main className="min-h-screen">
      <PageHeader
        title="Google Calendar"
        description="Connect your Google Calendar account and configure the appointment schedule links you want Cinatra to keep on file."
        className="max-w-3xl"
        divider={false}
      />
      <PageContent className="max-w-3xl pb-8">
        <Tabs defaultValue={defaultTab} className="gap-6">
          {/* The etched paired-line rule stretches from the last tab to the
              page edge (design-system Tabs; PageHeader's own divider is off
              above so the two rules never stack). */}
          <div className="grid grid-cols-[auto_1fr] items-end gap-7">
            <TabsList className="border-b-0">
              <TabsTrigger value="connection">Connection</TabsTrigger>
              <TabsTrigger value="appointments">Appointment schedules</TabsTrigger>
              <TabsTrigger value="help">Help</TabsTrigger>
            </TabsList>
            <Separator major decorative className="mb-[11px] self-end" />
          </div>

          <TabsContent value="connection" className="flex flex-col gap-6">
            <section className="soft-panel rounded-panel p-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">Google Calendar account</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {connection
                    ? `Connected${connection.email ? ` as ${connection.email}` : ""}`
                    : "Not connected"}
                </p>
              </div>
              <NangoUserConnectButton
                connectorKey="googleCalendar"
                reconnectConnectionId={connection?.connectionId}
                connected={Boolean(connection)}
                connectLabel="Connect Google Calendar"
                reconnectLabel="Reconnect"
                nangoFrontendConfig={nangoFrontendConfig}
                disabled={!oauthConfigured}
                prerequisiteErrorMessage={
                  oauthConfigured
                    ? undefined
                    : "Save your Google OAuth client ID and secret in Google OAuth configuration first."
                }
              />
            </section>

            {oauthConfigured ? null : (
              <FieldDescription className="leading-6">
                Connecting requires shared Google OAuth credentials. Save your client
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
              </FieldDescription>
            )}
          </TabsContent>

          <TabsContent value="appointments" className="max-w-xl flex flex-col gap-6">
            {saved ? (
              <Alert variant="success" className="rounded-control">
                <AlertDescription>Appointment schedule saved.</AlertDescription>
              </Alert>
            ) : null}
            {error ? (
              <Alert variant="destructive" className="rounded-control">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <section className="soft-panel rounded-panel p-5">
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

          <TabsContent value="help" className="max-w-xl flex flex-col gap-5">
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
                Use the Connection tab to sign in with Google. This confirms
                which Google account the schedules below belong to.
              </p>
            </div>
            <div>
              <h3 className="mb-1 text-sm font-semibold text-foreground">Add a booking link</h3>
              <p className="text-sm leading-6 text-muted-foreground">
                In Google Calendar, choose Create → Appointment schedule, then
                copy its public link (calendar.app.google/…) into the
                Appointment schedules tab.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </PageContent>
    </Main>
  );
}
