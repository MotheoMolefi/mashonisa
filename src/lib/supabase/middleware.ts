/**
 * Runs on every matched request: refreshes Supabase auth cookies, then enforces
 * - login required for non-public routes
 * - /admin only for role admin
 * - admins may still open /user (e.g. separate tab to preview the borrower app)
 * - logged-in users skip /login and /signup
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // PayFast ITN: server-to-server POST, no browser session — must not redirect to /login
  if (pathname.startsWith("/api/payfast/notify")) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Public routes that don't require auth
  const publicRoutes = ["/", "/login", "/signup"];
  const isPublicRoute = publicRoutes.includes(pathname);

  // If not logged in and trying to access protected route
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Get the user's role via RPC (bypasses RLS)
  const { data: role } = await supabase.rpc("get_my_role");

  // If logged in, check role for admin routes
  if (user && pathname.startsWith("/admin")) {
    if (role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/user";
      return NextResponse.redirect(url);
    }
  }

  // If logged in and visiting login/signup, redirect to dashboard
  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = role === "admin" ? "/admin" : "/user";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
