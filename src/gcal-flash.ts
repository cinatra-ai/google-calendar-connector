// -----------------------------------------------------------------------------
// Google Calendar setup — codes-only flash protocol (toast-notifications epic;
// this repo issue #44). The "use server" actions in ./setup-actions redirect
// back to the connector setup route carrying an outcome CODE
// (`?notice=<code>` / `?error=<code>`); the <SearchParamToast> island mounted in
// ./setup-page maps each code to a STATIC, server-trusted message here — it
// NEVER toasts URL-derived text (a crafted `?error=<spoofed>` maps to no entry
// and is ignored). This module is the single source of truth so the action
// emitters and the mount-site message map cannot drift.
//
// Replaces the two in-page transient banner sites the setup page previously
// rendered from `?saved=1` (success Alert) and `?error=<message>` (destructive
// Alert echoing the raw error text).
// -----------------------------------------------------------------------------

import type { SearchParamToastConfig } from "@cinatra-ai/sdk-ui/search-param-toast";

export const GCAL_NOTICE_MESSAGES = {
  disconnected:
    "Google Calendar disconnected. The connector will stop working until you connect it again.",
} as const;

export const GCAL_ERROR_MESSAGES = {
  "disconnect-failed": "Could not disconnect Google Calendar. Try again.",
} as const;

export type GcalNoticeCode = keyof typeof GCAL_NOTICE_MESSAGES;
export type GcalErrorCode = keyof typeof GCAL_ERROR_MESSAGES;

// One <SearchParamToast> config entry per code, mounted in ./setup-page. The
// island fires the STATIC message for the matched code, then strips the param
// so a refresh / back-nav does not replay it.
export const GCAL_FLASH_TOASTS: SearchParamToastConfig[] = [
  ...(Object.entries(GCAL_NOTICE_MESSAGES) as [GcalNoticeCode, string][]).map(
    ([code, message]) => ({
      param: "notice" as const,
      value: code,
      message,
      variant: "success" as const,
    }),
  ),
  ...(Object.entries(GCAL_ERROR_MESSAGES) as [GcalErrorCode, string][]).map(
    ([code, message]) => ({
      param: "error" as const,
      value: code,
      message,
      variant: "error" as const,
    }),
  ),
];
