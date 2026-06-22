// Colocated setup page for the
// `/connectors/cinatra-ai/google-calendar-connector/setup` dispatch route.
//
// This single setup surface provides one card for the Nango connection,
// one card for the appointment-schedules form, and one card for the saved
// schedules list. The `/connectors` cards link to this setup route.

import type { ExtensionHostContext } from "@cinatra-ai/sdk-extensions";
import { Main, PageHeader, PageContent } from "@cinatra-ai/sdk-ui/marketplace";
import { NangoUserConnectButton } from "@cinatra-ai/sdk-ui/nango";
import { Button } from "./components/ui/button";
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

  return (
    <Main className="min-h-screen">
      <PageHeader
        title="Google Calendar"
        description="Connect your Google Calendar account and configure the appointment schedule links you want Cinatra to keep on file."
        className="max-w-3xl"
      />
      <PageContent className="max-w-3xl flex flex-col gap-6 pb-8">
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
            <a href="/connectors/cinatra-ai/google-oauth-connector/setup">
              Google OAuth configuration
            </a>{" "}
            first — create them in the{" "}
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Cloud Console
            </a>
            .
          </FieldDescription>
        )}

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
      </PageContent>
    </Main>
  );
}
