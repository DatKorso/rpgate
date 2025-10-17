import { db } from "@/db";
import { messages, rolls, sessions, turns } from "@/db/schema";
import {
	computeSkillModifiers,
	getCharacterProfile,
	getOrCreateCharacter,
} from "@/lib/agents/character";
import { retrieveMemories } from "@/lib/agents/memory";
import {
	extractMemoryFromTurn,
	storeMemory,
} from "@/lib/agents/memory-storage";
import { streamNarrative } from "@/lib/agents/narrative-llm";
import type { DecideContext, PlayerInput } from "@/lib/agents/protocol";
import { decideCheck } from "@/lib/agents/rules";
import { type DiceResult, applyModifiers, rollD20 } from "@/lib/mechanics/dice";
import { analyzeMemoryNeed } from "@/lib/memory/heuristic";
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

	// Heuristic Gate: determine if memory retrieval is needed
	// Note: analyzeMemoryNeed now logs internally
	const heuristicResult = analyzeMemoryNeed(input.content, history);

	const decideCtx: DecideContext = { history };

	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			const encoder = new TextEncoder();
			const send = (obj: unknown) =>
				controller.enqueue(encoder.encode(sseChunk(obj)));

			// Memory retrieval (parallel with Rules/Character agents)
			let memoryRetrievalPromise: Promise<{
				memories: import("@/db/schema").MemoryEntryData[];
				retrievalTimeMs: number;
				query: string;
			} | null> | null = null;

			if (heuristicResult.shouldRetrieve) {
				// Start memory retrieval in parallel
				memoryRetrievalPromise = retrieveMemories(session.id, input.content, {
					limit: 5,
					similarityThreshold: 0.7,
					timeoutMs: 2000,
				}).catch((err) => {
					console.error("[Memory] Retrieval error:", err);
					return null;
				});

				// Send SSE event for UI
				console.log("[SSE] Sending memory_status: triggered=true");
				send({
					type: "memory_status",
					payload: {
						triggered: true,
						triggers: heuristicResult.triggers,
						entities: heuristicResult.entities,
						confidence: heuristicResult.confidence,
					},
				});
			} else {
				console.log("[SSE] Sending memory_status: triggered=false");
				send({
					type: "memory_status",
					payload: { triggered: false },
				});
			}

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

			// Step 4: Get character profile from DB
			const characterProfile = await getCharacterProfile(session.id);

			// Step 4.5: Wait for memory retrieval (if triggered)
			let retrievedMemories:
				| import("@/db/schema").MemoryEntryData[]
				| undefined = undefined;
			if (memoryRetrievalPromise) {
				try {
					const memoryResult = await memoryRetrievalPromise;
					if (memoryResult && memoryResult.memories.length > 0) {
						retrievedMemories = memoryResult.memories;
						console.log(
							"[SSE] Sending memory_retrieved: count=",
							memoryResult.memories.length,
						);
						send({
							type: "memory_retrieved",
							payload: {
								count: memoryResult.memories.length,
								retrievalTimeMs: memoryResult.retrievalTimeMs,
							},
						});
					}
				} catch (err) {
					console.error("[Memory] Failed to retrieve memories:", err);
					// Continue without memories
				}
			}

			// Step 5: Narrative via LLM streaming
			let fullText = "";
			try {
				for await (const delta of streamNarrative(
					input,
					rules,
					outcome,
					history,
					characterProfile,
					retrievedMemories,
				)) {
					fullText += delta;
					send({ type: "narrative", payload: { textDelta: delta } });
				}
			} catch {
				// on any error, keep whatever accumulated
			}

			// Step 6: GM finalization
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
			const turn = (
				await db
					.insert(turns)
					.values({
						sessionId: session.id,
						playerMessageId: playerMsg.id,
						gmMessageId: gmMsg.id,
						meta: "",
					})
					.returning()
			)[0];

			// Step 7: Memory Storage (async, fire-and-forget)
			// Extract and store important memories from this turn
			const turnNumber = await db
				.select({ count: turns.id })
				.from(turns)
				.where(eq(turns.sessionId, session.id))
				.then((rows) => rows.length);

			// Fire-and-forget: don't await, don't block response
			// But send SSE event if memory was stored
			Promise.resolve()
				.then(async () => {
					const extraction = extractMemoryFromTurn(
						input.content,
						final.text,
						turnNumber,
					);
					if (extraction.shouldStore) {
						await storeMemory(session.id, turn.id, turnNumber, extraction);
						// Note: Can't send SSE after controller.close()
						// This is just for logging/future webhook support
						console.log("[Memory] Stored:", {
							type: extraction.type,
							turnNumber,
						});
						return true;
					}
					return false;
				})
				.catch((err) => {
					console.error("[Memory] Storage error:", err);
					// Silently fail - memory storage should never break main flow
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
