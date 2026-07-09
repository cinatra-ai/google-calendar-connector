// DOM render test (jsdom) for the toast island wired into src/setup-page.tsx.
// Drives the REAL <SearchParamToast> composition (a byte-faithful vendored
// stub of @cinatra-ai/sdk-ui/search-param-toast — see __stubs__/ for
// provenance) against this connector's own GOOGLE_CALENDAR_SETUP_FLASH_TOASTS
// config, mirroring exactly how src/setup-page.tsx mounts it. Proves: a known
// notice/error code fires the correct static toast variant+message exactly
// once, the consumed param is stripped from the URL after firing, and an
// unrecognized code is never toasted (the anti-spoofing guarantee).
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SearchParamToast } from "./__stubs__/search-param-toast";
import { toast as sonnerToast, __resetSonnerStub } from "./__stubs__/sonner";
import {
  __getReplaceCalls,
  __resetNavigationStub,
  __setSearchParams,
} from "./__stubs__/next-navigation";
import { GOOGLE_CALENDAR_SETUP_FLASH_TOASTS } from "../setup-flash";

describe("GoogleCalendarConnectorSetupPage toast island (DOM)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    __resetNavigationStub();
    __resetSonnerStub();
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  function mount() {
    act(() => {
      root = createRoot(container);
      root.render(<SearchParamToast toasts={GOOGLE_CALENDAR_SETUP_FLASH_TOASTS} />);
    });
  }

  it("toasts the static success message for ?notice=schedule-saved and strips the param", () => {
    __setSearchParams("notice=schedule-saved");
    mount();

    expect(sonnerToast.success).toHaveBeenCalledTimes(1);
    expect(sonnerToast.success).toHaveBeenCalledWith(
      "Appointment schedule saved.",
      expect.objectContaining({ id: "search-param-toast:notice:schedule-saved" }),
    );
    expect(sonnerToast.error).not.toHaveBeenCalled();
    expect(__getReplaceCalls()).toEqual([
      "/connectors/cinatra-ai/google-calendar-connector/setup",
    ]);
  });

  it("toasts the static error message for a known ?error=<code>", () => {
    __setSearchParams("error=invalid-host");
    mount();

    expect(sonnerToast.error).toHaveBeenCalledTimes(1);
    expect(sonnerToast.error).toHaveBeenCalledWith(
      "Use a public Google Calendar appointment schedule link from calendar.app.google.",
      expect.objectContaining({ id: "search-param-toast:error:invalid-host" }),
    );
    expect(sonnerToast.success).not.toHaveBeenCalled();
  });

  it("never toasts an unrecognized ?error=<code> (anti-spoofing: no URL-derived text)", () => {
    __setSearchParams("error=%3Cscript%3Ealert(1)%3C%2Fscript%3E");
    mount();

    expect(sonnerToast.error).not.toHaveBeenCalled();
    expect(sonnerToast.success).not.toHaveBeenCalled();
    expect(sonnerToast.warning).not.toHaveBeenCalled();
    expect(sonnerToast.info).not.toHaveBeenCalled();
  });

  it("does not toast at all when no flash param is present", () => {
    __setSearchParams("");
    mount();

    expect(sonnerToast.success).not.toHaveBeenCalled();
    expect(sonnerToast.error).not.toHaveBeenCalled();
    expect(__getReplaceCalls()).toEqual([]);
  });

  it("preserves an unrelated param while stripping only the consumed flash param", () => {
    __setSearchParams("notice=schedule-saved&tab=appointments");
    mount();

    expect(sonnerToast.success).toHaveBeenCalledTimes(1);
    expect(__getReplaceCalls()).toEqual([
      "/connectors/cinatra-ai/google-calendar-connector/setup?tab=appointments",
    ]);
  });
});
