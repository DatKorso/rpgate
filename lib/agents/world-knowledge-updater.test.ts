/**
 * World Knowledge Updater Tests
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	addEntityAlias,
	areEntitiesSimilar,
	calculateSimilarity,
	findBestMatch,
	mergeEntityProperties,
	normalizeEntityName,
} from "../knowledge/entity-utils";
import { updateWorldKnowledge } from "./world-knowledge-updater";

// Mock OpenRouter API
vi.mock("@/lib/llm/openrouter", () => ({
	callOpenRouter: vi.fn(),
}));

import { callOpenRouter } from "@/lib/llm/openrouter";

describe("Entity Normalization", () => {
	it("should normalize entity names", () => {
		expect(normalizeEntityName("  ivan  ")).toBe("Ivan");
		expect(normalizeEntityName("merchant ivan")).toBe("Merchant Ivan");
		expect(normalizeEntityName("ivan the terrible")).toBe("Ivan The Terrible");
		expect(normalizeEntityName("the  old   man")).toBe("The Old Man");
	});

	it("should preserve all-caps acronyms", () => {
		expect(normalizeEntityName("NPC guard")).toBe("NPC Guard");
		expect(normalizeEntityName("GM notes")).toBe("GM Notes");
	});

	it("should handle empty and whitespace strings", () => {
		expect(normalizeEntityName("")).toBe("");
		expect(normalizeEntityName("   ")).toBe("");
	});
});

describe("Entity Similarity", () => {
	it("should calculate similarity correctly", () => {
		expect(calculateSimilarity("ivan", "ivan")).toBe(1.0);
		expect(calculateSimilarity("ivan", "Ivan")).toBe(1.0);
		expect(calculateSimilarity("ivan", "iva")).toBeGreaterThan(0.7);
		expect(calculateSimilarity("ivan", "john")).toBeLessThan(0.5);
	});

	it("should detect similar entities", () => {
		expect(areEntitiesSimilar("Ivan", "ivan")).toBe(true);
		expect(areEntitiesSimilar("Merchant Ivan", "Ivan")).toBe(true);
		expect(areEntitiesSimilar("Ivan", "Merchant Ivan")).toBe(true);
		expect(areEntitiesSimilar("Ivan", "Iva")).toBe(true);
		expect(areEntitiesSimilar("Ivan", "John")).toBe(false);
	});

	it("should handle substring matches", () => {
		expect(areEntitiesSimilar("The Old Merchant", "Merchant")).toBe(true);
		expect(areEntitiesSimilar("Merchant", "The Old Merchant")).toBe(true);
	});
});

describe("Entity Matching", () => {
	it("should find best match from list", () => {
		const existing = ["Ivan", "John", "Merchant Ivan"];

		expect(findBestMatch("ivan", existing)).toBe(0);
		expect(findBestMatch("Merchant", existing)).toBe(2);
		expect(findBestMatch("Iva", existing)).toBe(0);
		expect(findBestMatch("Unknown", existing)).toBe(-1);
	});

	it("should prefer exact matches", () => {
		const existing = ["Ivan", "Iva", "Ivanov"];

		expect(findBestMatch("Ivan", existing)).toBe(0);
	});

	it("should prefer substring matches", () => {
		const existing = ["John", "Merchant Ivan", "Peter"];

		expect(findBestMatch("Ivan", existing)).toBe(1);
	});
});

describe("Property Merging", () => {
	it("should merge properties correctly", () => {
		const existing = { name: "Ivan", age: 30 };
		const updates = { occupation: "merchant", age: 31 };

		const merged = mergeEntityProperties(existing, updates);

		expect(merged).toEqual({
			name: "Ivan",
			age: 31,
			occupation: "merchant",
		});
	});

	it("should skip null and undefined values", () => {
		const existing = { name: "Ivan", age: 30 };
		const updates = { occupation: null, age: undefined };

		const merged = mergeEntityProperties(existing, updates);

		expect(merged).toEqual({
			name: "Ivan",
			age: 30,
		});
	});

	it("should handle empty objects", () => {
		expect(mergeEntityProperties({}, {})).toEqual({});
		expect(mergeEntityProperties({ name: "Ivan" }, {})).toEqual({
			name: "Ivan",
		});
		expect(mergeEntityProperties({}, { name: "Ivan" })).toEqual({
			name: "Ivan",
		});
	});
});

describe("Entity Aliases", () => {
	it("should add aliases to properties", () => {
		const properties = {};
		const withAlias = addEntityAlias(properties, "The Merchant");

		expect(withAlias).toEqual({
			aliases: ["The Merchant"],
		});
	});

	it("should not add duplicate aliases", () => {
		const properties = { aliases: ["The Merchant"] };
		const withAlias = addEntityAlias(properties, "the merchant");

		expect(withAlias).toEqual({
			aliases: ["The Merchant"],
		});
	});

	it("should normalize aliases", () => {
		const properties = {};
		const withAlias = addEntityAlias(properties, "  the  merchant  ");

		expect(withAlias).toEqual({
			aliases: ["The Merchant"],
		});
	});

	it("should preserve existing properties", () => {
		const properties = { name: "Ivan", age: 30 };
		const withAlias = addEntityAlias(properties, "Merchant");

		expect(withAlias).toEqual({
			name: "Ivan",
			age: 30,
			aliases: ["Merchant"],
		});
	});
});

describe("World Knowledge Updater", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Set API key for tests
		process.env.OPENROUTER_API_KEY = "test-api-key";
	});

	describe("entity extraction from turns", () => {
		it("should extract location entities from turn", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									entities: [
										{
											type: "location",
											name: "Велен",
											properties: {
												type: "город",
												size: "большой",
												population: 10000,
											},
										},
									],
									relationships: [],
								}),
							},
						},
					],
				}),
			} as Response);

			const result = await updateWorldKnowledge(
				1,
				1,
				"Я иду в город Велен",
				"Ты входишь в большой город Велен с населением около 10000 человек",
			);

			expect(result.entities).toHaveLength(1);
			expect(result.entities[0].type).toBe("location");
			expect(result.entities[0].name).toBe("Велен");
			expect(result.entities[0].properties.type).toBe("город");
			expect(result.entities[0].properties.size).toBe("большой");
			expect(result.entities[0].properties.population).toBe(10000);
		});

		it("should extract NPC entities from turn", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									entities: [
										{
											type: "npc",
											name: "Филип Стенгер",
											properties: {
												occupation: "мэр",
												age: 45,
												appearance: "седовласый мужчина",
											},
										},
									],
									relationships: [],
								}),
							},
						},
					],
				}),
			} as Response);

			const result = await updateWorldKnowledge(
				1,
				2,
				"Я встречаю мэра",
				"Перед тобой стоит седовласый мужчина лет 45. Это Филип Стенгер, мэр города",
			);

			expect(result.entities).toHaveLength(1);
			expect(result.entities[0].type).toBe("npc");
			expect(result.entities[0].name).toBe("Филип Стенгер");
			expect(result.entities[0].properties.occupation).toBe("мэр");
			expect(result.entities[0].properties.age).toBe(45);
		});

		it("should extract item entities from turn", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									entities: [
										{
											type: "item",
											name: "Древний Меч",
											properties: {
												material: "сталь",
												condition: "хорошее",
												magical: true,
												runes: "светящиеся руны",
											},
										},
									],
									relationships: [],
								}),
							},
						},
					],
				}),
			} as Response);

			const result = await updateWorldKnowledge(
				1,
				3,
				"Я беру меч",
				"Ты берешь древний меч из стали с светящимися рунами. Он в хорошем состоянии",
			);

			expect(result.entities).toHaveLength(1);
			expect(result.entities[0].type).toBe("item");
			expect(result.entities[0].name).toBe("Древний Меч");
			expect(result.entities[0].properties.magical).toBe(true);
		});

		it("should extract faction entities from turn", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									entities: [
										{
											type: "faction",
											name: "Гильдия Торговцев",
											properties: {
												influence: "высокое",
												members: 50,
												headquarters: "Велен",
											},
										},
									],
									relationships: [],
								}),
							},
						},
					],
				}),
			} as Response);

			const result = await updateWorldKnowledge(
				1,
				4,
				"Я спрашиваю о гильдии",
				"Гильдия Торговцев - влиятельная организация с 50 членами. Их штаб-квартира в Велене",
			);

			expect(result.entities).toHaveLength(1);
			expect(result.entities[0].type).toBe("faction");
			expect(result.entities[0].name).toBe("Гильдия Торговцев");
		});

		it("should extract event entities from turn", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									entities: [
										{
											type: "event",
											name: "Битва у Велена",
											properties: {
												date: "3 дня назад",
												participants: ["армия короля", "бандиты"],
												outcome: "победа армии",
											},
										},
									],
									relationships: [],
								}),
							},
						},
					],
				}),
			} as Response);

			const result = await updateWorldKnowledge(
				1,
				5,
				"Что случилось недавно?",
				"Три дня назад у Велена произошла битва между армией короля и бандитами. Армия победила",
			);

			expect(result.entities).toHaveLength(1);
			expect(result.entities[0].type).toBe("event");
			expect(result.entities[0].name).toBe("Битва у Велена");
		});

		it("should extract multiple entities from single turn", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									entities: [
										{
											type: "location",
											name: "Таверна Золотой Дракон",
											properties: { type: "таверна" },
										},
										{
											type: "npc",
											name: "Григорий",
											properties: { occupation: "бармен" },
										},
										{
											type: "item",
											name: "Эль",
											properties: { type: "напиток" },
										},
									],
									relationships: [],
								}),
							},
						},
					],
				}),
			} as Response);

			const result = await updateWorldKnowledge(
				1,
				6,
				"Я захожу в таверну",
				"Ты входишь в таверну Золотой Дракон. Бармен Григорий предлагает тебе эль",
			);

			expect(result.entities).toHaveLength(3);
			expect(result.entities.map((e) => e.type)).toContain("location");
			expect(result.entities.map((e) => e.type)).toContain("npc");
			expect(result.entities.map((e) => e.type)).toContain("item");
		});

		it("should handle turns with no extractable entities", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									entities: [],
									relationships: [],
								}),
							},
						},
					],
				}),
			} as Response);

			const result = await updateWorldKnowledge(
				1,
				7,
				"Я атакую",
				"Ты атакуешь. Бросок: 15",
			);

			expect(result.entities).toHaveLength(0);
			expect(result.relationships).toHaveLength(0);
		});
	});

	describe("relationship extraction", () => {
		it("should extract governs relationship", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									entities: [
										{
											type: "npc",
											name: "Филип Стенгер",
											properties: { occupation: "мэр" },
										},
										{
											type: "location",
											name: "Велен",
											properties: { type: "город" },
										},
									],
									relationships: [
										{
											sourceEntityName: "Филип Стенгер",
											targetEntityName: "Велен",
											relationshipType: "управляет",
											properties: {},
										},
									],
								}),
							},
						},
					],
				}),
			} as Response);

			const result = await updateWorldKnowledge(
				1,
				8,
				"Кто управляет городом?",
				"Филип Стенгер - мэр Велена",
			);

			expect(result.relationships).toHaveLength(1);
			expect(result.relationships[0].sourceEntityName).toBe("Филип Стенгер");
			expect(result.relationships[0].targetEntityName).toBe("Велен");
			expect(result.relationships[0].relationshipType).toBe("управляет");
		});

		it("should extract located_in relationship", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									entities: [
										{
											type: "location",
											name: "Таверна",
											properties: { type: "здание" },
										},
										{
											type: "location",
											name: "Велен",
											properties: { type: "город" },
										},
									],
									relationships: [
										{
											sourceEntityName: "Таверна",
											targetEntityName: "Велен",
											relationshipType: "находится_в",
											properties: {},
										},
									],
								}),
							},
						},
					],
				}),
			} as Response);

			const result = await updateWorldKnowledge(
				1,
				9,
				"Где таверна?",
				"Таверна находится в городе Велен",
			);

			expect(result.relationships).toHaveLength(1);
			expect(result.relationships[0].relationshipType).toBe("находится_в");
		});

		it("should extract member_of relationship", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									entities: [
										{
											type: "npc",
											name: "Иван",
											properties: { occupation: "торговец" },
										},
										{
											type: "faction",
											name: "Гильдия Торговцев",
											properties: {},
										},
									],
									relationships: [
										{
											sourceEntityName: "Иван",
											targetEntityName: "Гильдия Торговцев",
											relationshipType: "член",
											properties: { rank: "мастер" },
										},
									],
								}),
							},
						},
					],
				}),
			} as Response);

			const result = await updateWorldKnowledge(
				1,
				10,
				"Кто такой Иван?",
				"Иван - мастер-торговец из Гильдии Торговцев",
			);

			expect(result.relationships).toHaveLength(1);
			expect(result.relationships[0].relationshipType).toBe("член");
			expect(result.relationships[0].properties?.rank).toBe("мастер");
		});

		it("should extract multiple relationships", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									entities: [
										{
											type: "npc",
											name: "Филип",
											properties: {},
										},
										{
											type: "location",
											name: "Велен",
											properties: {},
										},
										{
											type: "faction",
											name: "Совет Города",
											properties: {},
										},
									],
									relationships: [
										{
											sourceEntityName: "Филип",
											targetEntityName: "Велен",
											relationshipType: "управляет",
											properties: {},
										},
										{
											sourceEntityName: "Филип",
											targetEntityName: "Совет Города",
											relationshipType: "возглавляет",
											properties: {},
										},
									],
								}),
							},
						},
					],
				}),
			} as Response);

			const result = await updateWorldKnowledge(
				1,
				11,
				"Расскажи о Филипе",
				"Филип управляет Веленом и возглавляет Совет Города",
			);

			expect(result.relationships).toHaveLength(2);
		});
	});

	describe("property merging", () => {
		it("should extract properties for entities", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									entities: [
										{
											type: "npc",
											name: "Иван",
											properties: {
												occupation: "торговец",
												age: 35,
												personality: "дружелюбный",
											},
										},
									],
									relationships: [],
								}),
							},
						},
					],
				}),
			} as Response);

			const result = await updateWorldKnowledge(
				1,
				14,
				"Расскажи об Иване",
				"Иван - дружелюбный торговец 35 лет",
			);

			expect(result.entities[0].properties).toEqual({
				occupation: "торговец",
				age: 35,
				personality: "дружелюбный",
			});
		});

		it("should handle complex property values", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									entities: [
										{
											type: "location",
											name: "Велен",
											properties: {
												districts: ["торговый", "жилой", "замок"],
												population: 10000,
												features: {
													walls: true,
													market: true,
													temple: false,
												},
											},
										},
									],
									relationships: [],
								}),
							},
						},
					],
				}),
			} as Response);

			const result = await updateWorldKnowledge(
				1,
				15,
				"Расскажи о Велене",
				"Велен имеет три района: торговый, жилой и замок. Население 10000. Есть стены и рынок",
			);

			expect(result.entities[0].properties.districts).toEqual([
				"торговый",
				"жилой",
				"замок",
			]);
			expect(result.entities[0].properties.features).toEqual({
				walls: true,
				market: true,
				temple: false,
			});
		});
	});

	describe("error handling", () => {
		it("should throw error when API key is missing", async () => {
			const originalKey = process.env.OPENROUTER_API_KEY;
			process.env.OPENROUTER_API_KEY = "";

			await expect(updateWorldKnowledge(1, 1, "test", "test")).rejects.toThrow(
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

			const result = await updateWorldKnowledge(1, 1, "test", "test");

			// Should return empty update on error
			expect(result.entities).toHaveLength(0);
			expect(result.relationships).toHaveLength(0);
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

			const result = await updateWorldKnowledge(1, 1, "test", "test", {
				timeoutMs: 100,
			});

			// Should return empty update on timeout
			expect(result.entities).toHaveLength(0);
			expect(result.relationships).toHaveLength(0);
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

			const result = await updateWorldKnowledge(1, 1, "test", "test");

			// Should return empty update on parse error
			expect(result.entities).toHaveLength(0);
			expect(result.relationships).toHaveLength(0);
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
  "entities": [
    {
      "type": "location",
      "name": "Велен",
      "properties": {}
    }
  ],
  "relationships": []
}
\`\`\``,
							},
						},
					],
				}),
			} as Response);

			const result = await updateWorldKnowledge(1, 1, "test", "test");

			expect(result.entities).toHaveLength(1);
			expect(result.entities[0].name).toBe("Велен");
		});

		it("should handle empty content", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: "",
							},
						},
					],
				}),
			} as Response);

			const result = await updateWorldKnowledge(1, 1, "test", "test");

			// Should return empty update on empty content
			expect(result.entities).toHaveLength(0);
			expect(result.relationships).toHaveLength(0);
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
									entities: [],
									relationships: [],
								}),
							},
						},
					],
				}),
			} as Response);

			const startTime = Date.now();
			const result = await updateWorldKnowledge(1, 1, "test", "test", {
				timeoutMs: 5000,
			});
			const duration = Date.now() - startTime;

			expect(duration).toBeLessThan(5000);
			expect(result.extractionTimeMs).toBeGreaterThanOrEqual(0);
		});

		it("should track extraction time", async () => {
			vi.mocked(callOpenRouter).mockImplementation(
				async () =>
					new Promise((resolve) => {
						setTimeout(
							() =>
								resolve({
									ok: true,
									json: async () => ({
										choices: [
											{
												message: {
													content: JSON.stringify({
														entities: [],
														relationships: [],
													}),
												},
											},
										],
									}),
								} as Response),
							100,
						);
					}),
			);

			const result = await updateWorldKnowledge(1, 1, "test", "test");

			// Should be close to 100ms (allow some variance)
			expect(result.extractionTimeMs).toBeGreaterThanOrEqual(90);
		});
	});

	describe("Russian language handling", () => {
		it("should handle Cyrillic characters in entities", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									entities: [
										{
											type: "npc",
											name: "Григорий",
											properties: {
												occupation: "бармен",
											},
										},
									],
									relationships: [],
								}),
							},
						},
					],
				}),
			} as Response);

			const result = await updateWorldKnowledge(
				1,
				1,
				"Я встречаю Григория",
				"Григорий - бармен таверны",
			);

			expect(result.entities[0].name).toBe("Григорий");
			expect(result.entities[0].properties.occupation).toBe("бармен");
		});

		it("should handle Cyrillic in relationship types", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									entities: [
										{
											type: "npc",
											name: "Иван",
											properties: {},
										},
										{
											type: "location",
											name: "Таверна",
											properties: {},
										},
									],
									relationships: [
										{
											sourceEntityName: "Иван",
											targetEntityName: "Таверна",
											relationshipType: "работает_в",
											properties: {},
										},
									],
								}),
							},
						},
					],
				}),
			} as Response);

			const result = await updateWorldKnowledge(
				1,
				1,
				"Где работает Иван?",
				"Иван работает в таверне",
			);

			expect(result.relationships[0].relationshipType).toBe("работает_в");
		});
	});
});
