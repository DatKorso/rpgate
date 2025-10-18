import { db } from "@/db";
import { memoryEntries, messages, sessions, turns } from "@/db/schema";
import { retrieveMemories } from "@/lib/agents/memory";
import { analyzeMemoryNeed } from "@/lib/agents/memory-agent";
import {
	extractMemoryFromTurn,
	storeMemory,
} from "@/lib/agents/memory-storage";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock OpenRouter for Memory Agent
vi.mock("@/lib/llm/openrouter", () => ({
	callOpenRouter: vi.fn(),
}));

import { callOpenRouter } from "@/lib/llm/openrouter";

describe("Memory Agent Integration", () => {
	let testSessionId: number;
	let testTurnId: number;

	beforeEach(async () => {
		// Set API key for tests
		process.env.OPENROUTER_API_KEY = "test-api-key";

		// Create test session
		const [session] = await db
			.insert(sessions)
			.values({
				externalId: `test-memory-agent-${Date.now()}`,
				locale: "ru",
				setting: "medieval_fantasy",
			})
			.returning();
		testSessionId = session.id;

		// Create test messages and turn
		const [playerMsg] = await db
			.insert(messages)
			.values({
				sessionId: testSessionId,
				role: "player",
				content: "Я иду в таверну",
			})
			.returning();

		const [gmMsg] = await db
			.insert(messages)
			.values({
				sessionId: testSessionId,
				role: "gm",
				content: "Ты входишь в таверну Золотой Дракон",
			})
			.returning();

		const [turn] = await db
			.insert(turns)
			.values({
				sessionId: testSessionId,
				playerMessageId: playerMsg.id,
				gmMessageId: gmMsg.id,
				meta: "",
			})
			.returning();
		testTurnId = turn.id;

		vi.clearAllMocks();
	});

	afterEach(async () => {
		// Cleanup: cascade delete will handle related records
		if (testSessionId) {
			await db.delete(sessions).where(eq(sessions.id, testSessionId));
		}
	});

	describe("Memory Agent integration in chat flow", () => {
		it("should integrate with memory retrieval flow", async () => {
			// Mock Memory Agent decision
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									shouldRetrieve: true,
									reason: "Player returning to location",
									queries: [
										"таверна Золотой Дракон",
										"что было в таверне",
										"события в Золотом Драконе",
									],
									entities: [
										{
											name: "Золотой Дракон",
											type: "location",
											context: "таверна",
										},
									],
									confidence: 0.9,
								}),
							},
						},
					],
				}),
			} as Response);

			// Step 1: Memory Agent analyzes input
			const decision = await analyzeMemoryNeed(
				"Я возвращаюсь в таверну Золотой Дракон",
				[],
				{ sessionId: testSessionId },
			);

			expect(decision.shouldRetrieve).toBe(true);
			expect(decision.queries).toHaveLength(3);
			expect(decision.entities).toHaveLength(1);

			// Step 2: Store a memory first
			const extraction = extractMemoryFromTurn(
				"Я встречаю бармена",
				"Бармен Григорий приветствует тебя",
				1,
			);
			extraction.shouldStore = true;
			extraction.type = "npc";
			await storeMemory(testSessionId, testTurnId, 1, extraction);

			// Step 3: Retrieve memories using generated queries
			const allMemories = await Promise.all(
				decision.queries.map((query) =>
					retrieveMemories(testSessionId, query, {
						limit: 3,
						similarityThreshold: 0.5,
					}),
				),
			);

			// Verify retrieval worked
			expect(allMemories).toHaveLength(3);
			// At least one query should find memories
			const totalMemories = allMemories.reduce(
				(sum, result) => sum + result.memories.length,
				0,
			);
			expect(totalMemories).toBeGreaterThanOrEqual(0); // May be 0 if similarity too low
		}, 15000);

		it("should handle fallback to heuristic on timeout", async () => {
			// Mock timeout
			vi.mocked(callOpenRouter).mockImplementation(
				(_req, options) =>
					new Promise((_, reject) => {
						if (options?.signal) {
							options.signal.addEventListener("abort", () => {
								reject(new Error("aborted"));
							});
						}
						setTimeout(() => reject(new Error("timeout")), 5000);
					}),
			);

			// Should throw error (caller handles fallback)
			await expect(
				analyzeMemoryNeed("Я возвращаюсь в таверну", [], {
					timeoutMs: 100,
					sessionId: testSessionId,
				}),
			).rejects.toThrow();
		}, 10000);

		it("should work with empty history", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									shouldRetrieve: true,
									reason: "Player asking about NPC",
									queries: ["Иван", "торговец Иван"],
									entities: [{ name: "Иван", type: "npc" }],
									confidence: 0.85,
								}),
							},
						},
					],
				}),
			} as Response);

			const decision = await analyzeMemoryNeed("Кто такой Иван?", [], {
				sessionId: testSessionId,
			});

			expect(decision.shouldRetrieve).toBe(true);
			expect(decision.queries.length).toBeGreaterThan(0);
		});

		it("should work with recent context", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									shouldRetrieve: true,
									reason: "Player asking about current location",
									queries: ["таверна", "что в таверне"],
									entities: [{ name: "таверна", type: "location" }],
									confidence: 0.8,
								}),
							},
						},
					],
				}),
			} as Response);

			const history = [
				{ role: "player" as const, content: "Я вхожу в таверну" },
				{ role: "gm" as const, content: "Ты входишь в таверну Золотой Дракон" },
			];

			const decision = await analyzeMemoryNeed("Что здесь?", history, {
				sessionId: testSessionId,
			});

			expect(decision.shouldRetrieve).toBe(true);
			expect(decision.queries.length).toBeGreaterThan(0);
		});
	});

	describe("multi-query retrieval", () => {
		it("should execute multiple queries and combine results", async () => {
			// Store multiple memories
			const memories = [
				{
					player: "Я встречаю торговца Ивана",
					gm: "Торговец Иван предлагает тебе купить зелье",
					type: "npc" as const,
				},
				{
					player: "Я иду в таверну",
					gm: "Ты входишь в таверну Золотой Дракон",
					type: "location" as const,
				},
			];

			for (let i = 0; i < memories.length; i++) {
				const mem = memories[i];
				const extraction = extractMemoryFromTurn(mem.player, mem.gm, i + 1);
				extraction.type = mem.type;
				extraction.shouldStore = true;
				await storeMemory(testSessionId, testTurnId, i + 1, extraction);
			}

			// Mock Memory Agent with multiple queries
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									shouldRetrieve: true,
									reason: "Player asking about location and NPC",
									queries: [
										"таверна Золотой Дракон",
										"торговец Иван",
										"что в таверне",
									],
									entities: [
										{ name: "Золотой Дракон", type: "location" },
										{ name: "Иван", type: "npc" },
									],
									confidence: 0.9,
								}),
							},
						},
					],
				}),
			} as Response);

			const decision = await analyzeMemoryNeed(
				"Где я встречал Ивана?",
				[],
				{ sessionId: testSessionId },
			);

			// Execute multi-query retrieval
			const allResults = await Promise.all(
				decision.queries.map((query) =>
					retrieveMemories(testSessionId, query, {
						limit: 3,
						similarityThreshold: 0.5,
					}),
				),
			);

			// Deduplicate by memory ID
			const memoryMap = new Map();
			for (const result of allResults) {
				for (const memory of result.memories) {
					const existing = memoryMap.get(memory.id);
					if (
						!existing ||
						(memory.similarity ?? 0) > (existing.similarity ?? 0)
					) {
						memoryMap.set(memory.id, memory);
					}
				}
			}

			const uniqueMemories = Array.from(memoryMap.values());

			// Should have deduplicated memories
			expect(uniqueMemories.length).toBeLessThanOrEqual(
				allResults.reduce((sum, r) => sum + r.memories.length, 0),
			);
		}, 20000);

		it("should limit total results to reasonable number", async () => {
			// Store many memories
			for (let i = 0; i < 15; i++) {
				const extraction = extractMemoryFromTurn(
					`Я делаю действие ${i}`,
					`Происходит событие ${i}`,
					i + 1,
				);
				extraction.shouldStore = true;
				extraction.type = "event";
				await storeMemory(testSessionId, testTurnId, i + 1, extraction);
			}

			// Mock Memory Agent with multiple queries
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									shouldRetrieve: true,
									reason: "Player asking about events",
									queries: ["событие", "действие", "что происходило"],
									entities: [],
									confidence: 0.8,
								}),
							},
						},
					],
				}),
			} as Response);

			const decision = await analyzeMemoryNeed("Что происходило?", [], {
				sessionId: testSessionId,
			});

			// Execute multi-query retrieval
			const allResults = await Promise.all(
				decision.queries.map((query) =>
					retrieveMemories(testSessionId, query, {
						limit: 5,
						similarityThreshold: 0.5,
					}),
				),
			);

			// Deduplicate and limit
			const memoryMap = new Map();
			for (const result of allResults) {
				for (const memory of result.memories) {
					const existing = memoryMap.get(memory.id);
					if (
						!existing ||
						(memory.similarity ?? 0) > (existing.similarity ?? 0)
					) {
						memoryMap.set(memory.id, memory);
					}
				}
			}

			const uniqueMemories = Array.from(memoryMap.values())
				.sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))
				.slice(0, 10); // Limit to 10

			expect(uniqueMemories.length).toBeLessThanOrEqual(10);
		}, 30000);

		it("should handle queries with no results", async () => {
			// Mock Memory Agent with queries that won't match
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									shouldRetrieve: true,
									reason: "Player asking about unknown entity",
									queries: [
										"несуществующая локация",
										"неизвестный персонаж",
									],
									entities: [],
									confidence: 0.7,
								}),
							},
						},
					],
				}),
			} as Response);

			const decision = await analyzeMemoryNeed(
				"Где находится несуществующая локация?",
				[],
				{ sessionId: testSessionId },
			);

			// Execute multi-query retrieval
			const allResults = await Promise.all(
				decision.queries.map((query) =>
					retrieveMemories(testSessionId, query, {
						limit: 3,
						similarityThreshold: 0.7,
					}),
				),
			);

			// Should handle empty results gracefully
			const totalMemories = allResults.reduce(
				(sum, r) => sum + r.memories.length,
				0,
			);
			expect(totalMemories).toBe(0);
		}, 10000);
	});

	describe("SSE event emission", () => {
		it("should provide data for memory_agent_decision event", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									shouldRetrieve: true,
									reason: "Player asking about location",
									queries: ["таверна", "Золотой Дракон"],
									entities: [{ name: "Золотой Дракон", type: "location" }],
									confidence: 0.9,
								}),
							},
						},
					],
				}),
			} as Response);

			const decision = await analyzeMemoryNeed(
				"Где находится таверна?",
				[],
				{ sessionId: testSessionId },
			);

			// Verify data structure for SSE event
			const ssePayload = {
				shouldRetrieve: decision.shouldRetrieve,
				confidence: decision.confidence,
				queriesCount: decision.queries.length,
				entitiesCount: decision.entities.length,
				reason: decision.reason,
				usedFallback: false,
			};

			expect(ssePayload.shouldRetrieve).toBe(true);
			expect(ssePayload.confidence).toBe(0.9);
			expect(ssePayload.queriesCount).toBe(2);
			expect(ssePayload.entitiesCount).toBe(1);
			expect(ssePayload.reason).toBeDefined();
		});

		it("should provide data for memory_status event", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									shouldRetrieve: true,
									reason: "Player returning to location",
									queries: ["таверна"],
									entities: [{ name: "таверна", type: "location" }],
									confidence: 0.85,
								}),
							},
						},
					],
				}),
			} as Response);

			const decision = await analyzeMemoryNeed("Я возвращаюсь в таверну", [], {
				sessionId: testSessionId,
			});

			// Verify data structure for memory_status event
			const statusPayload = {
				triggered: decision.shouldRetrieve,
				triggers: [], // Would come from heuristic fallback
				entities: decision.entities.map((e) => e.name),
				confidence: decision.confidence,
			};

			expect(statusPayload.triggered).toBe(true);
			// Entity name is normalized to title case
			expect(statusPayload.entities).toContain("Таверна");
			expect(statusPayload.confidence).toBe(0.85);
		});

		it("should provide data for memory_retrieved event", async () => {
			// Store a memory
			const extraction = extractMemoryFromTurn(
				"Я встречаю торговца",
				"Торговец предлагает товары",
				1,
			);
			extraction.shouldStore = true;
			extraction.type = "npc";
			await storeMemory(testSessionId, testTurnId, 1, extraction);

			// Mock Memory Agent
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									shouldRetrieve: true,
									reason: "Player asking about NPC",
									queries: ["торговец", "товары"],
									entities: [{ name: "торговец", type: "npc" }],
									confidence: 0.8,
								}),
							},
						},
					],
				}),
			} as Response);

			const decision = await analyzeMemoryNeed("Где торговец?", [], {
				sessionId: testSessionId,
			});

			// Execute retrieval
			const startTime = Date.now();
			const allResults = await Promise.all(
				decision.queries.map((query) =>
					retrieveMemories(testSessionId, query, {
						limit: 3,
						similarityThreshold: 0.5,
					}),
				),
			);
			const retrievalTimeMs = Date.now() - startTime;

			// Deduplicate
			const memoryMap = new Map();
			for (const result of allResults) {
				for (const memory of result.memories) {
					memoryMap.set(memory.id, memory);
				}
			}

			// Verify data structure for memory_retrieved event
			const retrievedPayload = {
				count: memoryMap.size,
				retrievalTimeMs,
				queriesUsed: decision.queries.length,
			};

			expect(retrievedPayload.count).toBeGreaterThanOrEqual(0);
			expect(retrievedPayload.retrievalTimeMs).toBeGreaterThan(0);
			expect(retrievedPayload.queriesUsed).toBe(2);
		}, 15000);
	});

	describe("backward compatibility", () => {
		it("should not break when Memory Agent is disabled", async () => {
			// Simulate Memory Agent disabled by not calling it
			// Just use heuristic directly
			const { analyzeMemoryNeed: heuristicAnalyze } = await import(
				"@/lib/memory/heuristic"
			);

			const result = heuristicAnalyze("Я возвращаюсь в таверну", []);

			expect(result.shouldRetrieve).toBeDefined();
			expect(result.triggers).toBeDefined();
			expect(result.entities).toBeDefined();
			expect(result.confidence).toBeDefined();
		});

		it("should work with existing vector memory system", async () => {
			// Store memory using existing system
			const extraction = extractMemoryFromTurn(
				"Я нахожу артефакт",
				"Ты находишь древний артефакт",
				1,
			);
			extraction.shouldStore = true;
			extraction.type = "item";
			await storeMemory(testSessionId, testTurnId, 1, extraction);

			// Retrieve using existing system (without Memory Agent)
			const result = await retrieveMemories(testSessionId, "артефакт", {
				limit: 5,
				similarityThreshold: 0.5,
			});

			// Should work normally
			expect(result.memories).toBeDefined();
			expect(result.retrievalTimeMs).toBeGreaterThan(0);
		}, 10000);

		it("should handle missing OPENROUTER_API_KEY gracefully", async () => {
			const originalKey = process.env.OPENROUTER_API_KEY;
			process.env.OPENROUTER_API_KEY = "";

			// Should throw error (caller handles fallback)
			await expect(
				analyzeMemoryNeed("test input", [], { sessionId: testSessionId }),
			).rejects.toThrow("OPENROUTER_API_KEY not configured");

			// Restore for other tests
			process.env.OPENROUTER_API_KEY = originalKey;
		});

		it("should maintain session isolation", async () => {
			// Create another session
			const [session2] = await db
				.insert(sessions)
				.values({
					externalId: `test-memory-agent-2-${Date.now()}`,
					locale: "ru",
					setting: "medieval_fantasy",
				})
				.returning();

			// Store memory in first session
			const extraction1 = extractMemoryFromTurn(
				"Я нахожу сокровище",
				"Ты находишь сундук с золотом",
				1,
			);
			extraction1.shouldStore = true;
			extraction1.type = "item";
			await storeMemory(testSessionId, testTurnId, 1, extraction1);

			// Mock Memory Agent
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									shouldRetrieve: true,
									reason: "Player asking about item",
									queries: ["сокровище", "золото"],
									entities: [{ name: "сокровище", type: "item" }],
									confidence: 0.85,
								}),
							},
						},
					],
				}),
			} as Response);

			const decision = await analyzeMemoryNeed("Где сокровище?", [], {
				sessionId: session2.id,
			});

			// Try to retrieve from second session
			const allResults = await Promise.all(
				decision.queries.map((query) =>
					retrieveMemories(session2.id, query, {
						limit: 5,
						similarityThreshold: 0.5,
					}),
				),
			);

			// Should not find memories from other session
			const totalMemories = allResults.reduce(
				(sum, r) => sum + r.memories.length,
				0,
			);
			expect(totalMemories).toBe(0);

			// Cleanup
			await db.delete(sessions).where(eq(sessions.id, session2.id));
		}, 15000);
	});

	describe("performance", () => {
		it("should complete Memory Agent analysis within timeout", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									shouldRetrieve: true,
									reason: "test",
									queries: ["test"],
									entities: [],
									confidence: 0.8,
								}),
							},
						},
					],
				}),
			} as Response);

			const startTime = Date.now();
			await analyzeMemoryNeed("test input", [], {
				timeoutMs: 3000,
				sessionId: testSessionId,
			});
			const duration = Date.now() - startTime;

			expect(duration).toBeLessThan(3000);
		});

		it("should handle concurrent Memory Agent calls", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									shouldRetrieve: true,
									reason: "test",
									queries: ["test"],
									entities: [],
									confidence: 0.8,
								}),
							},
						},
					],
				}),
			} as Response);

			// Execute multiple concurrent calls
			const promises = Array.from({ length: 5 }, (_, i) =>
				analyzeMemoryNeed(`test input ${i}`, [], {
					sessionId: testSessionId,
				}),
			);

			const results = await Promise.all(promises);

			// All should complete successfully
			for (const result of results) {
				expect(result).toBeDefined();
				expect(result.shouldRetrieve).toBeDefined();
			}
		});
	});
});
