/**
 * Mobile round 3 / R7 — the autosave infobox is shown at the head of the chat
 * once per LOGIN SESSION and dismissed by scrolling (no X button, no DB row,
 * founder-confirmed reversal of the R2-3 "static on purpose" decision).
 *
 * "Per login session" is implemented with sessionStorage, which is exactly
 * the browser's session scope: the flag survives reloads and tab-internal
 * navigation but dies with the tab/browser — nothing server-side, nothing
 * that outlives the visit. The login form additionally CLEARS the flag on
 * mount (lib is shared for that reason), so logging out and back in — or a
 * fresh login in the same tab — re-shows the notice, which is what "on every
 * login" asks for. All reads/writes are try/catch-guarded: storage access
 * can throw (privacy modes), and the notice must then simply behave as
 * not-yet-dismissed.
 */
export const AUTOSAVE_NOTICE_DISMISSED_KEY = 'sa.autosave-notice-dismissed'
