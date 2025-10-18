/**
 * Player Knowledge Updater Tests
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { updatePlayerKnowledge } from "./player-knowledge-updater";

// Mock OpenRouter API
vi.mock("@/lib/llm/openrouter", () => ({
	callOpenRouter: vi.fn(),
}));

import { callOpenRouter } from "@/lib/llm/openrouter";

describe("Player Knowledge Updater", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Set API key for tests
		process.env.OPENROUTER_API_KEY = "test-api-key";
	});

	describe("fact extraction", () => {
		it("should extract knowledge from direct observation", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									updates: [
										{
											entityName: "Велен",
											entityType: "location",
											awarenessLevel: "met",
											newFacts: [
												{
													property: "name",
													value: "Велен",
													source: "arrived",
													confidence: "certain",
												},
												{
													property: "type",
													value: "город",
													source: "observation",
													confidence: "certain",
												},
												{
													property: "size",
													value: "большой",
													source: "observation",
													confidence: "certain",
												},
											],
										},
									],
								}),
							},
						},
					],
				}),
			} as Response);

			const result = await updatePlayerKnowledge(
				1,
				12,
				"Я иду в город",
				"Ты входишь в большой город Велен",
			);

			expect(result.updates).toHaveLength(1);
			expect(result.updates[0].entityName).toBe("Велен");
			expect(result.updates[0].entityType).toBe("location");
			expect(result.updates[0].awarenessLevel).toBe("met");
			expect(result.updates[0].newFacts).toHaveLength(3);
			expect(result.updates[0].newFacts[0].source).toBe("arrived");
		});

		it("should extract knowledge from NPC dialogue", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									updates: [
										{
											entityName: "Филип Стенгер",
											entityType: "npc",
											awarenessLevel: "heard_of",
											newFacts: [
												{
													property: "name",
													value: "Филип Стенгер",
													source: "heard_from_npc",
													confidence: "certain",
												},
												{
													property: "occupation",
													value: "мэр",
													source: "heard_from_npc",
													confidence: "certain",
												},
											],
										},
									],
								}),
							},
						},
					],
				}),
			} as Response);

			const result = await updatePlayerKnowledge(
				1,
				15,
				"Кто управляет городом?",
				'Торговец говорит: "Филип Стенгер - наш мэр"',
			);

			expect(result.updates).toHaveLength(1);
			expect(result.updates[0].awarenessLevel).toBe("heard_of");
			expect(result.updates[0].newFacts[0].source).toBe("heard_from_npc");
		});

		it("should extract knowledge from reading", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									updates: [
										{
											entityName: "Битва у Велена",
											entityType: "event",
											awarenessLevel: "heard_of",
											newFacts: [
												{
													property: "date",
													value: "3 дня назад",
													source: "read_in_book",
													confidence: "certain",
												},
												{
													property: "outcome",
													value: "победа армии",
													source: "read_in_book",
													confidence: "certain",
												},
											],
										},
									],
								}),
							},
						},
					],
				}),
			} as Response);

			const result = await updatePlayerKnowledge(
				1,
				20,
				"Я читаю книгу",
				"В книге написано о битве у Велена 3 дня назад. Армия победила",
			);

			expect(result.updates).toHaveLength(1);
			expect(result.updates[0].newFacts[0].source).toBe("read_in_book");
		});

		it("should extract knowledge from personal meeting", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									updates: [
										{
											entityName: "Иван",
											entityType: "npc",
											awarenessLevel: "met",
											newFacts: [
												{
													property: "name",
													value: "Иван",
													source: "met_personally",
													confidence: "certain",
												},
												{
													property: "appearance",
													value: "высокий мужчина",
													source: "observation",
													confidence: "certain",
												},
											],
										},
									],
								}),
							},
						},
					],
				}),
			} as Response);

			const result = await updatePlayerKnowledge(
				1,
				25,
				"Я встречаю незнакомца",
				'Высокий мужчина представляется: "Я Иван"',
			);

			expect(result.updates).toHaveLength(1);
			expect(result.updates[0].awarenessLevel).toBe("met");
			expect(result.updates[0].newFacts[0].source).toBe("met_personally");
		});

		it("should extract knowledge from item ownership", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									updates: [
										{
											entityName: "Древний Меч",
											entityType: "item",
											awarenessLevel: "familiar",
											newFacts: [
												{
													property: "name",
													value: "Древний Меч",
													source: "owns",
													confidence: "certain",
												},
												{
													property: "material",
													value: "сталь",
													source: "observation",
													confidence: "certain",
												},
												{
													property: "runes",
													value: "светящиеся руны",
													source: "observation",
													confidence: "certain",
												},
											],
										},
									],
								}),
							},
						},
					],
				}),
			} as Response);

			const result = await updatePlayerKnowledge(
				1,
				30,
				"Я беру меч",
				"Ты берешь древний меч из стали со светящимися рунами",
			);

			expect(result.updates).toHaveLength(1);
			expect(result.updates[0].awarenessLevel).toBe("familiar");
			expect(result.updates[0].newFacts[0].source).toBe("owns");
		});
	});

	describe("awareness level progression", () => {
		it("should set heard_of for entities mentioned by NPCs", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									updates: [
										{
											entityName: "Темный Лес",
											entityType: "location",
											awarenessLevel: "heard_of",
											newFacts: [
												{
													property: "name",
													value: "Темный Лес",
													source: "heard_from_npc",
													confidence: "certain",
												},
												{
													property: "danger",
													value: "опасное место",
													source: "heard_from_npc",
													confidence: "rumor",
												},
											],
										},
									],
								}),
							},
						},
					],
				}),
			} as Response);

			const result = await updatePlayerKnowledge(
				1,
				35,
				"Что там за лес?",
				'Торговец говорит: "Это Темный Лес, опасное место"',
			);

			expect(result.updates[0].awarenessLevel).toBe("heard_of");
		});

		it("should set met for entities PC encounters directly", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									updates: [
										{
											entityName: "Григорий",
											entityType: "npc",
											awarenessLevel: "met",
											newFacts: [
												{
													property: "name",
													value: "Григорий",
													source: "met_personally",
													confidence: "certain",
												},
											],
										},
									],
								}),
							},
						},
					],
				}),
			} as Response);

			const result = await updatePlayerKnowledge(
				1,
				40,
				"Я встречаю бармена",
				'Бармен представляется: "Я Григорий"',
			);

			expect(result.updates[0].awarenessLevel).toBe("met");
		});

		it("should set familiar for entities PC interacts with extensively", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									updates: [
										{
											entityName: "Магический Посох",
											entityType: "item",
											awarenessLevel: "familiar",
											newFacts: [
												{
													property: "power",
													value: "огненные заклинания",
													source: "used",
													confidence: "certain",
												},
											],
										},
									],
								}),
							},
						},
					],
				}),
			} as Response);

			const result = await updatePlayerKnowledge(
				1,
				45,
				"Я использую посох",
				"Ты используешь посох. Из него вырывается огонь",
			);

			expect(result.updates[0].awarenessLevel).toBe("familiar");
		});
	});

	describe("filtering non-learnable information", () => {
		it("should not include GM descriptions outside PC perception", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									updates: [],
								}),
							},
						},
					],
				}),
			} as Response);

			const result = await updatePlayerKnowledge(
				1,
				50,
				"Я ухожу",
				"Ты уходишь. За твоей спиной в тени прячется убийца",
			);

			// PC shouldn't learn about the assassin
			expect(result.updates).toHaveLength(0);
		});

		it("should not include other characters thoughts", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									updates: [
										{
											entityName: "Торговец",
											entityType: "npc",
											awarenessLevel: "met",
											newFacts: [
												{
													property: "appearance",
													value: "нервный",
													source: "observation",
													confidence: "certain",
												},
											],
										},
									],
								}),
							},
						},
					],
				}),
			} as Response);

			const result = await updatePlayerKnowledge(
				1,
				55,
				"Я разговариваю с торговцем",
				"Торговец выглядит нервным. Он думает о своих долгах",
			);

			// PC can observe nervousness but not read thoughts
			expect(result.updates[0].newFacts).toHaveLength(1);
			expect(result.updates[0].newFacts[0].property).toBe("appearance");
		});
	});

	describe("source attribution", () => {
		it("should correctly attribute sources", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									updates: [
										{
											entityName: "Велен",
											entityType: "location",
											awarenessLevel: "met",
											newFacts: [
												{
													property: "name",
													value: "Велен",
													source: "arrived",
													confidence: "certain",
												},
												{
													property: "population",
													value: "10000",
													source: "heard_from_npc",
													confidence: "likely",
												},
												{
													property: "history",
													value: "основан 200 лет назад",
													source: "read_in_book",
													confidence: "certain",
												},
											],
										},
									],
								}),
							},
						},
					],
				}),
			} as Response);

			const result = await updatePlayerKnowledge(
				1,
				60,
				"Я изучаю город",
				'Ты прибываешь в Велен. Торговец говорит: "Здесь живет 10000 человек". Ты читаешь табличку: "Основан 200 лет назад"',
			);

			const facts = result.updates[0].newFacts;
			expect(facts[0].source).toBe("arrived");
			expect(facts[1].source).toBe("heard_from_npc");
			expect(facts[2].source).toBe("read_in_book");
		});

		it("should handle confidence levels", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									updates: [
										{
											entityName: "Дракон",
											entityType: "npc",
											awarenessLevel: "heard_of",
											newFacts: [
												{
													property: "existence",
													value: "живет в горах",
													source: "heard_from_npc",
													confidence: "rumor",
												},
											],
										},
									],
								}),
							},
						},
					],
				}),
			} as Response);

			const result = await updatePlayerKnowledge(
				1,
				65,
				"Есть ли драконы?",
				'Пьяный говорит: "Говорят, в горах живет дракон"',
			);

			expect(result.updates[0].newFacts[0].confidence).toBe("rumor");
		});
	});

	describe("error handling", () => {
		it("should throw error when API key is missing", async () => {
			const originalKey = process.env.OPENROUTER_API_KEY;
			process.env.OPENROUTER_API_KEY = "";

			await expect(updatePlayerKnowledge(1, 1, "test", "test")).rejects.toThrow(
				"OPENROUTER_API_KEY not found",
			);

			process.env.OPENROUTER_API_KEY = originalKey;
		});

		it("should handle API errors gracefully", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: false,
				status: 500,
				statusText: "Internal Server Error",
			} as Response);

			const result = await updatePlayerKnowledge(1, 1, "test", "test");

			// Should return empty update on error
			expect(result.updates).toHaveLength(0);
			expect(result.extractionTimeMs).toBeGreaterThanOrEqual(0);
		});

		it("should handle timeout", async () => {
			vi.mocked(callOpenRouter).mockImplementation(
				(_req, options) =>
					new Promise((_, reject) => {
						if (options?.signal) {
							options.signal.addEventListener("abort", () => {
								const error = new Error("aborted");
								error.name = "AbortError";
								reject(error);
							});
						}
						setTimeout(() => reject(new Error("timeout")), 10000);
					}),
			);

			const result = await updatePlayerKnowledge(1, 1, "test", "test", {
				timeoutMs: 100,
			});

			// Should return empty update on timeout
			expect(result.updates).toHaveLength(0);
			expect(result.extractionTimeMs).toBeGreaterThanOrEqual(0);
		}, 10000);

		it("should handle malformed JSON response", async () => {
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

			const result = await updatePlayerKnowledge(1, 1, "test", "test");

			// Should return empty update on parse error
			expect(result.updates).toHaveLength(0);
		});

		it("should handle JSON wrapped in markdown code blocks", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: `\`\`\`json
{
  "updates": [
    {
      "entityName": "Велен",
      "entityType": "location",
      "awarenessLevel": "met",
      "newFacts": []
    }
  ]
}
\`\`\``,
							},
						},
					],
				}),
			} as Response);

			const result = await updatePlayerKnowledge(1, 1, "test", "test");

			expect(result.updates).toHaveLength(1);
			expect(result.updates[0].entityName).toBe("Велен");
		});
	});

	describe("multiple entities", () => {
		it("should extract knowledge about multiple entities in one turn", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									updates: [
										{
											entityName: "Таверна",
											entityType: "location",
											awarenessLevel: "met",
											newFacts: [
												{
													property: "name",
													value: "Таверна Золотой Дракон",
													source: "observation",
													confidence: "certain",
												},
											],
										},
										{
											entityName: "Григорий",
											entityType: "npc",
											awarenessLevel: "met",
											newFacts: [
												{
													property: "name",
													value: "Григорий",
													source: "met_personally",
													confidence: "certain",
												},
												{
													property: "occupation",
													value: "бармен",
													source: "observation",
													confidence: "certain",
												},
											],
										},
									],
								}),
							},
						},
					],
				}),
			} as Response);

			const result = await updatePlayerKnowledge(
				1,
				70,
				"Я захожу в таверну",
				"Ты входишь в таверну Золотой Дракон. Бармен Григорий приветствует тебя",
			);

			expect(result.updates).toHaveLength(2);
			expect(result.updates[0].entityType).toBe("location");
			expect(result.updates[1].entityType).toBe("npc");
		});
	});

	describe("performance", () => {
		it("should complete within timeout", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									updates: [],
								}),
							},
						},
					],
				}),
			} as Response);

			const startTime = Date.now();
			const result = await updatePlayerKnowledge(1, 1, "test", "test", {
				timeoutMs: 5000,
			});
			const duration = Date.now() - startTime;

			expect(duration).toBeLessThan(5000);
			expect(result.extractionTimeMs).toBeGreaterThanOrEqual(0);
		});
	});

	describe("logging", () => {
		it("should log extraction details when knowledge is extracted", async () => {
			const consoleSpy = vi.spyOn(console, "log");

			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									updates: [
										{
											entityName: "Велен",
											entityType: "location",
											awarenessLevel: "met",
											newFacts: [
												{
													property: "name",
													value: "Велен",
													source: "arrived",
													confidence: "certain",
												},
											],
										},
									],
								}),
							},
						},
					],
				}),
			} as Response);

			await updatePlayerKnowledge(1, 12, "Я иду в город", "Ты входишь в Велен");

			// Should log extraction success
			expect(consoleSpy).toHaveBeenCalledWith(
				"[Player Knowledge Updater] Extraction Success",
				expect.objectContaining({
					sessionId: 1,
					turnNumber: 12,
					updatesCount: 1,
				}),
			);

			// Should log entity update
			expect(consoleSpy).toHaveBeenCalledWith(
				"[Player Knowledge] Entity Update",
				expect.objectContaining({
					sessionId: 1,
					turnNumber: 12,
					entity: "Велен",
					type: "location",
					awarenessLevel: "met",
					factsLearned: 1,
				}),
			);

			// Should log awareness levels
			expect(consoleSpy).toHaveBeenCalledWith(
				"[Player Knowledge] Awareness Levels",
				expect.objectContaining({
					sessionId: 1,
					turnNumber: 12,
					distribution: { met: 1 },
				}),
			);

			// Should log knowledge sources
			expect(consoleSpy).toHaveBeenCalledWith(
				"[Player Knowledge] Knowledge Sources",
				expect.objectContaining({
					sessionId: 1,
					turnNumber: 12,
					distribution: { arrived: 1 },
				}),
			);

			consoleSpy.mockRestore();
		});

		it("should log when no knowledge is extracted", async () => {
			const consoleSpy = vi.spyOn(console, "log");

			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									updates: [],
								}),
							},
						},
					],
				}),
			} as Response);

			await updatePlayerKnowledge(1, 15, "Я ухожу", "Ты уходишь");

			expect(consoleSpy).toHaveBeenCalledWith(
				"[Player Knowledge Updater] No knowledge extracted",
				expect.objectContaining({
					sessionId: 1,
					turnNumber: 15,
				}),
			);

			consoleSpy.mockRestore();
		});

		it("should log multiple entities with different awareness levels", async () => {
			const consoleSpy = vi.spyOn(console, "log");

			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									updates: [
										{
											entityName: "Велен",
											entityType: "location",
											awarenessLevel: "met",
											newFacts: [
												{
													property: "name",
													value: "Велен",
													source: "arrived",
													confidence: "certain",
												},
											],
										},
										{
											entityName: "Дракон",
											entityType: "npc",
											awarenessLevel: "heard_of",
											newFacts: [
												{
													property: "existence",
													value: "живет в горах",
													source: "heard_from_npc",
													confidence: "rumor",
												},
											],
										},
									],
								}),
							},
						},
					],
				}),
			} as Response);

			await updatePlayerKnowledge(
				1,
				20,
				"Я спрашиваю о драконе",
				'Ты в Велене. Торговец говорит: "Дракон живет в горах"',
			);

			// Should log awareness level distribution
			expect(consoleSpy).toHaveBeenCalledWith(
				"[Player Knowledge] Awareness Levels",
				expect.objectContaining({
					distribution: { met: 1, heard_of: 1 },
				}),
			);

			// Should log knowledge source distribution
			expect(consoleSpy).toHaveBeenCalledWith(
				"[Player Knowledge] Knowledge Sources",
				expect.objectContaining({
					distribution: { arrived: 1, heard_from_npc: 1 },
				}),
			);

			consoleSpy.mockRestore();
		});
	});
});
