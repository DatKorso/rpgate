import { db } from "@/db";
import { messages, sessions } from "@/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
	const extId = cookies().get("rpg_session")?.value || "anon";
	const sess = await db
		.select()
		.from(sessions)
		.where(eq(sessions.externalId, extId))
		.limit(1);
	if (!sess[0]) return NextResponse.json({ items: [] });
	const rows = await db
		.select({
			role: messages.role,
			content: messages.content,
			createdAt: messages.createdAt,
		})
		.from(messages)
		.where(
			and(
				eq(messages.sessionId, sess[0].id),
				inArray(messages.role, ["player", "gm"]),
			),
		)
		.orderBy(desc(messages.createdAt))
		.limit(30);
	const items = rows.reverse();
	return NextResponse.json({ items });
}
