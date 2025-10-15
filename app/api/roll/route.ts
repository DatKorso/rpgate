import { db } from "@/db";
import { sessions } from "@/db/schema";
import { computeSkillModifiers } from "@/lib/agents/character";
import {
	type DiceResult,
	type Modifiers,
	applyModifiers,
	rollD20,
} from "@/lib/mechanics/dice";
import { checkRateLimit } from "@/lib/rate-limit";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
	modifiers: z
		.object({
			ability: z.number().default(0),
			skill: z.number().default(0),
			equipment: z.number().default(0),
			temporary: z.number().default(0),
		})
		.optional(),
	sessionId: z.string().optional(),
	skill: z.string().optional(),
});

export async function POST(req: Request) {
	const body = await req.json().catch(() => ({}));
	const parsed = schema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
	}

	// Get session ID for rate limiting (try-catch for test compatibility)
	let cookieSession: string | undefined;
	try {
		cookieSession = cookies().get("rpg_session")?.value;
	} catch {
		// In test environment, cookies() may not be available
		cookieSession = undefined;
	}
	const sessionId = parsed.data.sessionId || cookieSession || "anon";

	// Rate limiting: 30 rolls per minute per session
	const rateLimitResult = checkRateLimit(sessionId, {
		id: "roll",
		limit: 30,
		window: 60 * 1000,
	});
	if (!rateLimitResult.success) {
		return NextResponse.json(
			{ error: "Too many requests" },
			{
				status: 429,
				headers: {
					"X-RateLimit-Limit": String(rateLimitResult.limit),
					"X-RateLimit-Remaining": String(rateLimitResult.remaining),
					"X-RateLimit-Reset": String(rateLimitResult.reset),
				},
			},
		);
	}

	// Compute modifiers: prefer sessionId+skill if provided
	let mods: Modifiers = { ability: 0, skill: 0, equipment: 0, temporary: 0 };
	const extId = sessionId;
	if (extId && parsed.data.skill) {
		const sess = await db
			.select()
			.from(sessions)
			.where(eq(sessions.externalId, extId))
			.limit(1);
		if (sess[0]) {
			mods = await computeSkillModifiers(sess[0].id, parsed.data.skill);
		}
	} else if (parsed.data.modifiers) {
		mods = parsed.data.modifiers as Modifiers;
	}
	const roll = rollD20();
	const result: DiceResult = applyModifiers(roll, mods);
	return NextResponse.json(result);
}
