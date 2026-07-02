import type { ExtensionPrimitiveRequest } from "@cinatra-ai/sdk-extensions";
import { getStoredGoogleCalendarAppointments } from "../index";

const PACKAGE_NAME = "@cinatra-ai/google-calendar-connector";

/**
 * Resolves the TRUSTED human subject `{ userId }` for the current invocation.
 * The host injects this on the manifest-discovered MCP-module path (it reads
 * the request/run context store — the MCP transport carries no actor). Mirrors
 * email-connector / social-media-connector's `resolveActor`; the host passes
 * the SAME resolver uniformly to every connector module factory.
 */
export type GoogleCalendarActorResolver = () => Promise<{ userId?: string; orgId?: string }>;

function nonEmpty(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

// Appointment schedules are stored PER USER (`google_calendar_user:<id>`), so the
// agent-facing tool must read the INVOKING user's store — not the legacy instance
// key. The trusted actor arrives by one of two host wiring paths:
//   - MCP-module path: the host-injected `resolveActor()` (the synthesized
//     primitive request carries no userId there);
//   - in-process primitive path (agents passthrough): the host builds a trusted
//     `request.actor` (PrimitiveActorContext with `userId`) from the run row.
// `actor` is a TRUSTED host value (NOT agent-supplied `input`), so there is no
// spoofing surface. Today only one path supplies a userId per call, but if BOTH
// ever do and they DISAGREE, refuse to guess (fail closed) rather than risk
// reading another user's schedules.
async function resolveInvokingUserId(
  request: ExtensionPrimitiveRequest<unknown>,
  resolveActor?: GoogleCalendarActorResolver,
): Promise<{ userId?: string; deny: boolean }> {
  const injected = nonEmpty((await resolveActor?.())?.userId);
  const onRequest = nonEmpty(
    (request.actor as { userId?: string } | null | undefined)?.userId,
  );
  if (injected && onRequest && injected !== onRequest) {
    console.warn(
      `${PACKAGE_NAME}: conflicting invoking-user ids from the actor resolver and the ` +
        `request actor — refusing to guess; returning no schedules.`,
    );
    return { deny: true };
  }
  // `undefined` (no actor at all) falls back to the legacy instance key inside
  // getStoredGoogleCalendarAppointments — non-regressive for actor-less callers.
  return { userId: injected ?? onRequest, deny: false };
}

export function createGoogleCalendarPrimitiveHandlers(resolveActor?: GoogleCalendarActorResolver) {
  return {
    "google_calendar_appointments_list": async (request: ExtensionPrimitiveRequest<unknown>) => {
      const { userId, deny } = await resolveInvokingUserId(request, resolveActor);
      if (deny) {
        return { items: [] as { title: string; bookingPageUrl: string }[], total: 0, syncedAt: null };
      }
      const { appointments, syncedAt } = getStoredGoogleCalendarAppointments(userId);
      return {
        items: appointments.map((a) => ({
          title: a.title,
          bookingPageUrl: a.bookingPageUrl,
        })),
        total: appointments.length,
        syncedAt: syncedAt ?? null,
      };
    },
  } as const;
}
