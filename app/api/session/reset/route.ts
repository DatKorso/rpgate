import { db } from "@/db";
import { sessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
	const body = (await req.json().catch(() => ({}))) as {
		regenerateCookie?: boolean;
	};
	const extId = cookies().get("rpg_session")?.value || "anon";

	// Delete session and all cascaded data (messages, turns, rolls, character)
	await db.delete(sessions).where(eq(sessions.externalId, extId));

	const res = NextResponse.json({
		cleared: true,
		regenerated: Boolean(body?.regenerateCookie),
	});

	if (body?.regenerateCookie) {
		const id = (globalThis.crypto?.randomUUID?.() ??
			Math.random().toString(36).slice(2)) as string;
		const isProd = process.env.NODE_ENV === "production";
		res.cookies.set("rpg_session", id, {
			httpOnly: true,
			secure: isProd,
			sameSite: "lax",
			path: "/",
			maxAge: 60 * 60 * 24 * 90,
		});
	}

	return res;
}
