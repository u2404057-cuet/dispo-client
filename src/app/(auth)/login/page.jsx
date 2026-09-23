"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Envelope, Lock, Eye, EyeSlash, ArrowRight } from "@gravity-ui/icons";
import { toast, Spinner } from "@heroui/react";
import { Capacitor } from "@capacitor/core";
import { authClient } from "@/lib/auth-client";
import { signInWithGoogleNative } from "@/lib/google-native-auth";

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    try {
      // In the native app, a normal redirect-based OAuth flow gets handed
      // off to Chrome (the WebView only navigates within its own origin),
      // and the session cookie that Google's callback sets ends up in
      // Chrome's cookie jar, not the app's — so the app never sees it.
      // Native Google Sign-In gets an ID token without leaving the app,
      // and we hand that straight to better-auth to set the session
      // cookie inside the app's own WebView.
      if (Capacitor.isNativePlatform()) {
        const idToken = await signInWithGoogleNative();
        const { error } = await authClient.signIn.social({
          provider: "google",
          idToken: { token: idToken },
        });

        if (error) {
          toast.danger("Couldn't sign in with Google", { description: error.message || "Please try again." });
          setIsGoogleLoading(false);
          return;
        }

        router.push("/");
        return;
      }

      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/",
      });
    } catch (error) {
      console.log(error);
      toast.danger("Couldn't sign in with Google", { description: error?.message || error?.errorMessage || "Please try again." });
      setIsGoogleLoading(false);
    }
  };

  const onSubmit = async (data) => {
    const { error } = await authClient.signIn.email({
      email: data.email,
      password: data.password,
      rememberMe: true,
      callbackURL: "/",
    });

    if (error) {
      toast.danger("Couldn't sign in", { description: error.message || "Check your email and password." });
      return;
    }

    router.push("/");
  };

  return (
    <main className="w-full bg-surface min-h-screen flex items-center justify-center p-4 sm:p-6">
      <div className="flex flex-col w-full max-w-7xl mx-auto items-center justify-center py-8">
        <div className="w-full max-w-md rounded-[2.5rem] bg-surface-container-low p-6 sm:p-10 shadow-[12px_12px_28px_rgba(184,196,214,0.65),-12px_-12px_28px_rgba(255,255,255,0.95)]">
          
          {/* Header & Logo */}
          <div className="mb-8 text-center flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl p-1.5 bg-surface shadow-[5px_5px_12px_rgba(184,196,214,0.55),-5px_-5px_12px_rgba(255,255,255,0.95)] flex items-center justify-center mb-4 transition-transform hover:scale-105">
              <Image
                src="/logo.png"
                alt="Dispo Logo"
                width={56}
                height={56}
                className="w-full h-full object-contain rounded-xl"
                priority
              />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface shadow-[inset_2px_2px_4px_rgba(184,196,214,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.9)] mb-3">
              <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse"></span>
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface font-semibold">
                Secure Dispo ID
              </span>
            </div>
            
            <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
              Welcome back
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1 max-w-xs">
              Sign in to manage your connected vending fleet and inventory.
            </p>
          </div>

          {/* Google SSO Button */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isGoogleLoading}
            className="w-full group flex items-center justify-center gap-3 px-6 py-3.5 rounded-full bg-surface-bright shadow-[5px_5px_12px_rgba(184,196,214,0.6),-5px_-5px_12px_rgba(255,255,255,0.95)] hover:shadow-[7px_7px_16px_rgba(184,196,214,0.7),-7px_-7px_16px_rgba(255,255,255,1)] active:shadow-[inset_3px_3px_6px_rgba(184,196,214,0.55),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] transition-all duration-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isGoogleLoading ? (
              <Spinner size="sm" />
            ) : (
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                fill="#EA4335"
              />
            </svg>
            )}
            <span className="font-label-lg text-label-lg text-on-surface group-hover:text-primary-container transition-colors">
              Log in with Google
            </span>
          </button>

          {/* Divider */}
          <div className="relative my-6 flex items-center justify-center">
            <div className="w-full h-[2px] bg-surface shadow-[inset_1px_1px_2px_rgba(184,196,214,0.4),inset_-1px_-1px_2px_rgba(255,255,255,0.8)] rounded-full"></div>
            <span className="absolute px-4 bg-surface-container-low font-label-sm text-label-sm uppercase tracking-wider text-tertiary">
              or continue with email
            </span>
          </div>

          {/* Form */}
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            {/* Email Field */}
            <div className="space-y-1.5">
              <label
                htmlFor="emailInput"
                className="block font-label-md text-label-md text-on-surface font-semibold"
              >
                Email Address
              </label>
              <div className="relative flex items-center rounded-full bg-surface-container shadow-[inset_3px_3px_6px_rgba(184,196,214,0.55),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] px-4 py-3 focus-within:shadow-[inset_4px_4px_7px_rgba(184,196,214,0.65),inset_-4px_-4px_7px_rgba(255,255,255,0.95),0_0_0_2px_#ff5d00] transition-all">
                <Envelope className="text-tertiary w-5 h-5 mr-2.5 shrink-0 select-none" />
                <input
                  id="emailInput"
                  type="email"
                  placeholder="alex.vance@dispo.io"
                  className="w-full bg-transparent font-body-md text-body-md text-on-surface placeholder:text-tertiary focus:outline-none"
                  suppressHydrationWarning
                  {...register("email", { required: true })}
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="passwordInput"
                  className="block font-label-md text-label-md text-on-surface font-semibold"
                >
                  Password
                </label>
              </div>
              <div className="relative flex items-center rounded-full bg-surface-container shadow-[inset_3px_3px_6px_rgba(184,196,214,0.55),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] px-4 py-3 focus-within:shadow-[inset_4px_4px_7px_rgba(184,196,214,0.65),inset_-4px_-4px_7px_rgba(255,255,255,0.95),0_0_0_2px_#ff5d00] transition-all">
                <Lock className="text-tertiary w-5 h-5 mr-2.5 shrink-0 select-none" />
                <input
                  id="passwordInput"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••••"
                  className="w-full bg-transparent font-body-md text-body-md text-on-surface placeholder:text-tertiary focus:outline-none"
                  suppressHydrationWarning
                  {...register("password", { required: true })}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="p-1 rounded-full hover:bg-surface-variant transition-colors flex items-center justify-center text-tertiary hover:text-on-surface focus:outline-none cursor-pointer"
                >
                  {showPassword ? (
                    <EyeSlash className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-between p-2 pl-6 sm:pl-8 rounded-full bg-surface shadow-[6px_6px_14px_rgba(184,196,214,0.6),-6px_-6px_14px_rgba(255,255,255,0.95)] hover:shadow-[8px_8px_18px_rgba(184,196,214,0.7),-8px_-8px_18px_rgba(255,255,255,1)] active:shadow-[inset_3px_3px_6px_rgba(184,196,214,0.5),inset_-3px_-3px_6px_rgba(255,255,255,0.8)] transition-all group cursor-pointer disabled:cursor-not-allowed disabled:opacity-70"
              >
                <span className="font-headline-sm text-headline-sm font-bold text-on-surface tracking-tight group-hover:text-primary-container transition-colors">
                  {isSubmitting ? "Signing in..." : "Sign In"}
                </span>
                <div className="w-12 h-12 rounded-full bg-primary-container text-on-primary flex items-center justify-center shadow-[4px_6px_14px_rgba(255,93,0,0.38),-2px_-2px_6px_rgba(255,140,75,0.4)] group-hover:scale-105 group-active:scale-95 transition-transform">
                  {isSubmitting ? <Spinner size="sm" color="current" /> : <ArrowRight className="w-6 h-6" />}
                </div>
              </button>
            </div>
          </form>

          {/* Footer Switcher */}
          <div className="mt-8 text-center">
            <p className="font-body-md text-body-md text-on-surface-variant">
              Don&apos;t have an account yet?{" "}
              <Link
                href="/register"
                className="font-label-lg text-label-lg font-bold text-primary-container hover:underline ml-1 transition-colors"
              >
                Sign up for Dispo
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
