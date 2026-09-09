"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Person, ArrowRightFromLine } from "@gravity-ui/icons";
import { authClient } from "@/lib/auth-client";

/**
 * Shared account menu — used in the shop navbar (icon-only trigger) and in
 * the owner/admin sidebars (avatar + name row trigger), so the account
 * experience (photo, dropdown, sign out) looks and behaves identically
 * everywhere in the app, not just on the customer side.
 */
export function UserMenu({ variant = "navbar" }) {
  const { data: session } = authClient.useSession();
  const [open, setOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!session?.user) return null;
  const { user } = session;

  const handleSignOut = async () => {
    await authClient.signOut();
    window.location.href = "/login";
  };

  const initial = user.name?.trim()?.charAt(0)?.toUpperCase() || "?";

  const avatar = (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-container shadow-[inset_2px_2px_5px_rgba(184,196,214,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.9)]">
      {user.image && !imgError ? (
        <img
          src={user.image}
          alt={user.name}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="font-label-lg text-label-lg font-bold text-on-primary">{initial}</span>
      )}
    </div>
  );

  const menu = (
    <div
      className={`absolute z-20 w-56 rounded-2xl bg-surface-container-low p-2 shadow-[8px_8px_20px_rgba(184,196,214,0.6),-8px_-8px_20px_rgba(255,255,255,0.95)] ${
        variant === "sidebar" ? "bottom-full left-0 mb-2" : "right-0 mt-2"
      }`}
    >
      <div className="mb-1 border-b border-surface-container-high px-3 py-2">
        <p className="font-label-lg text-label-lg text-on-surface truncate">{user.name}</p>
        <p className="font-body-sm text-body-sm text-on-surface-variant truncate">{user.email}</p>
      </div>
      <Link
        href="/shop/profile"
        onClick={() => setOpen(false)}
        className="flex items-center gap-2 rounded-xl px-3 py-2 font-label-md text-label-md text-on-surface-variant hover:bg-surface-container transition-colors"
      >
        <Person className="h-4 w-4" />
        My Profile
      </Link>
      <button
        onClick={handleSignOut}
        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 font-label-md text-label-md text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"
      >
        <ArrowRightFromLine className="h-4 w-4" />
        Sign out
      </button>
    </div>
  );

  if (variant === "sidebar") {
    return (
      <div className="relative" ref={ref}>
        {open && menu}
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition-colors hover:bg-surface-container cursor-pointer"
        >
          {avatar}
          <div className="min-w-0 flex-1">
            <p className="font-label-md text-label-md text-on-surface truncate">{user.name}</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant truncate">{user.email}</p>
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((v) => !v)} className="cursor-pointer" aria-label="Account menu">
        {avatar}
      </button>
      {open && menu}
    </div>
  );
}
