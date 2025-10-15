import { db } from "@/db";
import { messages, rolls, sessions, turns } from "@/db/schema";
import {
	computeSkillModifiers,
	getOrCreateCharacter,
} from "@/lib/agents/character";
import { streamNarrative } from "@/lib/agents/narrative-llm";
import type { DecideContext, PlayerInput } from "@/lib/agents/protocol";
import { decideCheck } from "@/lib/agents/rules";
import { type DiceResult, applyModifiers, rollD20 } from "@/lib/mechanics/dice";
import { checkRateLimit } from "@/lib/rate-limit";
import { and, desc, eq, inArray } from "drizzle-orm";
import { cookies } from "next/headers";
import { z } from "zod";

const inputSchema = z.object({
	sessionId: z.string().optional(),
	content: z.string().min(1),
	profile: z
		.object({
			name: z.string().optional(),
			className: z.string().optional(),
			bio: z.string().optional(),
		})
		.optional(),
});

function sseChunk(obj: unknown) {
	return `data: ${JSON.stringify(obj)}\n\n`;
}

export async function POST(req: Request) {
	// Rate limiting: 20 requests per minute per session
	const cookieSession = cookies().get("rpg_session")?.value || "anon";
	const rateLimitResult = checkRateLimit(cookieSession, {
		id: "chat",
		limit: 20,
		window: 60 * 1000,
	});
	if (!rateLimitResult.success) {
		return new Response("Too many requests", {
			status: 429,
			headers: {
				"X-RateLimit-Limit": String(rateLimitResult.limit),
				"X-RateLimit-Remaining": String(rateLimitResult.remaining),
				"X-RateLimit-Reset": String(rateLimitResult.reset),
			},
		});
	}

	const body = await req.json().catch(() => null);
	const parsed = inputSchema.safeParse(body);
	if (!parsed.success) {
		return new Response("Invalid input", { status: 400 });
	}
	const input = parsed.data as PlayerInput;
	const externalId = input.sessionId || cookieSession || "anon";

	// Ensure session exists (map external sessionId to numeric id)
	const existing = await db
		.select()
		.from(sessions)
		.where(eq(sessions.externalId, externalId))
		.limit(1);
	const session = existing[0]
		? existing[0]
		: (
				await db
					.insert(sessions)
					.values({ externalId, locale: "ru", setting: "medieval_fantasy" })
					.returning()
			)[0];

	// Update profile if provided
	if (input.profile?.className || input.profile?.bio) {
		await db
			.update(sessions)
			.set({
				playerClass: input.profile.className ?? "",
				playerBio: input.profile.bio ?? "",
			})
			.where(eq(sessions.id, session.id));
	}

	// Insert player message
	const playerMsg = (
		await db
			.insert(messages)
			.values({ sessionId: session.id, role: "player", content: input.content })
			.returning()
	)[0];

	// Build last 15 messages (player/gm) history for context
	const historyRows = await db
		.select({ role: messages.role, content: messages.content })
		.from(messages)
		.where(
			and(
				eq(messages.sessionId, session.id),
				inArray(messages.role, ["player", "gm"]),
			),
		)
		.orderBy(desc(messages.createdAt))
		.limit(15);
	const history = historyRows
		.slice()
		.reverse()
		.map((m) => ({ role: m.role as "player" | "gm", content: m.content }));

	const decideCtx: DecideContext = { history };

	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			const encoder = new TextEncoder();
			const send = (obj: unknown) =>
				controller.enqueue(encoder.encode(sseChunk(obj)));

			// Step 1: Rules decide
			const rules = await decideCheck(input, decideCtx);
			send({ type: "rules", payload: rules });

			let rollResult: DiceResult | null = null;
			let outcome: {
				success: boolean;
				critical: boolean;
				margin: number;
			} | null = null;

			if (rules.requiresCheck && rules.type === "skill" && rules.dc) {
				// Step 2: Character modifiers
				await getOrCreateCharacter(session.id, input.profile);
				const modifiers = await computeSkillModifiers(session.id, rules.skill);
				// Step 3: Roll and compute outcome
				const roll = rollD20();
				rollResult = applyModifiers(roll, modifiers);
				const critical = rollResult.roll === 1 || rollResult.roll === 20;
				const success = critical
					? rollResult.roll === 20
					: rollResult.modified >= rules.dc;
				const margin = rollResult.modified - rules.dc;
				outcome = { success, critical, margin };
				send({ type: "roll", payload: rollResult });
				send({ type: "outcome", payload: outcome });

				// Persist roll
				await db.insert(rolls).values({
					sessionId: session.id,
					value: rollResult.roll,
					modified: rollResult.modified,
					category: rollResult.category,
					modifiersJson: JSON.stringify(rollResult.modifierBreakdown),
				});
			}

			// Step 4: Narrative via LLM streaming
			let fullText = "";
			try {
				for await (const delta of streamNarrative(
					input,
					rules,
					outcome,
					history,
				)) {
					fullText += delta;
					send({ type: "narrative", payload: { textDelta: delta } });
				}
			} catch {
				// on any error, keep whatever accumulated
			}

			// Step 5: GM finalization
			const final = {
				text: fullText || "Ход завершён.",
				summary: "Итог хода сформирован GM",
			};
			send({ type: "final", payload: final });

			// Persist GM message and Turn
			const gmMsg = (
				await db
					.insert(messages)
					.values({ sessionId: session.id, role: "gm", content: final.text })
					.returning()
			)[0];
			await db.insert(turns).values({
				sessionId: session.id,
				playerMessageId: playerMsg.id,
				gmMessageId: gmMsg.id,
				meta: "",
			});

			controller.close();
		},
		cancel() {},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream; charset=utf-8",
			"Cache-Control": "no-cache, no-transform",
			Connection: "keep-alive",
			"X-Accel-Buffering": "no",
		},
	});
}
