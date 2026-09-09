import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Next.js 16 runs this on the Node.js runtime by default (unlike the old
// Edge-only middleware.ts), so we can safely call auth.api.getSession()
// here directly — full MongoDB-backed session + role validation, not just
// an optimistic cookie check.
export async function proxy(request) {
  const { pathname } = request.nextUrl;

  const isOwnerRoute = pathname.startsWith("/owner");
  const isAdminRoute = pathname.startsWith("/admin");
  const isShopRoute = pathname.startsWith("/shop");
  const isRoot = pathname === "/";

  if (!isOwnerRoute && !isAdminRoute && !isShopRoute && !isRoot) {
    return NextResponse.next();
  }

  const session = await auth.api.getSession({ headers: request.headers });

  // "/" is the universal landing spot — send everyone straight to the
  // right home for their role, so nobody has to think about where to go.
  if (isRoot) {
    if (!session) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (!session.user.phone) {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }
    const role = session.user.role;
    if (role === "admin") return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    if (role === "owner") return NextResponse.redirect(new URL("/owner/dashboard", request.url));
    return NextResponse.redirect(new URL("/shop", request.url));
  }

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Every signed-in visitor needs a phone number on file before they can
  // do anything else — collected once, right after their very first
  // login/signup (Google or email), regardless of which page they were
  // originally headed to.
  if (!session.user.phone) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  const role = session.user.role;

  if (isAdminRoute && role !== "admin") {
    return NextResponse.redirect(new URL("/shop/browse", request.url));
  }

  if (isOwnerRoute && role !== "owner" && role !== "admin") {
    return NextResponse.redirect(new URL("/shop/browse", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/shop/:path*", "/owner/:path*", "/admin/:path*"],
};
