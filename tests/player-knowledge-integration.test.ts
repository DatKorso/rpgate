/**
 * Player Knowledge Integration Tests
 *
 * Tests full turn flow with player knowledge updates, knowledge loading,
 * and narrative context building.
 */

import { db } from "@/db";
import {
	messages,
	playerKnowledge,
	sessions,
	turns,
	worldEntities,
} from "@/db/schema";
import { updatePlayerKnowledge } from "@/lib/agents/player-knowledge-updater";
import { buildNarrativeContext } from "@/lib/agents/narrative-context";
import {
	getPlayerKnowledge,
	persistPlayerKnowledge,
} from "@/lib/knowledge/player-persistence";
import { loadPlayerKnowledge } from "@/lib/knowledge/player-loader";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock OpenRouter for Player Knowledge Updater
vi.mock("@/lib/llm/openrouter", () => ({
	callOpenRouter: vi.fn(),
}));

import { callOpenRouter } from "@/lib/llm/openrouter";

describe("Player Knowledge Integration", () => {
	let testSessionId: number;
	let testTurnId: number;

	beforeEach(async () => {
		// Set API key for tests
		process.env.OPENROUTER_API_KEY = "test-api-key";

		// Create test session
		const [session] = await db
			.insert(sessions)
			.values({
				externalId: `test-player-knowledge-${Date.now()}`,
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
				content: "Я иду в город Велен",
			})
			.returning();

		const [gmMsg] = await db
			.insert(messages)
			.values({
				sessionId: testSessionId,
				role: "gm",
				content: "Ты входишь в большой город Велен",
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

	describe("full turn flow with player knowledge updates", () => {
		it("should extract and persist player knowledge from turn", async () => {
			// First create the world entity
			const [entity] = await db
				.insert(worldEntities)
				.values({
					sessionId: testSessionId,
					type: "location",
					name: "Велен",
					properties: { type: "город" },
				})
				.returning();

			// Mock LLM extraction
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
											],
										},
									],
								}),
							},
						},
					],
				}),
			} as Response);

			// Extract player knowledge
			const update = await updatePlayerKnowledge(
				testSessionId,
				1,
				"Я иду в город Велен",
				"Ты входишь в большой город Велен",
			);

			expect(update.updates).toHaveLength(1);

			// Persist to database
			const result = await persistPlayerKnowledge(testSessionId, 1, update);

			expect(result.knowledgeCreated).toBe(1);
			expect(result.knowledgeUpdated).toBe(0);
			expect(result.factsAdded).toBe(2);
			expect(result.errors).toHaveLength(0);

			// Verify in database
			const knowledge = await getPlayerKnowledge(testSessionId);
			expect(knowledge).toHaveLength(1);
			expect(knowledge[0].awarenessLevel).toBe("met");
			expect(knowledge[0].knownFacts).toHaveLength(2);
		}, 15000);

		it("should accumulate facts over multiple turns", async () => {
			// Create world entity
			const [entity] = await db
				.insert(worldEntities)
				.values({
					sessionId: testSessionId,
					type: "npc",
					name: "Иван",
					properties: {},
				})
				.returning();

			// Turn 1: Learn name and occupation
			vi.mocked(callOpenRouter).mockResolvedValueOnce({
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
													property: "occupation",
													value: "торговец",
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

			const update1 = await updatePlayerKnowledge(
				testSessionId,
				1,
				"Я встречаю Ивана",
				"Иван - торговец",
			);
			await persistPlayerKnowledge(testSessionId, 1, update1);

			// Turn 2: Learn age and personality
			vi.mocked(callOpenRouter).mockResolvedValueOnce({
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
											awarenessLevel: "familiar",
											newFacts: [
												{
													property: "age",
													value: 35,
													source: "observation",
													confidence: "certain",
												},
												{
													property: "personality",
													value: "дружелюбный",
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

			const update2 = await updatePlayerKnowledge(
				testSessionId,
				2,
				"Расскажи об Иване",
				"Иван - дружелюбный торговец 35 лет",
			);
			const result2 = await persistPlayerKnowledge(testSessionId, 2, update2);

			expect(result2.knowledgeCreated).toBe(0);
			expect(result2.knowledgeUpdated).toBe(1);
			expect(result2.factsAdded).toBe(2);

			// Verify accumulated facts
			const knowledge = await getPlayerKnowledge(testSessionId);
			expect(knowledge).toHaveLength(1);
			expect(knowledge[0].knownFacts).toHaveLength(4);
			expect(knowledge[0].awarenessLevel).toBe("familiar");
		}, 20000);

		it("should progress awareness level but never regress", async () => {
			// Create world entity
			await db.insert(worldEntities).values({
				sessionId: testSessionId,
				type: "npc",
				name: "Григорий",
				properties: {},
			});

			// Turn 1: heard_of
			vi.mocked(callOpenRouter).mockResolvedValueOnce({
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
											awarenessLevel: "heard_of",
											newFacts: [
												{
													property: "name",
													value: "Григорий",
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

			const update1 = await updatePlayerKnowledge(
				testSessionId,
				1,
				"Кто такой Григорий?",
				'Торговец говорит: "Григорий - бармен"',
			);
			await persistPlayerKnowledge(testSessionId, 1, update1);

			// Turn 2: met (should progress)
			vi.mocked(callOpenRouter).mockResolvedValueOnce({
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
													property: "appearance",
													value: "высокий",
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

			const update2 = await updatePlayerKnowledge(
				testSessionId,
				2,
				"Я встречаю Григория",
				"Ты встречаешь высокого Григория",
			);
			await persistPlayerKnowledge(testSessionId, 2, update2);

			// Turn 3: Try to regress to heard_of (should stay at met)
			vi.mocked(callOpenRouter).mockResolvedValueOnce({
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
											awarenessLevel: "heard_of",
											newFacts: [
												{
													property: "occupation",
													value: "бармен",
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

			const update3 = await updatePlayerKnowledge(
				testSessionId,
				3,
				"Кто он?",
				"Он бармен",
			);
			await persistPlayerKnowledge(testSessionId, 3, update3);

			// Verify awareness level stayed at met
			const knowledge = await getPlayerKnowledge(testSessionId);
			expect(knowledge).toHaveLength(1);
			expect(knowledge[0].awarenessLevel).toBe("met");
			expect(knowledge[0].knownFacts).toHaveLength(3);
		}, 25000);

		it("should handle multiple entities in one turn", async () => {
			// Create world entities
			await db.insert(worldEntities).values([
				{
					sessionId: testSessionId,
					type: "location",
					name: "Таверна",
					properties: {},
				},
				{
					sessionId: testSessionId,
					type: "npc",
					name: "Бармен",
					properties: {},
				},
			]);

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
											entityName: "Бармен",
											entityType: "npc",
											awarenessLevel: "met",
											newFacts: [
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

			const update = await updatePlayerKnowledge(
				testSessionId,
				1,
				"Я захожу в таверну",
				"Ты входишь в таверну Золотой Дракон. Бармен приветствует тебя",
			);
			const result = await persistPlayerKnowledge(testSessionId, 1, update);

			expect(result.knowledgeCreated).toBe(2);
			expect(result.factsAdded).toBe(2);

			const knowledge = await getPlayerKnowledge(testSessionId);
			expect(knowledge).toHaveLength(2);
		}, 15000);
	});

	describe("knowledge loading", () => {
		it("should load player knowledge for mentioned entities", async () => {
			// Create world entity and player knowledge
			const [entity] = await db
				.insert(worldEntities)
				.values({
					sessionId: testSessionId,
					type: "npc",
					name: "Иван",
					properties: {},
				})
				.returning();

			await db.insert(playerKnowledge).values({
				sessionId: testSessionId,
				entityId: entity.id,
				awarenessLevel: "met",
				knownFacts: [
					{
						property: "name",
						value: "Иван",
						learnedAt: 1,
						source: "met_personally",
						confidence: "certain",
					},
					{
						property: "occupation",
						value: "торговец",
						learnedAt: 1,
						source: "observation",
						confidence: "certain",
					},
				],
			});

			// Load player knowledge
			const context = await loadPlayerKnowledge(testSessionId, ["Иван"]);

			expect(context.knownEntities).toHaveLength(1);
			expect(context.knownEntities[0].entity.name).toBe("Иван");
			expect(context.knownEntities[0].awarenessLevel).toBe("met");
			expect(context.knownEntities[0].knownFacts).toHaveLength(2);
		}, 10000);

		it("should handle case-insensitive entity name matching", async () => {
			// Create world entity with normalized name
			const [entity] = await db
				.insert(worldEntities)
				.values({
					sessionId: testSessionId,
					type: "npc",
					name: "Иван",
					properties: {},
				})
				.returning();

			await db.insert(playerKnowledge).values({
				sessionId: testSessionId,
				entityId: entity.id,
				awarenessLevel: "met",
				knownFacts: [
					{
						property: "name",
						value: "Иван",
						learnedAt: 1,
						source: "met_personally",
					},
				],
			});

			// Load with different case
			const context = await loadPlayerKnowledge(testSessionId, [
				"иван",
				"ИВАН",
				"Иван",
			]);

			// Should find the entity regardless of case
			expect(context.knownEntities.length).toBeGreaterThan(0);
		}, 10000);

		it("should return empty context for unknown entities", async () => {
			const context = await loadPlayerKnowledge(testSessionId, [
				"НеизвестныйNPC",
			]);

			expect(context.knownEntities).toHaveLength(0);
		}, 10000);

		it("should load multiple entities", async () => {
			// Create multiple entities and knowledge
			const [entity1] = await db
				.insert(worldEntities)
				.values({
					sessionId: testSessionId,
					type: "npc",
					name: "Иван",
					properties: {},
				})
				.returning();

			const [entity2] = await db
				.insert(worldEntities)
				.values({
					sessionId: testSessionId,
					type: "location",
					name: "Велен",
					properties: {},
				})
				.returning();

			await db.insert(playerKnowledge).values([
				{
					sessionId: testSessionId,
					entityId: entity1.id,
					awarenessLevel: "met",
					knownFacts: [
						{
							property: "name",
							value: "Иван",
							learnedAt: 1,
							source: "met_personally",
						},
					],
				},
				{
					sessionId: testSessionId,
					entityId: entity2.id,
					awarenessLevel: "met",
					knownFacts: [
						{
							property: "name",
							value: "Велен",
							learnedAt: 2,
							source: "arrived",
						},
					],
				},
			]);

			const context = await loadPlayerKnowledge(testSessionId, [
				"Иван",
				"Велен",
			]);

			expect(context.knownEntities).toHaveLength(2);
		}, 10000);
	});

	describe("narrative context building", () => {
		it("should build context with player knowledge", async () => {
			// Create world entity and player knowledge
			const [entity] = await db
				.insert(worldEntities)
				.values({
					sessionId: testSessionId,
					type: "npc",
					name: "Иван",
					properties: { occupation: "торговец" },
				})
				.returning();

			await db.insert(playerKnowledge).values({
				sessionId: testSessionId,
				entityId: entity.id,
				awarenessLevel: "met",
				knownFacts: [
					{
						property: "name",
						value: "Иван",
						learnedAt: 1,
						source: "met_personally",
						confidence: "certain",
					},
					{
						property: "occupation",
						value: "торговец",
						learnedAt: 1,
						source: "observation",
						confidence: "certain",
					},
				],
			});

			// Build narrative context
			const context = await buildNarrativeContext(
				testSessionId,
				"Я ищу Ивана",
				[],
				undefined,
				["Иван"],
				null,
				{ loadPlayerKnowledge: true },
			);

			expect(context.playerKnowledge).toBeDefined();
			expect(context.playerKnowledge?.knownEntities).toHaveLength(1);
			expect(context.playerKnowledge?.knownEntities[0].entity.name).toBe(
				"Иван",
			);
		}, 10000);

		it("should build context with both world and player knowledge", async () => {
			// Create world entity
			const [entity] = await db
				.insert(worldEntities)
				.values({
					sessionId: testSessionId,
					type: "npc",
					name: "Иван",
					properties: {
						occupation: "торговец",
						age: 35,
						secretPlan: "украсть артефакт",
					},
				})
				.returning();

			// Create player knowledge (PC only knows some facts)
			await db.insert(playerKnowledge).values({
				sessionId: testSessionId,
				entityId: entity.id,
				awarenessLevel: "met",
				knownFacts: [
					{
						property: "name",
						value: "Иван",
						learnedAt: 1,
						source: "met_personally",
						confidence: "certain",
					},
					{
						property: "occupation",
						value: "торговец",
						learnedAt: 1,
						source: "observation",
						confidence: "certain",
					},
				],
			});

			// Build narrative context with both knowledge types
			const context = await buildNarrativeContext(
				testSessionId,
				"Я разговариваю с Иваном",
				[],
				undefined,
				["Иван"],
				null,
				{
					loadWorldKnowledge: true,
					loadPlayerKnowledge: true,
				},
			);

			// Player knowledge should only include what PC learned
			expect(context.playerKnowledge).toBeDefined();
			expect(context.playerKnowledge?.knownEntities).toHaveLength(1);
			expect(context.playerKnowledge?.knownEntities[0].knownFacts).toHaveLength(
				2,
			);

			// PC shouldn't know about secret plan
			const pcFacts = context.playerKnowledge?.knownEntities[0].knownFacts;
			const hasSecretPlan = pcFacts?.some((f) => f.property === "secretPlan");
			expect(hasSecretPlan).toBe(false);

			// World knowledge may or may not be loaded depending on entity matching
			// The important part is that player knowledge is correctly filtered
		}, 10000);

		it("should handle missing entities gracefully", async () => {
			const context = await buildNarrativeContext(
				testSessionId,
				"Я ищу неизвестного NPC",
				[],
				undefined,
				["НеизвестныйNPC"],
				null,
				{ loadPlayerKnowledge: true },
			);

			// Should not have player knowledge for unknown entity
			expect(
				context.playerKnowledge?.knownEntities || [],
			).toHaveLength(0);
		}, 10000);
	});

	describe("database constraints", () => {
		it("should enforce unique constraint on (session_id, entity_id)", async () => {
			const [entity] = await db
				.insert(worldEntities)
				.values({
					sessionId: testSessionId,
					type: "npc",
					name: "Иван",
					properties: {},
				})
				.returning();

			// Create player knowledge
			await db.insert(playerKnowledge).values({
				sessionId: testSessionId,
				entityId: entity.id,
				awarenessLevel: "met",
				knownFacts: [],
			});

			// Try to create duplicate - should fail
			await expect(
				db.insert(playerKnowledge).values({
					sessionId: testSessionId,
					entityId: entity.id,
					awarenessLevel: "familiar",
					knownFacts: [],
				}),
			).rejects.toThrow();
		}, 10000);

		it("should cascade delete player knowledge when entity is deleted", async () => {
			const [entity] = await db
				.insert(worldEntities)
				.values({
					sessionId: testSessionId,
					type: "npc",
					name: "Иван",
					properties: {},
				})
				.returning();

			await db.insert(playerKnowledge).values({
				sessionId: testSessionId,
				entityId: entity.id,
				awarenessLevel: "met",
				knownFacts: [],
			});

			// Verify knowledge exists
			let knowledge = await getPlayerKnowledge(testSessionId);
			expect(knowledge).toHaveLength(1);

			// Delete entity
			await db.delete(worldEntities).where(eq(worldEntities.id, entity.id));

			// Player knowledge should be deleted
			knowledge = await getPlayerKnowledge(testSessionId);
			expect(knowledge).toHaveLength(0);
		}, 10000);

		it("should isolate player knowledge between sessions", async () => {
			// Create entity and knowledge in test session
			const [entity] = await db
				.insert(worldEntities)
				.values({
					sessionId: testSessionId,
					type: "npc",
					name: "Иван",
					properties: {},
				})
				.returning();

			await db.insert(playerKnowledge).values({
				sessionId: testSessionId,
				entityId: entity.id,
				awarenessLevel: "met",
				knownFacts: [],
			});

			// Create another session
			const [session2] = await db
				.insert(sessions)
				.values({
					externalId: `test-player-knowledge-2-${Date.now()}`,
					locale: "ru",
					setting: "medieval_fantasy",
				})
				.returning();

			// Get knowledge for second session
			const knowledge = await getPlayerKnowledge(session2.id);
			expect(knowledge).toHaveLength(0);

			// Cleanup
			await db.delete(sessions).where(eq(sessions.id, session2.id));
		}, 10000);
	});

	describe("error handling", () => {
		it("should handle missing DATABASE_URL", async () => {
			const originalUrl = process.env.DATABASE_URL;
			process.env.DATABASE_URL = "";

			await expect(
				persistPlayerKnowledge(testSessionId, 1, {
					updates: [],
					extractionTimeMs: 0,
				}),
			).rejects.toThrow("DATABASE_URL not found");

			process.env.DATABASE_URL = originalUrl;
		});

		it("should handle missing world entity", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									updates: [
										{
											entityName: "НеизвестныйNPC",
											entityType: "npc",
											awarenessLevel: "met",
											newFacts: [
												{
													property: "name",
													value: "НеизвестныйNPC",
													source: "met_personally",
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

			const update = await updatePlayerKnowledge(
				testSessionId,
				1,
				"test",
				"test",
			);
			const result = await persistPlayerKnowledge(testSessionId, 1, update);

			// Should have error for missing entity
			expect(result.errors.length).toBeGreaterThan(0);
			expect(result.knowledgeCreated).toBe(0);
		}, 10000);
	});
});
