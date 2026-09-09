"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Box, ShoppingCart, Bars, Xmark } from "@gravity-ui/icons";
import { authClient } from "@/lib/auth-client";
import { useCart } from "@/lib/cart-context";
import { UserMenu } from "@/components/user-menu";

/**
 * The one navbar for the whole app — present on every page, so "who's
 * logged in" and "go buy something" are always one click away, regardless
 * of whether you're deep in the owner dashboard, the admin panel, or just
 * landed on login. Section-specific nav (owner sidebar links, admin sidebar
 * links) still lives in those layouts; this bar only carries what's
 * universally relevant.
 *
 * Responsive behavior: the Shop/Dashboard tabs sit centered on wider
 * screens (md and up). Below that they collapse into a hamburger menu next
 * to the cart/avatar, since there isn't room for a centered nav row on a
 * phone-width screen without crowding everything else.
 */
export function GlobalNavbar() {
  const pathname = usePathname();
  const { data: session } = authClient.useSession();
  const { count } = useCart();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // No navbar at all on the auth pages themselves — nothing to show yet,
  // and the centered login/register cards want the full page to themselves.
  if (pathname === "/login" || pathname === "/register") return null;

  const role = session?.user?.role;
  const dashboardHref = role === "admin" ? "/admin/dashboard" : role === "owner" ? "/owner/dashboard" : null;

  const navLinkClass = (active) =>
    `relative pb-1 font-label-lg text-label-lg transition-all ${
      active
        ? "border-b-2 border-primary-container text-primary-container -translate-y-0.5"
        : "border-b-2 border-transparent text-on-surface-variant hover:text-on-surface"
    }`;

  return (
    <header className="sticky top-0 z-30 relative flex items-center justify-between border-b border-surface-container-high bg-surface/90 backdrop-blur px-4 sm:px-6 py-3">
      <Link href="/" className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#ff5d00] to-[#ff8c4b]">
          <Box className="h-4 w-4 text-white" />
        </div>
        <span className="font-headline-sm text-headline-sm text-on-surface hidden xs:inline">Dispo</span>
      </Link>

      {/* Centered tabs — desktop/tablet only */}
      {session?.user && (
        <nav className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
          <Link href="/shop" className={navLinkClass(pathname.startsWith("/shop"))}>
            Shop
          </Link>
          {dashboardHref && (
            <Link
              href={dashboardHref}
              className={navLinkClass(pathname.startsWith("/owner") || pathname.startsWith("/admin"))}
            >
              Dashboard
            </Link>
          )}
        </nav>
      )}

      <div className="flex items-center gap-2 sm:gap-3">
        {session?.user && (
          <>
            <Link
              href="/shop/cart"
              className="relative flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-low shadow-[3px_3px_8px_rgba(184,196,214,0.5),-3px_-3px_8px_rgba(255,255,255,0.9)]"
            >
              <ShoppingCart className="h-4 w-4 text-on-surface" />
              {count > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary-container font-label-sm text-label-sm text-on-primary">
                  {count}
                </span>
              )}
            </Link>

            {/* Hamburger — mobile only, holds the same Shop/Dashboard tabs */}
            <div className="relative md:hidden">
              <button
                onClick={() => setMobileNavOpen((v) => !v)}
                aria-label="Open navigation menu"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-low text-on-surface shadow-[3px_3px_8px_rgba(184,196,214,0.5),-3px_-3px_8px_rgba(255,255,255,0.9)] cursor-pointer"
              >
                {mobileNavOpen ? <Xmark className="h-4 w-4" /> : <Bars className="h-4 w-4" />}
              </button>
              {mobileNavOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-2xl bg-surface-container-low p-2 shadow-[8px_8px_20px_rgba(184,196,214,0.6),-8px_-8px_20px_rgba(255,255,255,0.95)] z-20">
                  <Link
                    href="/shop"
                    onClick={() => setMobileNavOpen(false)}
                    className={`block rounded-xl px-3 py-2 font-label-md text-label-md transition-colors ${
                      pathname.startsWith("/shop")
                        ? "bg-primary-container text-on-primary"
                        : "text-on-surface-variant hover:bg-surface-container"
                    }`}
                  >
                    Shop
                  </Link>
                  {dashboardHref && (
                    <Link
                      href={dashboardHref}
                      onClick={() => setMobileNavOpen(false)}
                      className={`block rounded-xl px-3 py-2 font-label-md text-label-md transition-colors ${
                        pathname.startsWith("/owner") || pathname.startsWith("/admin")
                          ? "bg-primary-container text-on-primary"
                          : "text-on-surface-variant hover:bg-surface-container"
                      }`}
                    >
                      Dashboard
                    </Link>
                  )}
                </div>
              )}
            </div>
          </>
        )}
        <UserMenu variant="navbar" />
      </div>
    </header>
  );
}
