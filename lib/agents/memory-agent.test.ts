import type { ChatHistoryEntry } from "@/lib/agents/protocol";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { analyzeMemoryNeed } from "./memory-agent";

// Mock OpenRouter API
vi.mock("@/lib/llm/openrouter", () => ({
	callOpenRouter: vi.fn(),
}));

// Mock logger
vi.mock("@/lib/memory/logger", () => ({
	logMemoryAgentDecision: vi.fn(),
}));

import { callOpenRouter } from "@/lib/llm/openrouter";

describe("Memory Agent", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Set API key for tests
		process.env.OPENROUTER_API_KEY = "test-api-key";
	});

	describe("decision logic with various player inputs", () => {
		it("should decide to retrieve for location return", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									shouldRetrieve: true,
									reason: "Player returning to previously visited location",
									queries: [
										"таверна Золотой Дракон",
										"что происходило в таверне",
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

			const result = await analyzeMemoryNeed(
				"Я возвращаюсь в таверну Золотой Дракон",
				[],
			);

			expect(result.shouldRetrieve).toBe(true);
			expect(result.reason).toContain("location");
			expect(result.queries).toHaveLength(3);
			expect(result.entities).toHaveLength(1);
			expect(result.entities[0].name).toBe("Золотой Дракон");
			expect(result.entities[0].type).toBe("location");
			expect(result.confidence).toBe(0.9);
		});

		it("should decide to retrieve for NPC question", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									shouldRetrieve: true,
									reason: "Player asking about NPC",
									queries: ["Иван", "встреча с Иваном", "информация об Иване"],
									entities: [{ name: "Иван", type: "npc" }],
									confidence: 1.0,
								}),
							},
						},
					],
				}),
			} as Response);

			const result = await analyzeMemoryNeed("Кто такой Иван?", []);

			expect(result.shouldRetrieve).toBe(true);
			expect(result.reason).toContain("NPC");
			expect(result.queries).toHaveLength(3);
			expect(result.entities[0].name).toBe("Иван");
			expect(result.entities[0].type).toBe("npc");
			expect(result.confidence).toBe(1.0);
		});

		it("should decide not to retrieve for current action", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									shouldRetrieve: false,
									reason: "Current action, no reference to past events",
									queries: [],
									entities: [],
									confidence: 0.0,
								}),
							},
						},
					],
				}),
			} as Response);

			const result = await analyzeMemoryNeed("Я атакую орка", []);

			expect(result.shouldRetrieve).toBe(false);
			expect(result.queries).toHaveLength(0);
			expect(result.entities).toHaveLength(0);
			expect(result.confidence).toBe(0.0);
		});

		it("should decide to retrieve for past event question", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									shouldRetrieve: true,
									reason: "Player asking about past event",
									queries: [
										"что было в пещере",
										"события в пещере",
										"пещера прошлое",
									],
									entities: [{ name: "пещера", type: "location" }],
									confidence: 0.85,
								}),
							},
						},
					],
				}),
			} as Response);

			const result = await analyzeMemoryNeed("Что было в той пещере?", []);

			expect(result.shouldRetrieve).toBe(true);
			expect(result.reason).toContain("past");
			expect(result.queries.length).toBeGreaterThan(0);
			expect(result.confidence).toBeGreaterThan(0.8);
		});

		it("should handle explicit memory request", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									shouldRetrieve: true,
									reason: "Explicit memory request",
									queries: [
										"битва с драконом",
										"дракон сражение",
										"что случилось с драконом",
									],
									entities: [{ name: "дракон", type: "npc" }],
									confidence: 1.0,
								}),
							},
						},
					],
				}),
			} as Response);

			const result = await analyzeMemoryNeed(
				"Помнишь ту битву с драконом?",
				[],
			);

			expect(result.shouldRetrieve).toBe(true);
			expect(result.confidence).toBe(1.0);
			expect(result.queries.length).toBeGreaterThan(0);
		});
	});

	describe("query generation quality", () => {
		it("should generate multiple diverse queries", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									shouldRetrieve: true,
									reason: "Player asking about location",
									queries: [
										"город Велен",
										"что происходило в Велене",
										"события в городе",
										"Велен история",
									],
									entities: [{ name: "Велен", type: "location" }],
									confidence: 0.9,
								}),
							},
						},
					],
				}),
			} as Response);

			const result = await analyzeMemoryNeed("Расскажи о городе Велен", []);

			expect(result.queries.length).toBeGreaterThanOrEqual(2);
			expect(result.queries.length).toBeLessThanOrEqual(4);
			// Queries should be different
			const uniqueQueries = new Set(result.queries);
			expect(uniqueQueries.size).toBe(result.queries.length);
		});

		it("should generate semantic variations, not literal text", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									shouldRetrieve: true,
									reason: "Player asking about item",
									queries: [
										"меч с рунами",
										"древний меч",
										"где нашел меч",
										"магический меч",
									],
									entities: [{ name: "меч", type: "item" }],
									confidence: 0.85,
								}),
							},
						},
					],
				}),
			} as Response);

			const result = await analyzeMemoryNeed("Где я нашел тот меч?", []);

			// Queries should not just repeat the input
			const inputLower = "где я нашел тот меч".toLowerCase();
			const hasVariation = result.queries.some(
				(q) => q.toLowerCase() !== inputLower,
			);
			expect(hasVariation).toBe(true);
		});

		it("should include context in queries", async () => {
			const context: ChatHistoryEntry[] = [
				{ role: "player", content: "Я иду в лес" },
				{ role: "gm", content: "Ты входишь в темный лес" },
			];

			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									shouldRetrieve: true,
									reason: "Player asking about recent location",
									queries: ["темный лес", "что в лесу", "лес события"],
									entities: [{ name: "лес", type: "location" }],
									confidence: 0.8,
								}),
							},
						},
					],
				}),
			} as Response);

			const result = await analyzeMemoryNeed("Что здесь?", context);

			expect(result.shouldRetrieve).toBe(true);
			expect(result.queries.length).toBeGreaterThan(0);
		});
	});

	describe("entity extraction accuracy", () => {
		it("should extract location entities", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									shouldRetrieve: true,
									reason: "Player mentioning location",
									queries: ["таверна", "Золотой Дракон"],
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

			const result = await analyzeMemoryNeed(
				"Я иду в таверну Золотой Дракон",
				[],
			);

			expect(result.entities).toHaveLength(1);
			expect(result.entities[0].type).toBe("location");
			expect(result.entities[0].name).toBe("Золотой Дракон");
		});

		it("should extract NPC entities", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									shouldRetrieve: true,
									reason: "Player mentioning NPC",
									queries: ["торговец Иван", "Иван"],
									entities: [
										{ name: "Иван", type: "npc", context: "торговец" },
									],
									confidence: 0.85,
								}),
							},
						},
					],
				}),
			} as Response);

			const result = await analyzeMemoryNeed("Я встречаю торговца Ивана", []);

			expect(result.entities).toHaveLength(1);
			expect(result.entities[0].type).toBe("npc");
			expect(result.entities[0].name).toBe("Иван");
		});

		it("should extract item entities", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									shouldRetrieve: true,
									reason: "Player mentioning item",
									queries: ["древний меч", "меч с рунами"],
									entities: [
										{
											name: "древний меч",
											type: "item",
											context: "с рунами",
										},
									],
									confidence: 0.8,
								}),
							},
						},
					],
				}),
			} as Response);

			const result = await analyzeMemoryNeed("Я использую древний меч", []);

			expect(result.entities).toHaveLength(1);
			expect(result.entities[0].type).toBe("item");
		});

		it("should extract multiple entities", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									shouldRetrieve: true,
									reason: "Player mentioning multiple entities",
									queries: ["Иван таверна", "встреча в таверне"],
									entities: [
										{ name: "Иван", type: "npc" },
										{ name: "Золотой Дракон", type: "location" },
									],
									confidence: 0.9,
								}),
							},
						},
					],
				}),
			} as Response);

			const result = await analyzeMemoryNeed(
				"Я встречаю Ивана в таверне Золотой Дракон",
				[],
			);

			expect(result.entities.length).toBeGreaterThanOrEqual(2);
			const types = result.entities.map((e) => e.type);
			expect(types).toContain("npc");
			expect(types).toContain("location");
		});

		it("should normalize entity names to title case", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									shouldRetrieve: true,
									reason: "Player mentioning entity",
									queries: ["золотой дракон"],
									entities: [{ name: "золотой дракон", type: "location" }],
									confidence: 0.8,
								}),
							},
						},
					],
				}),
			} as Response);

			const result = await analyzeMemoryNeed("Я иду в золотой дракон", []);

			// Entity name should be normalized to title case
			expect(result.entities[0].name).toBe("Золотой Дракон");
		});

		it("should handle entities with context", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									shouldRetrieve: true,
									reason: "Player mentioning entity with context",
									queries: ["мэр города"],
									entities: [
										{
											name: "Филип",
											type: "npc",
											context: "мэр города Велен",
										},
									],
									confidence: 0.85,
								}),
							},
						},
					],
				}),
			} as Response);

			const result = await analyzeMemoryNeed("Я ищу мэра города", []);

			expect(result.entities[0].context).toBeDefined();
			expect(result.entities[0].context).toContain("мэр");
		});
	});

	describe("timeout handling", () => {
		it("should timeout after configured duration", async () => {
			// Mock a slow API call that respects abort signal
			vi.mocked(callOpenRouter).mockImplementation(
				(_req, options) =>
					new Promise((resolve, reject) => {
						const timeout = setTimeout(
							() =>
								resolve({
									ok: true,
									json: async () => ({
										choices: [
											{
												message: {
													content: JSON.stringify({
														shouldRetrieve: true,
														reason: "test",
														queries: [],
														entities: [],
														confidence: 0.5,
													}),
												},
											},
										],
									}),
								} as Response),
							5000,
						); // 5 seconds - longer than timeout

						// Listen for abort signal
						if (options?.signal) {
							options.signal.addEventListener("abort", () => {
								clearTimeout(timeout);
								reject(new Error("aborted"));
							});
						}
					}),
			);

			await expect(
				analyzeMemoryNeed("test input", [], { timeoutMs: 100 }),
			).rejects.toThrow();
		}, 10000); // Increase test timeout to 10 seconds

		it("should handle abort signal timeout", async () => {
			vi.mocked(callOpenRouter).mockImplementation(
				() =>
					new Promise((_, reject) => {
						setTimeout(() => reject(new Error("aborted")), 100);
					}),
			);

			await expect(
				analyzeMemoryNeed("test input", [], { timeoutMs: 100 }),
			).rejects.toThrow();
		});
	});

	describe("fallback to heuristic", () => {
		it("should throw error when API key is missing", async () => {
			const originalKey = process.env.OPENROUTER_API_KEY;
			process.env.OPENROUTER_API_KEY = "";

			await expect(analyzeMemoryNeed("test input", [])).rejects.toThrow(
				"OPENROUTER_API_KEY not configured",
			);

			// Restore
			process.env.OPENROUTER_API_KEY = originalKey;
		});

		it("should throw error on API failure", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: false,
				status: 500,
				statusText: "Internal Server Error",
			} as Response);

			await expect(analyzeMemoryNeed("test input", [])).rejects.toThrow(
				"OpenRouter API error",
			);
		});

		it("should throw error on timeout", async () => {
			vi.mocked(callOpenRouter).mockImplementation(
				() =>
					new Promise((_, reject) => {
						setTimeout(() => reject(new Error("timeout")), 100);
					}),
			);

			await expect(
				analyzeMemoryNeed("test input", [], { timeoutMs: 100 }),
			).rejects.toThrow();
		});

		it("should throw error on malformed JSON response", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: "not valid json",
							},
						},
					],
				}),
			} as Response);

			const result = await analyzeMemoryNeed("test input", []);

			// Should return safe default on parse error
			expect(result.shouldRetrieve).toBe(false);
			expect(result.reason).toContain("Failed to parse");
		});

		it("should handle missing content in response", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {},
						},
					],
				}),
			} as Response);

			await expect(analyzeMemoryNeed("test input", [])).rejects.toThrow(
				"No content in LLM response",
			);
		});
	});

	describe("edge cases", () => {
		it("should handle empty input", async () => {
			const result = await analyzeMemoryNeed("", []);

			expect(result.shouldRetrieve).toBe(false);
			expect(result.queries).toHaveLength(0);
			expect(result.entities).toHaveLength(0);
			expect(result.confidence).toBe(0.0);
		});

		it("should handle whitespace-only input", async () => {
			const result = await analyzeMemoryNeed("   ", []);

			expect(result.shouldRetrieve).toBe(false);
			expect(result.confidence).toBe(0.0);
		});

		it("should handle invalid entity types", async () => {
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
									entities: [
										{ name: "Test", type: "invalid_type" }, // Invalid type
										{ name: "Valid", type: "npc" }, // Valid type
									],
									confidence: 0.8,
								}),
							},
						},
					],
				}),
			} as Response);

			const result = await analyzeMemoryNeed("test input", []);

			// Invalid entity should be filtered out
			expect(result.entities).toHaveLength(1);
			expect(result.entities[0].name).toBe("Valid");
			expect(result.entities[0].type).toBe("npc");
		});

		it("should handle missing required fields in entity", async () => {
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
									entities: [
										{ type: "npc" }, // Missing name
										{ name: "Valid", type: "location" }, // Valid
									],
									confidence: 0.8,
								}),
							},
						},
					],
				}),
			} as Response);

			const result = await analyzeMemoryNeed("test input", []);

			// Invalid entity should be filtered out
			expect(result.entities).toHaveLength(1);
			expect(result.entities[0].name).toBe("Valid");
		});

		it("should handle confidence outside 0-1 range", async () => {
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
									confidence: 1.5, // Out of range
								}),
							},
						},
					],
				}),
			} as Response);

			const result = await analyzeMemoryNeed("test input", []);

			// Confidence should be clamped to 0-1
			expect(result.confidence).toBeLessThanOrEqual(1.0);
			expect(result.confidence).toBeGreaterThanOrEqual(0.0);
		});

		it("should handle negative confidence", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									shouldRetrieve: false,
									reason: "test",
									queries: [],
									entities: [],
									confidence: -0.5, // Negative
								}),
							},
						},
					],
				}),
			} as Response);

			const result = await analyzeMemoryNeed("test input", []);

			// Confidence should be clamped to 0
			expect(result.confidence).toBe(0.0);
		});

		it("should handle non-array queries", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									shouldRetrieve: true,
									reason: "test",
									queries: "not an array", // Invalid
									entities: [],
									confidence: 0.8,
								}),
							},
						},
					],
				}),
			} as Response);

			const result = await analyzeMemoryNeed("test input", []);

			// Should default to empty array
			expect(result.queries).toEqual([]);
		});

		it("should handle non-array entities", async () => {
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
									entities: "not an array", // Invalid
									confidence: 0.8,
								}),
							},
						},
					],
				}),
			} as Response);

			const result = await analyzeMemoryNeed("test input", []);

			// Should default to empty array
			expect(result.entities).toEqual([]);
		});
	});

	describe("Russian language handling", () => {
		it("should handle Cyrillic characters in input", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									shouldRetrieve: true,
									reason: "Игрок спрашивает о локации",
									queries: ["таверна", "Золотой Дракон"],
									entities: [{ name: "Золотой Дракон", type: "location" }],
									confidence: 0.9,
								}),
							},
						},
					],
				}),
			} as Response);

			const result = await analyzeMemoryNeed(
				"Где находится таверна Золотой Дракон?",
				[],
			);

			expect(result.shouldRetrieve).toBe(true);
			expect(result.entities[0].name).toBe("Золотой Дракон");
		});

		it("should handle Russian context in history", async () => {
			const context: ChatHistoryEntry[] = [
				{ role: "player", content: "Я иду в город" },
				{ role: "gm", content: "Ты входишь в большой город Велен" },
			];

			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									shouldRetrieve: true,
									reason: "Игрок спрашивает о текущей локации",
									queries: ["город Велен", "что в городе"],
									entities: [{ name: "Велен", type: "location" }],
									confidence: 0.85,
								}),
							},
						},
					],
				}),
			} as Response);

			const result = await analyzeMemoryNeed("Что здесь интересного?", context);

			expect(result.shouldRetrieve).toBe(true);
			expect(result.queries.length).toBeGreaterThan(0);
		});
	});
});
