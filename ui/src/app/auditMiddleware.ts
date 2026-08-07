import type { Middleware } from "@reduxjs/toolkit";

// The backend logs every permission check, allowed or denied, to its audit
// trail. This middleware mirrors that idea on the frontend: every dispatched
// action is logged as it flows through the store, giving the same
// "nothing happens silently" guarantee to the UI layer.
export const actionAuditMiddleware: Middleware = () => (next) => (action) => {
  const type = typeof action === "object" && action !== null && "type" in action
    ? String((action as { type: unknown }).type)
    : String(action);
  const payload = typeof action === "object" && action !== null && "payload" in action
    ? (action as { payload: unknown }).payload
    : undefined;

  // eslint-disable-next-line no-console
  console.log(`%c[redux-audit] ${type}`, "color:#9C6B26;font-weight:600", payload ?? "");

  return next(action);
};
