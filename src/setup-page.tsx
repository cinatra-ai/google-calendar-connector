// Colocated setup page for the
// `/connectors/cinatra-ai/google-calendar-connector/setup` dispatch route.
//
// This single setup surface provides one card for the Nango connection,
// one card for the appointment-schedules form, and one card for the saved
// schedules list. The `/connectors` cards link to this setup route.
//
// Transient save/error feedback sinks to the canonical sdk-ui toast island
// (cinatra-ai/cinatra#1107 / #1186) via the codes-only flash protocol —
// see ./setup-flash and ./setup-actions. The former in-page Alert blocks are
// retired outright; no banner remains for a refresh/back-nav to replay.

import { Suspense } from "react";
import type { ExtensionHostContext } from "@cinatra-ai/sdk-extensions";
import { Main, PageHeader, PageContent } from "@cinatra-ai/sdk-ui/marketplace";
import { NangoUserConnectButton } from "@cinatra-ai/sdk-ui/nango";
import { SearchParamToast } from "@cinatra-ai/sdk-ui/search-param-toast";
import { Button } from "./components/ui/button";
import { Link } from "./components/ui/link";
import { LinkIcon } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "./components/ui/input-group";
import { Field, FieldDescription, FieldLabel } from "./components/ui/field";
import { getStoredGoogleCalendarAppointments } from "./index";
import { getGoogleCalendarDeps } from "./deps";
import { addGoogleCalendarAppointmentScheduleAction } from "./setup-actions";
import { GOOGLE_CALENDAR_SETUP_FLASH_TOASTS } from "./setup-flash";

// Nango frontend config + the user's primary saved connection are read from the
// injected host port `ctx.nango.*` (host-port inversion), so the connector
// carries no `@cinatra-ai/nango-connector` import.
type ConnectorSetupPageProps = {
  packageId: string;
  slug: string;
  searchParams: Record<string, string | string[] | undefined>;
  ctx: ExtensionHostContext;
};

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleString();
}

// searchParams is no longer read here: the codes-only flash protocol reads
// (and strips) its own `notice`/`error` params client-side via the
// <SearchParamToast> island below, so this server component has nothing left
// to pick out of it.
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

  return (
    <Main className="min-h-screen">
      {/* Codes-only flash island (replaces the retired in-page Alert blocks).
          The add-schedule action redirects here with ?notice=<code> /
          ?error=<code>; the static code->message map lives in ./setup-flash.
          A ?error=<text> that isn't a known code maps to nothing and is never
          toasted. */}
      <Suspense fallback={null}>
        <SearchParamToast toasts={GOOGLE_CALENDAR_SETUP_FLASH_TOASTS} />
      </Suspense>
      <PageHeader
        title="Google Calendar"
        description="Connect your Google Calendar account and configure the appointment schedule links you want Cinatra to keep on file."
        className="max-w-3xl"
      />
      <PageContent className="max-w-3xl flex flex-col gap-6 pb-8">
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
      </PageContent>
    </Main>
  );
}
