import { NextResponse } from "next/server";
import { COOKIE_NAME, COOKIE_MAX_AGE, signSession } from "@/lib/auth";

export async function POST(request: Request) {
  const { password } = (await request.json()) as { password?: string };

  if (!password || password !== process.env.DASHBOARD_PASSWORD) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const authSecret = process.env.AUTH_SECRET;
  if (!authSecret) {
    return NextResponse.json(
      { error: "Server misconfigured: AUTH_SECRET not set" },
      { status: 500 },
    );
  }

  const cookieValue = await signSession(authSecret);
  const response = NextResponse.json({ success: true });
  response.cookies.set(COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
  return response;
}
