import { type NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
	const res = NextResponse.next();
	const hasSession = request.cookies.get("rpg_session");
	if (!hasSession) {
		const id = (globalThis.crypto?.randomUUID?.() ??
			Math.random().toString(36).slice(2)) as string;
		const isProd = process.env.NODE_ENV === "production";
		res.cookies.set("rpg_session", id, {
			httpOnly: true,
			secure: isProd,
			sameSite: "lax",
			path: "/",
			maxAge: 60 * 60 * 24 * 90, // 90 days
		});
	}
	return res;
}

export const config = {
	matcher: "/:path*",
};
