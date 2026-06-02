import { registerGoogleCalendarPrimitives } from "./registry";

export function createGoogleCalendarModule() {
  return {
    registerCapabilities: registerGoogleCalendarPrimitives,
  };
}
