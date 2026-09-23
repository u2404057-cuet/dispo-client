"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Person, At, Lock, Eye, EyeSlash, ArrowRight } from "@gravity-ui/icons";
import { toast, Spinner } from "@heroui/react";
import { Capacitor } from "@capacitor/core";
import { authClient } from "@/lib/auth-client";
import { signInWithGoogleNative } from "@/lib/google-native-auth";

export default function RegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
    },
  });

  const passwordValue = watch("password") || "";

  // Password strength calculation stepping gradually from Red to Green
  const getPasswordStrength = (val) => {
    if (!val || val.length === 0) {
      return {
        level: 0,
        label: "At least 8 chars",
        textColor: "text-tertiary",
        bars: [
          "bg-surface-container-high",
          "bg-surface-container-high",
          "bg-surface-container-high",
          "bg-surface-container-high",
        ],
      };
    }

    const hasText = /[a-zA-Z]/.test(val);
    const hasNumber = /\d/.test(val);
    const hasUpper = /[A-Z]/.test(val);
    const hasSpecial = /[^a-zA-Z0-9]/.test(val);

    // 1 bar (Red): only text or basic characters
    // 2 bars (Amber/Orange): text + number
    // 3 bars (Lime/Yellow-green): text + number + capitalization
    // 4 bars (Green): text + number + capitalization + special characters
    let score = 1;
    if (hasText && hasNumber && hasUpper && hasSpecial) {
      score = 4;
    } else if (hasText && hasNumber && hasUpper) {
      score = 3;
    } else if (hasText && hasNumber) {
      score = 2;
    } else {
      const criteriaCount = [hasText, hasNumber, hasUpper, hasSpecial].filter(Boolean).length;
      score = Math.max(1, criteriaCount);
    }

    const stepConfig = {
      1: {
        label: "Weak",
        textColor: "text-red-500 font-bold",
        barColor: "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]",
      },
      2: {
        label: "Fair",
        textColor: "text-amber-500 font-bold",
        barColor: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]",
      },
      3: {
        label: "Good",
        textColor: "text-lime-600 font-bold",
        barColor: "bg-lime-500 shadow-[0_0_8px_rgba(132,204,22,0.4)]",
      },
      4: {
        label: "Strong",
        textColor: "text-emerald-500 font-bold",
        barColor: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.45)]",
      },
    };

    const current = stepConfig[score];

    return {
      level: score,
      label: current.label,
      textColor: current.textColor,
      bars: [
        score >= 1 ? current.barColor : "bg-surface-container-high",
        score >= 2 ? current.barColor : "bg-surface-container-high",
        score >= 3 ? current.barColor : "bg-surface-container-high",
        score >= 4 ? current.barColor : "bg-surface-container-high",
      ],
    };
  };

  const strength = getPasswordStrength(passwordValue);

  const handleGoogleSignUp = async () => {
    setIsGoogleLoading(true);
    try {
      // Same reasoning as the login page: a browser-redirect OAuth flow
      // escapes the app's WebView into Chrome and the session cookie it
      // sets never makes it back, so native platforms use Google's
      // native Credential Manager instead and hand the ID token straight
      // to better-auth.
      if (Capacitor.isNativePlatform()) {
        const idToken = await signInWithGoogleNative();
        const { error } = await authClient.signIn.social({
          provider: "google",
          idToken: { token: idToken },
        });

        if (error) {
          toast.danger("Couldn't sign up with Google", { description: error.message || "Please try again." });
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
      toast.danger("Couldn't sign up with Google", { description: error?.message || error?.errorMessage || "Please try again." });
      setIsGoogleLoading(false);
    }
  };

  const onSubmit = async (data) => {
    const { error } = await authClient.signUp.email({
      name: data.fullName,
      email: data.email,
      password: data.password,
      callbackURL: "/",
    });

    if (error) {
      toast.danger("Couldn't create your account", { description: error.message || "Please check your details and try again." });
      return;
    }

    router.push("/");
  };

  return (
    <main className="w-full bg-surface min-h-screen flex items-center justify-center py-10 px-4 sm:px-6">
      <div className="flex flex-col w-full max-w-7xl mx-auto items-center justify-center">
        <div className="w-full max-w-md">
          <div className="p-8 sm:p-10 lg:p-12 rounded-[2.5rem] bg-surface shadow-[8px_8px_22px_rgba(184,196,214,0.65),-8px_-8px_22px_rgba(255,255,255,0.95)] relative">
            
            {/* Header & Brand */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl p-1 bg-surface shadow-[4px_4px_10px_rgba(184,196,214,0.6),-4px_-4px_10px_rgba(255,255,255,0.95)] flex items-center justify-center transition-transform hover:scale-105">
                  <Image
                    src="/logo.png"
                    alt="Dispo Logo"
                    width={40}
                    height={40}
                    className="w-full h-full object-contain rounded-xl"
                    priority
                  />
                </div>
                <span className="font-headline-md text-headline-md text-on-surface tracking-tight">
                  Dispo
                </span>
              </div>
              <div>
                <h2 className="font-headline-lg text-headline-lg text-on-surface">
                  Create your account
                </h2>
                <p className="font-body-md text-body-md text-on-surface-variant mt-1">
                  Get started in seconds to manage your vending fleet and stock.
                </p>
              </div>
            </div>

            {/* Quick SSO Button */}
            <button
              type="button"
              onClick={handleGoogleSignUp}
              disabled={isGoogleLoading}
              className="w-full group flex items-center justify-center gap-3 py-3.5 px-6 rounded-full bg-surface shadow-[5px_5px_12px_rgba(184,196,214,0.6),-5px_-5px_12px_rgba(255,255,255,0.95)] hover:shadow-[7px_7px_16px_rgba(184,196,214,0.7),-7px_-7px_16px_rgba(255,255,255,1)] active:shadow-[inset_3px_3px_6px_rgba(184,196,214,0.5),inset_-3px_-3px_6px_rgba(255,255,255,0.9)] transition-all mb-6 cursor-pointer disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isGoogleLoading ? (
                <Spinner size="sm" />
              ) : (
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                  fill="#4285F4"
                />
                <path
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24z"
                  fill="#34A853"
                />
                <path
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  fill="#EA4335"
                />
              </svg>
              )}
              <span className="font-label-lg text-label-lg text-on-surface group-hover:text-primary-container transition-colors">
                Sign up with Google
              </span>
            </button>

            {/* Divider */}
            <div className="relative flex items-center justify-center my-6">
              <div className="w-full h-0.5 bg-surface-container-high rounded-full"></div>
              <span className="absolute px-4 bg-surface font-label-sm text-label-sm uppercase tracking-wider text-tertiary">
                or sign up with email
              </span>
            </div>

            {/* Form Fields */}
            <form className="flex flex-col gap-5" onSubmit={handleSubmit(onSubmit)}>
              {/* Full Name */}
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="fullName"
                  className="font-label-md text-label-md text-on-surface"
                >
                  Full Name
                </label>
                <div className="relative flex items-center rounded-2xl bg-surface shadow-[inset_3px_3px_6px_rgba(184,196,214,0.55),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] px-4 py-3 focus-within:ring-2 focus-within:ring-primary-container/40 transition-all">
                  <Person className="text-tertiary w-5 h-5 mr-3 shrink-0" />
                  <input
                    id="fullName"
                    type="text"
                    placeholder="Alex Morrison"
                    className="w-full bg-transparent font-body-md text-body-md text-on-surface placeholder:text-tertiary/70 focus:outline-none"
                    suppressHydrationWarning
                    {...register("fullName", { required: true })}
                  />
                </div>
              </div>

              {/* Email Address */}
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="email"
                  className="font-label-md text-label-md text-on-surface"
                >
                  Email Address
                </label>
                <div className="relative flex items-center rounded-2xl bg-surface shadow-[inset_3px_3px_6px_rgba(184,196,214,0.55),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] px-4 py-3 focus-within:ring-2 focus-within:ring-primary-container/40 transition-all">
                  <At className="text-tertiary w-5 h-5 mr-3 shrink-0" />
                  <input
                    id="email"
                    type="email"
                    placeholder="alex.morrison@dispo.io"
                    className="w-full bg-transparent font-body-md text-body-md text-on-surface placeholder:text-tertiary/70 focus:outline-none"
                    suppressHydrationWarning
                    {...register("email", { required: true })}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="font-label-md text-label-md text-on-surface"
                  >
                    Create Password
                  </label>
                  <span
                    className={`font-label-sm text-label-sm uppercase tracking-wider transition-colors ${strength.textColor}`}
                  >
                    {strength.label}
                  </span>
                </div>
                <div className="relative flex items-center rounded-2xl bg-surface shadow-[inset_3px_3px_6px_rgba(184,196,214,0.55),inset_-3px_-3px_6px_rgba(255,255,255,0.85)] px-4 py-3 focus-within:ring-2 focus-within:ring-primary-container/40 transition-all">
                  <Lock className="text-tertiary w-5 h-5 mr-3 shrink-0" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••••••"
                    className="w-full bg-transparent font-body-md text-body-md text-on-surface placeholder:text-tertiary/70 focus:outline-none tracking-wider"
                    suppressHydrationWarning
                    {...register("password", { required: true })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="text-tertiary hover:text-on-surface transition-colors focus:outline-none cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeSlash className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>

                {/* Password Strength Meter (Soft Pill Bars) */}
                <div className="grid grid-cols-4 gap-2 pt-1">
                  {strength.bars.map((barClass, idx) => (
                    <div
                      key={idx}
                      className={`h-1.5 rounded-full transition-colors duration-200 ${barClass}`}
                    />
                  ))}
                </div>
              </div>

              {/* Submit Primary Clay Pill Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="group mt-2 w-full flex items-center justify-between p-2 pl-8 rounded-full bg-surface shadow-[6px_6px_16px_rgba(184,196,214,0.65),-6px_-6px_16px_rgba(255,255,255,0.95)] hover:shadow-[8px_8px_20px_rgba(184,196,214,0.75),-8px_-8px_20px_rgba(255,255,255,1)] active:shadow-[inset_3px_3px_8px_rgba(184,196,214,0.6),inset_-3px_-3px_8px_rgba(255,255,255,0.9)] transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-70"
              >
                <span className="font-headline-sm text-headline-sm text-on-surface group-hover:text-primary-container transition-colors">
                  {isSubmitting ? "Creating account..." : "Create Account"}
                </span>
                <div className="w-12 h-12 rounded-full bg-primary-container text-on-primary flex items-center justify-center shadow-[3px_4px_10px_rgba(255,93,0,0.45)] group-hover:scale-105 transition-transform">
                  {isSubmitting ? <Spinner size="sm" color="current" /> : <ArrowRight className="w-5 h-5" />}
                </div>
              </button>
            </form>

            {/* Footer Switcher */}
            <div className="mt-8 text-center">
              <p className="font-body-md text-body-md text-on-surface-variant">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="font-label-lg text-label-lg font-bold text-primary-container hover:underline ml-1 transition-colors"
                >
                  Log in to Dispo
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
