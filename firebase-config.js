/* RipZone · Firebase config (PLACEHOLDER)
 * No Firebase project exists yet. While this file contains PLACEHOLDER values the app automatically
 * uses the mock code flow (demo code on screen; the 10 test numbers in FIREBASE_SETUP.md need their fixed codes).
 *
 * To switch on real SMS verification, follow FIREBASE_SETUP.md:
 *  - Web/PWA:  paste the web app config from Firebase console > Project settings > Your apps > Web app (SDK setup: "Config").
 *  - Android:  put google-services.json in android/app/ and set native: true (uses @capacitor-firebase/authentication).
 */
window.RIPZONE_FIREBASE = {
  native: false,            // set to true after android/app/google-services.json is added and the APK is rebuilt
  web: {
    apiKey: 'PLACEHOLDER_API_KEY',
    authDomain: 'PLACEHOLDER.firebaseapp.com',
    projectId: 'PLACEHOLDER',
    appId: 'PLACEHOLDER_APP_ID',
  },
};
