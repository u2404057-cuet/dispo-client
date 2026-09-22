import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.chypher.dispo',
  appName: 'Dispo',
  // Not actually used for content — kept only because Capacitor's CLI
  // expects webDir to point at an existing folder. The real app content
  // comes from server.url below instead, since this app relies on real
  // server-side sessions, API routes, and middleware that can't be
  // bundled as a static local build.
  webDir: 'public',
  server: {
    url: 'https://dispo-client.vercel.app',
    cleartext: false,
  },
  plugins: {
    // Only Google is wired up (see src/lib/google-native-auth.js) — the
    // other providers would otherwise bundle their SDKs for nothing.
    SocialLogin: {
      providers: {
        google: true,
        facebook: false,
        apple: false,
        twitter: false,
      },
    },
  },
};

export default config;
