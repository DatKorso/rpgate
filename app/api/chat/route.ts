import { db } from "@/db";
import { messages, rolls, sessions, turns } from "@/db/schema";
import {
	computeSkillModifiers,
	getEnhancedCharacterProfile,
	getOrCreateCharacter,
} from "@/lib/agents/character";
import { retrieveMemories } from "@/lib/agents/memory";
import { analyzeMemoryNeed as analyzeMemoryNeedAgent } from "@/lib/agents/memory-agent";
import {
	extractMemoryFromTurn,
	storeMemory,
} from "@/lib/agents/memory-storage";
import {
	type CharacterProfile,
	buildNarrativeContext,
} from "@/lib/agents/narrative-context";
import { streamNarrative } from "@/lib/agents/narrative-llm";
import { updatePlayerKnowledge } from "@/lib/agents/player-knowledge-updater";
import type { DecideContext, PlayerInput } from "@/lib/agents/protocol";
import { decideCheck } from "@/lib/agents/rules";
import { updateWorldKnowledge } from "@/lib/agents/world-knowledge-updater";
import {
	isDiceChecksEnabled,
	isMemoryAgentEnabled,
	isPlayerKnowledgeEnabled,
	isWorldKnowledgeEnabled,
} from "@/lib/feature-flags";
import { persistPlayerKnowledge } from "@/lib/knowledge/player-persistence";
import { persistWorldKnowledge } from "@/lib/knowledge/world-persistence";
import {
	type DiceResult,
	applyModifiers,
	performSkillCheck,
	rollD20,
} from "@/lib/mechanics/dice";
import { mergeMemoryResults } from "@/lib/memory/deduplication";
import { analyzeMemoryNeed as analyzeMemoryNeedHeuristic } from "@/lib/memory/heuristic";
import {
	logPlayerKnowledgeUpdate,
	logWorldKnowledgeUpdate,
} from "@/lib/memory/logger";
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

	// Memory Agent: determine if memory retrieval is needed
	// Falls back to heuristic on timeout/error or if feature flag is disabled
	let memoryDecision: {
		shouldRetrieve: boolean;
		queries?: string[];
		entities?: Array<{ name: string; type: string; context?: string }>;
		confidence?: number;
		reason?: string;
		triggers?: string[];
	};
	let usedFallback = false;

	// Check if Memory Agent is enabled for this session
	const memoryAgentEnabled = isMemoryAgentEnabled(session.id);

	// Validate OPENROUTER_API_KEY is present and feature flag is enabled
	if (!memoryAgentEnabled) {
		console.log(
			"[Memory Agent] Feature flag disabled for session, using heuristic fallback",
			{ sessionId: session.id },
		);
		usedFallback = true;
		const heuristicResult = analyzeMemoryNeedHeuristic(input.content, history);
		memoryDecision = {
			shouldRetrieve: heuristicResult.shouldRetrieve,
			triggers: heuristicResult.triggers,
			entities: heuristicResult.entities.map((name) => ({
				name,
				type: "unknown",
			})),
			confidence: heuristicResult.confidence,
		};
	} else if (!process.env.OPENROUTER_API_KEY) {
		console.warn(
			"[Memory Agent] OPENROUTER_API_KEY not found in .env, using heuristic fallback",
		);
		usedFallback = true;
		const heuristicResult = analyzeMemoryNeedHeuristic(input.content, history);
		memoryDecision = {
			shouldRetrieve: heuristicResult.shouldRetrieve,
			triggers: heuristicResult.triggers,
			entities: heuristicResult.entities.map((name) => ({
				name,
				type: "unknown",
			})),
			confidence: heuristicResult.confidence,
		};
	} else {
		try {
			const agentDecision = await analyzeMemoryNeedAgent(
				input.content,
				history,
				{ timeoutMs: 3000, sessionId: session.id },
			);
			memoryDecision = {
				shouldRetrieve: agentDecision.shouldRetrieve,
				queries: agentDecision.queries,
				entities: agentDecision.entities,
				confidence: agentDecision.confidence,
				reason: agentDecision.reason,
			};
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : String(err);
			const isTimeout =
				errorMessage.includes("abort") || errorMessage.includes("timeout");

			console.warn(
				`[Memory Agent] ${isTimeout ? "Timeout" : "Error"}, using heuristic fallback:`,
				{
					error: errorMessage,
					sessionId: session.id,
					input: input.content.slice(0, 50),
				},
			);

			usedFallback = true;
			const heuristicResult = analyzeMemoryNeedHeuristic(
				input.content,
				history,
			);
			memoryDecision = {
				shouldRetrieve: heuristicResult.shouldRetrieve,
				triggers: heuristicResult.triggers,
				entities: heuristicResult.entities.map((name) => ({
					name,
					type: "unknown",
				})),
				confidence: heuristicResult.confidence,
			};
		}
	}

	const decideCtx: DecideContext = { history };

	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			const encoder = new TextEncoder();
			const send = (obj: unknown) =>
				controller.enqueue(encoder.encode(sseChunk(obj)));

			// Send Memory Agent decision event
			if (memoryDecision.queries && memoryDecision.queries.length > 0) {
				// Memory Agent was used
				console.log("[SSE] Sending memory_agent_decision", {
					usedFallback,
					queriesCount: memoryDecision.queries.length,
					entitiesCount: memoryDecision.entities?.length ?? 0,
				});
				send({
					type: "memory_agent_decision",
					payload: {
						shouldRetrieve: memoryDecision.shouldRetrieve,
						confidence: memoryDecision.confidence ?? 0,
						queriesCount: memoryDecision.queries.length,
						entitiesCount: memoryDecision.entities?.length ?? 0,
						reason: memoryDecision.reason,
						usedFallback,
					},
				});
			} else if (usedFallback) {
				// Fallback to heuristic was used
				console.log("[SSE] Sending memory_agent_decision (fallback)", {
					usedFallback: true,
					triggersCount: memoryDecision.triggers?.length ?? 0,
				});
				send({
					type: "memory_agent_decision",
					payload: {
						shouldRetrieve: memoryDecision.shouldRetrieve,
						confidence: memoryDecision.confidence ?? 0,
						queriesCount: 0,
						entitiesCount: memoryDecision.entities?.length ?? 0,
						usedFallback: true,
					},
				});
			}

			// Memory retrieval (parallel with Rules/Character agents)
			let memoryRetrievalPromise: Promise<{
				memories: import("@/db/schema").MemoryEntryData[];
				retrievalTimeMs: number;
				queriesUsed: number;
			} | null> | null = null;

			if (memoryDecision.shouldRetrieve) {
				// Start memory retrieval in parallel
				// Use multi-query search if queries are available from Memory Agent
				const queries =
					memoryDecision.queries && memoryDecision.queries.length > 0
						? memoryDecision.queries
						: [input.content];

				memoryRetrievalPromise = (async () => {
					const startTime = Date.now();
					try {
						// Execute vector search for each query
						const allResults = await Promise.all(
							queries.map((query) =>
								retrieveMemories(session.id, query, {
									limit: 3, // Lower limit per query since we're combining
									similarityThreshold: 0.7,
									timeoutMs: 2000,
								}).catch((err) => {
									console.error("[Memory] Query retrieval error:", err);
									return { memories: [], retrievalTimeMs: 0, query };
								}),
							),
						);

						// Extract memory arrays from results
						const memorySets = allResults.map((result) => result.memories);

						// Merge, deduplicate, and limit results using utility
						const limitedMemories = mergeMemoryResults(memorySets, 10);

						const retrievalTimeMs = Date.now() - startTime;

						return {
							memories: limitedMemories,
							retrievalTimeMs,
							queriesUsed: queries.length,
						};
					} catch (err) {
						console.error("[Memory] Multi-query retrieval error:", err);
						return null;
					}
				})();

				// Send SSE event for UI
				console.log("[SSE] Sending memory_status: triggered=true");
				send({
					type: "memory_status",
					payload: {
						triggered: true,
						triggers: memoryDecision.triggers,
						entities: memoryDecision.entities?.map((e) => e.name) ?? [],
						confidence: memoryDecision.confidence,
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

			if (rules.requiresCheck && rules.type === "skill" && rules.dc && isDiceChecksEnabled(session.id)) {
				// Step 2: Character modifiers
				await getOrCreateCharacter(session.id, input.profile);
				const modifiers = await computeSkillModifiers(session.id, rules.skill);
				// Step 3: Roll and compute outcome
				const roll = rollD20();
				rollResult = applyModifiers(roll, modifiers, rules.dc);
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
			const characterProfile = await getEnhancedCharacterProfile(session.id);

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
							"queries=",
							memoryResult.queriesUsed,
						);
						send({
							type: "memory_retrieved",
							payload: {
								count: memoryResult.memories.length,
								retrievalTimeMs: memoryResult.retrievalTimeMs,
								queriesUsed: memoryResult.queriesUsed,
							},
						});
					}
				} catch (err) {
					console.error("[Memory] Failed to retrieve memories:", err);
					// Continue without memories
				}
			}

			// Step 4.6: Build narrative context with knowledge graph
			// Extract entity names from Memory Agent decision
			const mentionedEntities =
				memoryDecision.entities?.map((e) => e.name) ?? [];

			// Check feature flags for knowledge graph features
			const worldKnowledgeEnabled = isWorldKnowledgeEnabled(session.id);
			const playerKnowledgeEnabled = isPlayerKnowledgeEnabled(session.id);

			// Build comprehensive narrative context
			// This loads world knowledge (objective facts) and player knowledge (what PC knows)
			// Knowledge loading is optional and backward compatible
			const narrativeContext = await buildNarrativeContext(
				session.id,
				input.content,
				history,
				retrievedMemories,
				mentionedEntities.length > 0 ? mentionedEntities : undefined,
				characterProfile as CharacterProfile | null,
				{
					loadWorldKnowledge: worldKnowledgeEnabled,
					loadPlayerKnowledge: playerKnowledgeEnabled,
					maxWorldEntities: 20,
					maxWorldDepth: 1,
				},
			);

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
					narrativeContext.worldKnowledge,
					narrativeContext.playerKnowledge,
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
			Promise.resolve()
				.then(async () => {
					const extraction = extractMemoryFromTurn(
						input.content,
						final.text,
						turnNumber,
					);
					if (extraction.shouldStore) {
						await storeMemory(session.id, turn.id, turnNumber, extraction);
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

			// Step 8: World Knowledge Update (with SSE event)
			// Extract and persist world entities and relationships from this turn
			// Run with timeout to avoid blocking response
			const worldKnowledgePromise = (async () => {
				try {
					// Check if World Knowledge is enabled for this session
					if (!isWorldKnowledgeEnabled(session.id)) {
						console.log(
							"[World Knowledge] Feature flag disabled for session, skipping update",
							{ sessionId: session.id },
						);
						return null;
					}

					// Validate environment variables
					if (!process.env.OPENROUTER_API_KEY || !process.env.DATABASE_URL) {
						console.warn(
							"[World Knowledge] Missing environment variables, skipping update",
						);
						return null;
					}

					// Extract world knowledge from turn
					const update = await updateWorldKnowledge(
						session.id,
						turnNumber,
						input.content,
						final.text,
						{ timeoutMs: 3000 }, // Shorter timeout for SSE
					);

					// Persist to database if any entities or relationships were extracted
					if (update.entities.length > 0 || update.relationships.length > 0) {
						const persistResult = await persistWorldKnowledge(
							session.id,
							update,
						);

						// Calculate entity type distribution
						const entityTypes: Record<string, number> = {};
						for (const entity of update.entities) {
							entityTypes[entity.type] = (entityTypes[entity.type] || 0) + 1;
						}

						// Log the update with metrics
						logWorldKnowledgeUpdate(
							session.id,
							turnNumber,
							update.extractionTimeMs,
							update.entities.length,
							update.relationships.length,
							persistResult.entitiesCreated,
							persistResult.entitiesUpdated,
							persistResult.relationshipsCreated,
							entityTypes,
							persistResult.errors.length === 0,
							persistResult.errors.length,
							persistResult.errors.length > 0
								? persistResult.errors
								: undefined,
						);

						return {
							entitiesCreated: persistResult.entitiesCreated,
							entitiesUpdated: persistResult.entitiesUpdated,
							relationshipsCreated: persistResult.relationshipsCreated,
							extractionTimeMs: update.extractionTimeMs,
						};
					}

					// Log empty update
					logWorldKnowledgeUpdate(
						session.id,
						turnNumber,
						update.extractionTimeMs,
						0,
						0,
						0,
						0,
						0,
						{},
						true,
						0,
					);
					return null;
				} catch (err) {
					// Log failed update
					logWorldKnowledgeUpdate(
						session.id,
						turnNumber,
						0,
						0,
						0,
						0,
						0,
						0,
						{},
						false,
						1,
						[err instanceof Error ? err.message : String(err)],
					);
					console.error("[World Knowledge] Update failed:", err);
					return null;
				}
			})();

			// Wait for world knowledge update with timeout
			const worldKnowledgeResult = await Promise.race([
				worldKnowledgePromise,
				new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
			]);

			// Send SSE event if world knowledge was updated
			if (worldKnowledgeResult) {
				console.log("[SSE] Sending world_knowledge_update", {
					entitiesCreated: worldKnowledgeResult.entitiesCreated,
					entitiesUpdated: worldKnowledgeResult.entitiesUpdated,
					relationshipsCreated: worldKnowledgeResult.relationshipsCreated,
					turnNumber,
				});
				send({
					type: "world_knowledge_update",
					payload: {
						entitiesCreated: worldKnowledgeResult.entitiesCreated,
						entitiesUpdated: worldKnowledgeResult.entitiesUpdated,
						relationshipsCreated: worldKnowledgeResult.relationshipsCreated,
						turnNumber,
						extractionTimeMs: worldKnowledgeResult.extractionTimeMs,
					},
				});
			}

			// Step 9: Player Knowledge Update (with SSE event)
			// Track what the player character learned from this turn
			// Run with timeout to avoid blocking response
			const playerKnowledgePromise = (async () => {
				try {
					// Check if Player Knowledge is enabled for this session
					if (!isPlayerKnowledgeEnabled(session.id)) {
						console.log(
							"[Player Knowledge] Feature flag disabled for session, skipping update",
							{ sessionId: session.id },
						);
						return null;
					}

					// Validate environment variables
					if (!process.env.OPENROUTER_API_KEY || !process.env.DATABASE_URL) {
						console.warn(
							"[Player Knowledge] Missing environment variables, skipping update",
						);
						return null;
					}

					// Extract player knowledge from turn
					const update = await updatePlayerKnowledge(
						session.id,
						turnNumber,
						input.content,
						final.text,
						{ timeoutMs: 3000 }, // Shorter timeout for SSE
					);

					// Persist to database if any knowledge updates were extracted
					if (update.updates.length > 0) {
						const persistResult = await persistPlayerKnowledge(
							session.id,
							turnNumber,
							update,
						);

						// Calculate awareness level distribution
						const awarenessLevels: Record<string, number> = {};
						for (const knowledgeData of update.updates) {
							awarenessLevels[knowledgeData.awarenessLevel] =
								(awarenessLevels[knowledgeData.awarenessLevel] || 0) + 1;
						}

						// Calculate knowledge source distribution
						const knowledgeSources: Record<string, number> = {};
						for (const knowledgeData of update.updates) {
							for (const fact of knowledgeData.newFacts) {
								knowledgeSources[fact.source] =
									(knowledgeSources[fact.source] || 0) + 1;
							}
						}

						// Log the update with metrics
						logPlayerKnowledgeUpdate(
							session.id,
							turnNumber,
							update.extractionTimeMs,
							update.updates.length,
							persistResult.knowledgeCreated,
							persistResult.knowledgeUpdated,
							persistResult.factsAdded,
							awarenessLevels,
							knowledgeSources,
							persistResult.errors.length === 0,
							persistResult.errors.length,
							persistResult.errors.length > 0
								? persistResult.errors
								: undefined,
						);

						return {
							entitiesLearned: persistResult.knowledgeCreated,
							factsLearned: persistResult.factsAdded,
							awarenessChanges: persistResult.knowledgeUpdated,
							extractionTimeMs: update.extractionTimeMs,
						};
					}

					// Log empty update
					logPlayerKnowledgeUpdate(
						session.id,
						turnNumber,
						update.extractionTimeMs,
						0,
						0,
						0,
						0,
						{},
						{},
						true,
						0,
					);
					return null;
				} catch (err) {
					// Log failed update
					logPlayerKnowledgeUpdate(
						session.id,
						turnNumber,
						0,
						0,
						0,
						0,
						0,
						{},
						{},
						false,
						1,
						[err instanceof Error ? err.message : String(err)],
					);
					console.error("[Player Knowledge] Update failed:", err);
					return null;
				}
			})();

			// Wait for player knowledge update with timeout
			const playerKnowledgeResult = await Promise.race([
				playerKnowledgePromise,
				new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
			]);

			// Send SSE event if player knowledge was updated
			if (playerKnowledgeResult) {
				console.log("[SSE] Sending player_knowledge_update", {
					entitiesLearned: playerKnowledgeResult.entitiesLearned,
					factsLearned: playerKnowledgeResult.factsLearned,
					awarenessChanges: playerKnowledgeResult.awarenessChanges,
					turnNumber,
				});
				send({
					type: "player_knowledge_update",
					payload: {
						entitiesLearned: playerKnowledgeResult.entitiesLearned,
						factsLearned: playerKnowledgeResult.factsLearned,
						awarenessChanges: playerKnowledgeResult.awarenessChanges,
						turnNumber,
						extractionTimeMs: playerKnowledgeResult.extractionTimeMs,
					},
				});
			}

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
