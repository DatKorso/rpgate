/**
 * Test for automatic entity creation in player knowledge persistence
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
import { persistPlayerKnowledge } from "@/lib/knowledge/player-persistence";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock OpenRouter for Player Knowledge Updater
vi.mock("@/lib/llm/openrouter", () => ({
	callOpenRouter: vi.fn(),
}));

import { callOpenRouter } from "@/lib/llm/openrouter";

describe("Player Knowledge Entity Creation", () => {
	let testSessionId: number;

	beforeEach(async () => {
		// Set API key for tests
		process.env.OPENROUTER_API_KEY = "test-api-key";

		// Create test session
		const [session] = await db
			.insert(sessions)
			.values({
				externalId: `test-entity-creation-${Date.now()}`,
				locale: "ru",
				setting: "medieval_fantasy",
			})
			.returning();
		testSessionId = session.id;

		vi.clearAllMocks();
	});

	afterEach(async () => {
		// Cleanup: cascade delete will handle related records
		if (testSessionId) {
			await db.delete(sessions).where(eq(sessions.id, testSessionId));
		}
	});

	it("should automatically create missing entities when updating player knowledge", async () => {
		// Mock LLM to extract knowledge about entities that don't exist in worldEntities
		vi.mocked(callOpenRouter).mockResolvedValue({
			ok: true,
			json: async () => ({
				choices: [
					{
						message: {
							content: JSON.stringify({
								updates: [
									{
										entityName: "Goblin (First)",
										entityType: "npc",
										awarenessLevel: "met",
										newFacts: [
											{
												property: "name",
												value: "Goblin (First)",
												source: "observation",
												confidence: "certain",
											},
											{
												property: "hostility",
												value: "aggressive",
												source: "observation",
												confidence: "certain",
											},
										],
									},
									{
										entityName: "Goblin (Second)",
										entityType: "npc",
										awarenessLevel: "met",
										newFacts: [
											{
												property: "name",
												value: "Goblin (Second)",
												source: "observation",
												confidence: "certain",
											},
											{
												property: "hostility",
												value: "aggressive",
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

		// Verify no entities exist initially
		const initialEntities = await db
			.select()
			.from(worldEntities)
			.where(eq(worldEntities.sessionId, testSessionId));
		expect(initialEntities).toHaveLength(0);

		// Extract player knowledge (this should create missing entities)
		const update = await updatePlayerKnowledge(
			testSessionId,
			1,
			"Я атакую гоблинов",
			"Ты видишь двух гоблинов. Первый гоблин агрессивно рычит. Второй гоблин готовится к атаке.",
		);

		// Persist to database (this should auto-create missing entities)
		const result = await persistPlayerKnowledge(testSessionId, 1, update);

		// Should have created knowledge for both goblins
		expect(result.knowledgeCreated).toBe(2);
		expect(result.knowledgeUpdated).toBe(0);
		expect(result.factsAdded).toBe(4); // 2 facts per goblin
		expect(result.errors).toHaveLength(0);

		// Verify entities were auto-created in worldEntities
		const createdEntities = await db
			.select()
			.from(worldEntities)
			.where(eq(worldEntities.sessionId, testSessionId));
		expect(createdEntities).toHaveLength(2);

		const entityNames = createdEntities.map((e) => e.name);
		expect(entityNames).toContain("Goblin (first)");
		expect(entityNames).toContain("Goblin (second)");

		// Verify player knowledge was created
		const knowledge = await db
			.select()
			.from(playerKnowledge)
			.where(eq(playerKnowledge.sessionId, testSessionId));
		expect(knowledge).toHaveLength(2);

		// Each knowledge entry should have 2 facts
		for (const k of knowledge) {
			expect(k.knownFacts).toHaveLength(2);
			expect(k.awarenessLevel).toBe("met");
		}
	});

	it("should not create duplicate entities if they already exist", async () => {
		// First, create an entity manually
		const [existingEntity] = await db
			.insert(worldEntities)
			.values({
				sessionId: testSessionId,
				type: "npc",
				name: "Goblin (First)",
				properties: { existing: true },
			})
			.returning();

		// Mock LLM to extract knowledge about the existing entity
		vi.mocked(callOpenRouter).mockResolvedValue({
			ok: true,
			json: async () => ({
				choices: [
					{
						message: {
							content: JSON.stringify({
								updates: [
									{
										entityName: "Goblin (First)",
										entityType: "npc",
										awarenessLevel: "met",
										newFacts: [
											{
												property: "name",
												value: "Goblin (First)",
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
			"Я вижу гоблина",
			"Ты видишь гоблина",
		);

		const result = await persistPlayerKnowledge(testSessionId, 1, update);

		// Should have created knowledge but not a new entity
		expect(result.knowledgeCreated).toBe(1);
		expect(result.errors).toHaveLength(0);

		// Should still have only one entity
		const entities = await db
			.select()
			.from(worldEntities)
			.where(eq(worldEntities.sessionId, testSessionId));
		expect(entities).toHaveLength(1);
		expect(entities[0].id).toBe(existingEntity.id);
		expect(entities[0].properties.existing).toBe(true);
	});

	it("should handle fuzzy matching when creating entities", async () => {
		// Create an entity with a slightly different name
		await db.insert(worldEntities).values({
			sessionId: testSessionId,
			type: "npc",
			name: "Гоблин",
			properties: { existing: true },
		});

		// Mock LLM to extract knowledge about a similar entity
		vi.mocked(callOpenRouter).mockResolvedValue({
			ok: true,
			json: async () => ({
				choices: [
					{
						message: {
							content: JSON.stringify({
								updates: [
									{
										entityName: "Первый Гоблин",
										entityType: "npc",
										awarenessLevel: "met",
										newFacts: [
											{
												property: "name",
												value: "Первый Гоблин",
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
			"Я вижу первого гоблина",
			"Ты видишь первого гоблина",
		);

		const result = await persistPlayerKnowledge(testSessionId, 1, update);

		// Should have found the existing entity via fuzzy matching
		expect(result.knowledgeCreated).toBe(1);
		expect(result.errors).toHaveLength(0);

		// Should still have only one entity (fuzzy matched)
		const entities = await db
			.select()
			.from(worldEntities)
			.where(eq(worldEntities.sessionId, testSessionId));
		expect(entities).toHaveLength(1);
		expect(entities[0].name).toBe("Гоблин");
	});
});