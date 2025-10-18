/**
 * World Knowledge Integration Tests
 *
 * Tests full turn flow with world knowledge updates, entity loading,
 * and database constraints.
 */

import { db } from "@/db";
import {
	messages,
	sessions,
	turns,
	worldEntities,
	worldRelationships,
} from "@/db/schema";
import { updateWorldKnowledge } from "@/lib/agents/world-knowledge-updater";
import {
	getSessionEntities,
	getSessionRelationships,
	persistWorldKnowledge,
} from "@/lib/knowledge/world-persistence";
import { loadWorldKnowledge } from "@/lib/knowledge/world-loader";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock OpenRouter for World Knowledge Updater
vi.mock("@/lib/llm/openrouter", () => ({
	callOpenRouter: vi.fn(),
}));

import { callOpenRouter } from "@/lib/llm/openrouter";

describe("World Knowledge Integration", () => {
	let testSessionId: number;
	let testTurnId: number;

	beforeEach(async () => {
		// Set API key for tests
		process.env.OPENROUTER_API_KEY = "test-api-key";

		// Create test session
		const [session] = await db
			.insert(sessions)
			.values({
				externalId: `test-world-knowledge-${Date.now()}`,
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

	describe("full turn flow with world knowledge updates", () => {
		it("should extract and persist entities from turn", async () => {
			// Mock LLM extraction
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

			// Extract world knowledge
			const update = await updateWorldKnowledge(
				testSessionId,
				1,
				"Я иду в город Велен",
				"Ты входишь в большой город Велен",
			);

			expect(update.entities).toHaveLength(1);

			// Persist to database
			const result = await persistWorldKnowledge(testSessionId, update);

			expect(result.entitiesCreated).toBe(1);
			expect(result.entitiesUpdated).toBe(0);
			expect(result.errors).toHaveLength(0);

			// Verify in database
			const entities = await getSessionEntities(testSessionId);
			expect(entities).toHaveLength(1);
			expect(entities[0].name).toBe("Велен");
			expect(entities[0].type).toBe("location");
		}, 15000);

		it("should extract and persist relationships from turn", async () => {
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

			const update = await updateWorldKnowledge(
				testSessionId,
				1,
				"Кто управляет городом?",
				"Филип Стенгер - мэр Велена",
			);

			const result = await persistWorldKnowledge(testSessionId, update);

			expect(result.entitiesCreated).toBe(2);
			expect(result.relationshipsCreated).toBe(1);

			// Verify relationships in database
			const relationships = await getSessionRelationships(testSessionId);
			expect(relationships).toHaveLength(1);
			expect(relationships[0].relationshipType).toBe("управляет");
		}, 15000);

		it("should update existing entities with new properties", async () => {
			// First turn - create entity
			vi.mocked(callOpenRouter).mockResolvedValueOnce({
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
									],
									relationships: [],
								}),
							},
						},
					],
				}),
			} as Response);

			const update1 = await updateWorldKnowledge(
				testSessionId,
				1,
				"Я встречаю Ивана",
				"Иван - торговец",
			);
			await persistWorldKnowledge(testSessionId, update1);

			// Second turn - update entity
			vi.mocked(callOpenRouter).mockResolvedValueOnce({
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

			const update2 = await updateWorldKnowledge(
				testSessionId,
				2,
				"Расскажи об Иване",
				"Иван - дружелюбный торговец 35 лет",
			);
			const result2 = await persistWorldKnowledge(testSessionId, update2);

			expect(result2.entitiesCreated).toBe(0);
			expect(result2.entitiesUpdated).toBe(1);

			// Verify merged properties
			const entities = await getSessionEntities(testSessionId);
			expect(entities).toHaveLength(1);
			expect(entities[0].properties.occupation).toBe("торговец");
			expect(entities[0].properties.age).toBe(35);
			expect(entities[0].properties.personality).toBe("дружелюбный");
		}, 20000);

		it("should handle multiple turns building world knowledge", async () => {
			// Turn 1: Location
			vi.mocked(callOpenRouter).mockResolvedValueOnce({
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
											properties: { type: "город" },
										},
									],
									relationships: [],
								}),
							},
						},
					],
				}),
			} as Response);

			const update1 = await updateWorldKnowledge(
				testSessionId,
				1,
				"Я иду в Велен",
				"Ты входишь в город Велен",
			);
			await persistWorldKnowledge(testSessionId, update1);

			// Turn 2: NPC
			vi.mocked(callOpenRouter).mockResolvedValueOnce({
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
									],
									relationships: [],
								}),
							},
						},
					],
				}),
			} as Response);

			const update2 = await updateWorldKnowledge(
				testSessionId,
				2,
				"Я встречаю торговца",
				"Торговец Иван приветствует тебя",
			);
			await persistWorldKnowledge(testSessionId, update2);

			// Turn 3: Relationship
			vi.mocked(callOpenRouter).mockResolvedValueOnce({
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
									],
									relationships: [
										{
											sourceEntityName: "Таверна",
											targetEntityName: "Велен",
											relationshipType: "находится_в",
											properties: {},
										},
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

			const update3 = await updateWorldKnowledge(
				testSessionId,
				3,
				"Где работает Иван?",
				"Иван работает в таверне, которая находится в Велене",
			);
			await persistWorldKnowledge(testSessionId, update3);

			// Verify accumulated knowledge
			const entities = await getSessionEntities(testSessionId);
			expect(entities.length).toBeGreaterThanOrEqual(3);

			const relationships = await getSessionRelationships(testSessionId);
			expect(relationships.length).toBeGreaterThanOrEqual(2);
		}, 30000);
	});

	describe("entity loading with relationships", () => {
		it("should load entities with their relationships", async () => {
			// Create entities and relationships
			const [entity1] = await db
				.insert(worldEntities)
				.values({
					sessionId: testSessionId,
					type: "npc",
					name: "Филип",
					properties: { occupation: "мэр" },
				})
				.returning();

			const [entity2] = await db
				.insert(worldEntities)
				.values({
					sessionId: testSessionId,
					type: "location",
					name: "Велен",
					properties: { type: "город" },
				})
				.returning();

			await db.insert(worldRelationships).values({
				sessionId: testSessionId,
				sourceEntityId: entity1.id,
				targetEntityId: entity2.id,
				relationshipType: "управляет",
				properties: {},
			});

			// Load world knowledge
			// Note: Currently requires exact case match
			const context = await loadWorldKnowledge(testSessionId, ["Филип"]);

			expect(context.entities.length).toBeGreaterThan(0);
			const filipEntity = context.entities.find((e) => e.name === "Филип");
			expect(filipEntity).toBeDefined();
			expect(filipEntity?.outgoingRelationships).toHaveLength(1);
			expect(filipEntity?.outgoingRelationships[0].relationshipType).toBe(
				"управляет",
			);
		}, 10000);

		it("should load 1-hop neighbor entities", async () => {
			// Create chain: Иван -> Таверна -> Велен
			const [ivan] = await db
				.insert(worldEntities)
				.values({
					sessionId: testSessionId,
					type: "npc",
					name: "Иван",
					properties: {},
				})
				.returning();

			const [tavern] = await db
				.insert(worldEntities)
				.values({
					sessionId: testSessionId,
					type: "location",
					name: "Таверна",
					properties: {},
				})
				.returning();

			const [velen] = await db
				.insert(worldEntities)
				.values({
					sessionId: testSessionId,
					type: "location",
					name: "Велен",
					properties: {},
				})
				.returning();

			await db.insert(worldRelationships).values([
				{
					sessionId: testSessionId,
					sourceEntityId: ivan.id,
					targetEntityId: tavern.id,
					relationshipType: "работает_в",
					properties: {},
				},
				{
					sessionId: testSessionId,
					sourceEntityId: tavern.id,
					targetEntityId: velen.id,
					relationshipType: "находится_в",
					properties: {},
				},
			]);

			// Load starting from Иван
			// Note: Currently requires exact case match
			const context = await loadWorldKnowledge(testSessionId, ["Иван"]);

			// Should include Иван and 1-hop neighbors (Таверна)
			expect(context.entities.length).toBeGreaterThanOrEqual(2);
			const entityNames = context.entities.map((e) => e.name);
			expect(entityNames).toContain("Иван");
			expect(entityNames).toContain("Таверна");
		}, 10000);

		it("should limit entities to prevent context overflow", async () => {
			// Create many entities
			const entityPromises = [];
			for (let i = 0; i < 30; i++) {
				entityPromises.push(
					db
						.insert(worldEntities)
						.values({
							sessionId: testSessionId,
							type: "npc",
							name: `NPC ${i}`,
							properties: {},
						})
						.returning(),
				);
			}
			await Promise.all(entityPromises);

			// Load with limit
			const context = await loadWorldKnowledge(
				testSessionId,
				Array.from({ length: 30 }, (_, i) => `NPC ${i}`),
				{ maxEntities: 20 },
			);

			// Should be limited to 20
			expect(context.entities.length).toBeLessThanOrEqual(20);
		}, 15000);
	});

	describe("database constraints", () => {
		it("should enforce unique constraint on (session_id, type, name)", async () => {
			// Create entity
			await db.insert(worldEntities).values({
				sessionId: testSessionId,
				type: "npc",
				name: "Иван",
				properties: {},
			});

			// Try to create duplicate - should fail
			await expect(
				db.insert(worldEntities).values({
					sessionId: testSessionId,
					type: "npc",
					name: "Иван",
					properties: {},
				}),
			).rejects.toThrow();
		}, 10000);

		it("should allow same name with different type", async () => {
			// Create location named "Дракон"
			await db.insert(worldEntities).values({
				sessionId: testSessionId,
				type: "location",
				name: "Дракон",
				properties: {},
			});

			// Create NPC named "Дракон" - should succeed
			const [npc] = await db
				.insert(worldEntities)
				.values({
					sessionId: testSessionId,
					type: "npc",
					name: "Дракон",
					properties: {},
				})
				.returning();

			expect(npc.name).toBe("Дракон");
			expect(npc.type).toBe("npc");
		}, 10000);

		it("should cascade delete relationships when entity is deleted", async () => {
			// Create entities and relationship
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
					name: "Таверна",
					properties: {},
				})
				.returning();

			await db.insert(worldRelationships).values({
				sessionId: testSessionId,
				sourceEntityId: entity1.id,
				targetEntityId: entity2.id,
				relationshipType: "работает_в",
				properties: {},
			});

			// Verify relationship exists
			let relationships = await getSessionRelationships(testSessionId);
			expect(relationships).toHaveLength(1);

			// Delete source entity
			await db.delete(worldEntities).where(eq(worldEntities.id, entity1.id));

			// Relationship should be deleted
			relationships = await getSessionRelationships(testSessionId);
			expect(relationships).toHaveLength(0);
		}, 10000);

		it("should prevent self-relationships", async () => {
			const [entity] = await db
				.insert(worldEntities)
				.values({
					sessionId: testSessionId,
					type: "npc",
					name: "Иван",
					properties: {},
				})
				.returning();

			// Try to create self-relationship - should fail
			await expect(
				db.insert(worldRelationships).values({
					sessionId: testSessionId,
					sourceEntityId: entity.id,
					targetEntityId: entity.id,
					relationshipType: "knows",
					properties: {},
				}),
			).rejects.toThrow();
		}, 10000);

		it("should allow multiple relationships between same entities", async () => {
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
					type: "npc",
					name: "Петр",
					properties: {},
				})
				.returning();

			// Create multiple relationships
			await db.insert(worldRelationships).values([
				{
					sessionId: testSessionId,
					sourceEntityId: entity1.id,
					targetEntityId: entity2.id,
					relationshipType: "друг",
					properties: {},
				},
				{
					sessionId: testSessionId,
					sourceEntityId: entity1.id,
					targetEntityId: entity2.id,
					relationshipType: "коллега",
					properties: {},
				},
			]);

			const relationships = await getSessionRelationships(testSessionId);
			expect(relationships.length).toBeGreaterThanOrEqual(2);
		}, 10000);

		it("should isolate entities between sessions", async () => {
			// Create entity in test session
			await db.insert(worldEntities).values({
				sessionId: testSessionId,
				type: "npc",
				name: "Иван",
				properties: {},
			});

			// Create another session
			const [session2] = await db
				.insert(sessions)
				.values({
					externalId: `test-world-knowledge-2-${Date.now()}`,
					locale: "ru",
					setting: "medieval_fantasy",
				})
				.returning();

			// Get entities for second session
			const entities = await getSessionEntities(session2.id);
			expect(entities).toHaveLength(0);

			// Cleanup
			await db.delete(sessions).where(eq(sessions.id, session2.id));
		}, 10000);
	});

	describe("error handling", () => {
		it("should handle missing DATABASE_URL", async () => {
			const originalUrl = process.env.DATABASE_URL;
			process.env.DATABASE_URL = "";

			await expect(
				persistWorldKnowledge(testSessionId, {
					entities: [],
					relationships: [],
					extractionTimeMs: 0,
				}),
			).rejects.toThrow("DATABASE_URL not found");

			process.env.DATABASE_URL = originalUrl;
		});

		it("should handle invalid entity references in relationships", async () => {
			vi.mocked(callOpenRouter).mockResolvedValue({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									entities: [],
									relationships: [
										{
											sourceEntityName: "NonExistent1",
											targetEntityName: "NonExistent2",
											relationshipType: "knows",
											properties: {},
										},
									],
								}),
							},
						},
					],
				}),
			} as Response);

			const update = await updateWorldKnowledge(
				testSessionId,
				1,
				"test",
				"test",
			);
			const result = await persistWorldKnowledge(testSessionId, update);

			// Should have error for missing entities
			expect(result.errors.length).toBeGreaterThan(0);
			expect(result.relationshipsCreated).toBe(0);
		}, 10000);
	});
});
