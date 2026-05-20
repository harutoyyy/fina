import { NextRequest, NextResponse } from "next/server"

// 公開パス (認証不要)。register は Phase 1 で廃止したため除外。
// Phase 2: 公開申請 (/apply) とパスワードリセット (/forgot-password, /reset-password) を追加
// Phase 3: 招待リンク (/accept) と強制パスワード変更 (/must-change-password) を追加
const publicPaths = [
  "/login",
  "/api/auth",
  "/apply",
  "/apply/done",
  "/forgot-password",
  "/reset-password",
  "/accept",
  "/must-change-password",
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1. 公開 register は廃止 → /login にリダイレクト
  if (pathname === "/register" || pathname.startsWith("/register/")) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  // 2. better-auth の signUp API を 404 でブロック (UI 経路廃止後の API スパム対策)
  if (pathname.startsWith("/api/auth/sign-up")) {
    return new NextResponse("Not Found", { status: 404 })
  }

  if (publicPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.next()
  }

  const sessionCookie =
    request.cookies.get("better-auth.session_token") ||
    request.cookies.get("__Secure-better-auth.session_token")
  if (!sessionCookie) {
    const loginUrl = new URL("/login", request.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
