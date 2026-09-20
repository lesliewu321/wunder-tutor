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
    // The first screen is the app's own, so the launch image only needs to cover the moment the WebView starts.
    SplashScreen: { launchShowDuration: 600, backgroundColor: '#fff8ee', androidScaleType: 'CENTER_CROP', showSpinner: false },
  },
};

export default config;
