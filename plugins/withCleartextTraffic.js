const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

// Force cleartext (HTTP) traffic on for the demo build. The backend is
// currently served over HTTP only. We set the flag AND strip any
// networkSecurityConfig reference, because that config — if present —
// overrides android:usesCleartextTraffic and re-blocks HTTP on Android 9+.
// Remove this plugin once the backend is HTTPS.
module.exports = function withCleartextTraffic(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    app.$['android:usesCleartextTraffic'] = 'true';
    delete app.$['android:networkSecurityConfig'];
    return cfg;
  });
};
