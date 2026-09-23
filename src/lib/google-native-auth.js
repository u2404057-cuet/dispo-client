"use client";

import { SocialLogin } from "@capgo/capacitor-social-login";

let initialized = null;

function initialize() {
  if (!initialized) {
    initialized = SocialLogin.initialize({
      google: { webClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID },
    });
  }
  return initialized;
}

// Signs in with Google's native Credential Manager (no browser involved)
// and returns the ID token for better-auth's idToken sign-in, so the
// session cookie lands in the app's own WebView instead of an external
// browser.
export async function signInWithGoogleNative() {
  await initialize();
  // No `scopes` here on purpose: the plugin already requests
  // email/profile/openid by default, and passing scopes explicitly
  // switches it to Google's Authorization API, which requires extra
  // MainActivity wiring we don't need for a plain sign-in.
  const { result } = await SocialLogin.login({ provider: "google" });
  return result.idToken;
}
