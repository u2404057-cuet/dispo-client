"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bars, Xmark } from "@gravity-ui/icons";

const NAV_ITEMS = [
  { href: "/owner/dashboard", label: "Dashboard" },
  { href: "/owner/catalog", label: "Catalog" },
  { href: "/owner/devices", label: "Devices" },
  { href: "/owner/orders", label: "Orders" },
];

export default function OwnerLayout({ children }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navLinks = (
    <nav className="flex flex-1 flex-col gap-1">
      {NAV_ITEMS.map(({ href, label }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setSidebarOpen(false)}
            className={`rounded-2xl px-4 py-2.5 font-label-lg text-label-lg transition-colors ${
              active
                ? "bg-primary-container text-on-primary"
                : "text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-surface">
      {/* Backdrop — mobile only, closes the drawer on tap outside it */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar: slide-in drawer on mobile, static column on lg+ */}
      <aside
        className={`fixed top-16 bottom-0 left-0 z-20 w-64 shrink-0 border-r border-surface-container-high bg-surface-container-low p-6 flex flex-col overflow-y-auto transition-transform duration-200 lg:static lg:top-0 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-8 flex items-center justify-between">
          <span className="font-headline-sm text-headline-sm text-on-surface">Dispo Owner</span>
          <button
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
            className="lg:hidden text-on-surface-variant cursor-pointer"
          >
            <Xmark className="h-5 w-5" />
          </button>
        </div>
        {navLinks}
      </aside>

      <div className="flex-1 min-w-0">
        {/* Mobile top bar — hamburger trigger, only shown below the lg breakpoint */}
        <div className="lg:hidden flex items-center gap-3 border-b border-surface-container-high bg-surface-container-low px-4 py-3">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-on-surface shadow-[3px_3px_8px_rgba(184,196,214,0.5),-3px_-3px_8px_rgba(255,255,255,0.9)] cursor-pointer"
          >
            <Bars className="h-4 w-4" />
          </button>
          <span className="font-headline-sm text-headline-sm text-on-surface">Dispo Owner</span>
        </div>
        {children}
      </div>
    </div>
  );
}
