import type { CapacitorConfig } from '@capacitor/cli';

// Wunder Tutor as a phone app. The very same web app, carried on the device instead of fetched from the web: it
// starts instantly, works with no signal (lessons, My book, practice mode), and asks for the microphone and camera
// the way a phone app does, not the way a web page does.
//
// Build it with:  npm run build:app   (that sets the API's address — see src/platform.ts — and syncs it in here)
const config: CapacitorConfig = {
  appId: 'com.wundertutor.app',
  appName: 'Wunder Tutor',
  webDir: 'dist',
  android: {
    // The app's own pages are served as https://localhost, so the WebView treats them as a secure origin — the
    // microphone and the camera are refused on anything less. The API answers this origin by name (server/core.mjs).
    // `allowMixedContent` stays off: everything this app talks to is https.
    allowMixedContent: false,
  },
  plugins: {
    // Android 15 and later draw apps behind the status bar and the navigation bar, edge to edge, and there is no
    // opting out. The app already expects that: index.html asks for `viewport-fit=cover` and the layout keeps clear
    // of the bars with env(safe-area-inset-*) (src/styles/tokens.css). Saying `cover` here as well tells Capacitor
    // what it will find before it reads the page, so the first screen does not jump once it has read it.
    SystemBars: { initialViewportFitValueHint: 'cover' },
  },
  // There is no launch-screen plugin and none is needed: Android shows the activity's launch theme
  // (android/app/src/main/res/drawable/splash.xml — the app's cream and Pip) until the WebView has drawn, which is
  // quick because the files are already on the device.
};

export default config;
