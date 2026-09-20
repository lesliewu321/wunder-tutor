// Where this copy of the app is running: a web page at app.wundertutor.com, or inside the phone app (Capacitor),
// where the very same files are served from the device itself.
//
// It matters for one thing above all: in the phone app the page's address is localhost, so "/api/read" would ask the
// PHONE for the API and find nothing. The phone app is therefore built with the API's real address baked in
// (npm run build:app), and every call goes through `apiUrl()`. On the web the address stays empty, so calls stay
// relative and same-origin exactly as before.

/** The API's address for this build: "" on the web, "https://app.wundertutor.com" in the phone app. */
export const API_BASE: string = typeof __API_BASE__ === 'string' ? __API_BASE__.replace(/\/+$/, '') : '';

/** True in the phone app (iOS/Android), false on the web. */
export const isApp = API_BASE !== '';

/** "/api/read" → the address to actually call. */
export const apiUrl = (path: string): string => (API_BASE && path.startsWith('/') ? API_BASE + path : path);

/**
 * Where the sign-in email's link should land. In the phone app the page itself lives on the device, so a link to
 * localhost would open nothing: it points at the website instead, which explains what to do. The code in the
 * same email is what the phone app actually uses.
 */
export const emailReturnUrl = (): string => `${API_BASE || (typeof window === 'undefined' ? '' : window.location.origin)}/parents`;
