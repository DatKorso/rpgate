/**
 * E2E Tests for Knowledge-Aware Gameplay
 *
 * Tests real gameplay scenarios where the GM respects PC knowledge boundaries
 */

import { db } from "@/db";
import {
	characters,
	playerKnowledge,
	sessions,
	worldEntities,
} from "@/db/schema";
import { updatePlayerKnowledge } from "@/lib/agents/player-knowledge-updater";
import { updateWorldKnowledge } from "@/lib/agents/world-knowledge-updater";
import { persistPlayerKnowledge } from "@/lib/knowledge/player-persistence";
import { persistWorldKnowledge } from "@/lib/knowledge/world-persistence";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock OpenRouter for knowledge updaters
vi.mock("@/lib/llm/openrouter", () => ({
	callOpenRouter: vi.fn(),
}));

import { callOpenRouter } from "@/lib/llm/openrouter";

describe("E2E: Knowledge-Aware Gameplay", () => {
	let testSessionId: number;
	let testExternalId: string;

	beforeEach(async () => {
		// Set API key for tests
		process.env.OPENROUTER_API_KEY = "test-api-key";

		// Create test session
		testExternalId = `e2e-knowledge-${Date.now()}`;
		const [session] = await db
			.insert(sessions)
			.values({
				externalId: testExternalId,
				locale: "ru",
				setting: "medieval_fantasy",
			})
			.returning();
		testSessionId = session.id;

		// Create test character
		await db.insert(characters).values({
			sessionId: testSessionId,
			className: "Воин",
			bio: "Храбрый воин",
			strMod: 2,
			dexMod: 1,
			conMod: 1,
			intMod: 0,
			wisMod: 0,
			chaMod: -1,
			skills: { Athletics: 2, Perception: 1 },
		});

		vi.clearAllMocks();
	});

	afterEach(async () => {
		// Cleanup
		if (testSessionId) {
			await db.delete(sessions).where(eq(sessions.id, testSessionId));
		}
	});

	describe("PC learning about new location", () => {
		it("should track PC learning about location through arrival", async () => {
			// Mock world knowledge extraction
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
											properties: {
												type: "город",
												size: "большой",
												population: 10000,
												mayor: "Филип Стенгер",
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

			// Mock player knowledge extraction
			vi.mocked(callOpenRouter).mockResolvedValueOnce({
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

			// Simulate turn: PC arrives in Velen
			const worldUpdate = await updateWorldKnowledge(
				testSessionId,
				1,
				"Я иду в город",
				"Ты входишь в большой город Велен. Здесь живет около 10000 человек. Городом управляет мэр Филип Стенгер",
			);
			await persistWorldKnowledge(testSessionId, worldUpdate);

			const playerUpdate = await updatePlayerKnowledge(
				testSessionId,
				1,
				"Я иду в город",
				"Ты входишь в большой город Велен. Здесь живет около 10000 человек. Городом управляет мэр Филип Стенгер",
			);
			await persistPlayerKnowledge(testSessionId, 1, playerUpdate);

			// Verify world knowledge has all facts
			const worldEntity = await db
				.select()
				.from(worldEntities)
				.where(eq(worldEntities.sessionId, testSessionId))
				.limit(1);

			expect(worldEntity).toHaveLength(1);
			expect(worldEntity[0].name).toBe("Велен");
			expect(worldEntity[0].properties.population).toBe(10000);
			expect(worldEntity[0].properties.mayor).toBe("Филип Стенгер");

			// Verify player knowledge only has what PC observed
			const pcKnowledge = await db
				.select()
				.from(playerKnowledge)
				.where(eq(playerKnowledge.sessionId, testSessionId))
				.limit(1);

			expect(pcKnowledge).toHaveLength(1);
			expect(pcKnowledge[0].awarenessLevel).toBe("met");
			expect(pcKnowledge[0].knownFacts).toHaveLength(3);

			// PC should know: name, type, size
			// PC should NOT know: population number, mayor name (not directly observed)
			const factProperties = (pcKnowledge[0].knownFacts as Array<{ property: string }>).map(
				(f) => f.property,
			);
			expect(factProperties).toContain("name");
			expect(factProperties).toContain("type");
			expect(factProperties).toContain("size");
		}, 15000);
	});

	describe("PC asking about unknown entity", () => {
		it("should track when PC learns about entity through NPC dialogue", async () => {
			// First, create world entity (GM knows about it)
			await db.insert(worldEntities).values({
				sessionId: testSessionId,
				type: "npc",
				name: "Филип Стенгер",
				properties: {
					occupation: "мэр",
					age: 45,
					personality: "строгий",
					secretPlan: "повысить налоги",
				},
			});

			// Mock player knowledge extraction - PC asks about unknown NPC
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

			// Simulate turn: PC asks about mayor
			const playerUpdate = await updatePlayerKnowledge(
				testSessionId,
				1,
				"Кто управляет городом?",
				'Торговец говорит: "Филип Стенгер - наш мэр"',
			);
			await persistPlayerKnowledge(testSessionId, 1, playerUpdate);

			// Verify player knowledge
			const pcKnowledge = await db
				.select()
				.from(playerKnowledge)
				.where(eq(playerKnowledge.sessionId, testSessionId))
				.limit(1);

			expect(pcKnowledge).toHaveLength(1);
			expect(pcKnowledge[0].awarenessLevel).toBe("heard_of");

			// PC should only know name and occupation (what NPC told them)
			const facts = pcKnowledge[0].knownFacts as Array<{ property: string }>;
			expect(facts).toHaveLength(2);
			expect(facts.map((f) => f.property)).toContain("name");
			expect(facts.map((f) => f.property)).toContain("occupation");

			// PC should NOT know age, personality, or secret plan
			expect(facts.map((f) => f.property)).not.toContain("age");
			expect(facts.map((f) => f.property)).not.toContain("personality");
			expect(facts.map((f) => f.property)).not.toContain("secretPlan");
		}, 15000);
	});

	describe("NPC sharing world knowledge", () => {
		it("should track PC learning facts from NPC dialogue", async () => {
			// Create world entities
			await db.insert(worldEntities).values([
				{
					sessionId: testSessionId,
					type: "location",
					name: "Темный Лес",
					properties: {
						danger: "высокая",
						monsters: ["волки", "медведи", "бандиты"],
						hiddenTreasure: "древний артефакт",
					},
				},
			]);

			// Turn 1: PC hears about Dark Forest (rumor)
			vi.mocked(callOpenRouter).mockResolvedValueOnce({
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

			const update1 = await updatePlayerKnowledge(
				testSessionId,
				1,
				"Что там за лес?",
				'Пьяный говорит: "Темный Лес - опасное место"',
			);
			await persistPlayerKnowledge(testSessionId, 1, update1);

			// Turn 2: PC gets more reliable information
			vi.mocked(callOpenRouter).mockResolvedValueOnce({
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
													property: "monsters",
													value: "волки и медведи",
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

			const update2 = await updatePlayerKnowledge(
				testSessionId,
				2,
				"Какие там опасности?",
				'Охотник говорит: "Там водятся волки и медведи"',
			);
			await persistPlayerKnowledge(testSessionId, 2, update2);

			// Verify accumulated knowledge
			const pcKnowledge = await db
				.select()
				.from(playerKnowledge)
				.where(eq(playerKnowledge.sessionId, testSessionId))
				.limit(1);

			expect(pcKnowledge).toHaveLength(1);
			expect(pcKnowledge[0].awarenessLevel).toBe("heard_of");

			const facts = pcKnowledge[0].knownFacts as Array<{
				property: string;
				confidence?: string;
			}>;
			expect(facts.length).toBeGreaterThanOrEqual(3);

			// PC should know about danger (rumor) and monsters (certain)
			const dangerFact = facts.find((f) => f.property === "danger");
			expect(dangerFact?.confidence).toBe("rumor");

			const monstersFact = facts.find((f) => f.property === "monsters");
			expect(monstersFact?.confidence).toBe("certain");

			// PC should NOT know about hidden treasure
			expect(facts.map((f) => f.property)).not.toContain("hiddenTreasure");
		}, 20000);
	});

	describe("GM respecting PC knowledge boundaries", () => {
		it("should prevent PC from accessing information they haven't learned", async () => {
			// Create world entity with secret information
			const [entity] = await db
				.insert(worldEntities)
				.values({
					sessionId: testSessionId,
					type: "npc",
					name: "Иван",
					properties: {
						occupation: "торговец",
						realIdentity: "шпион",
						secretMission: "украсть артефакт",
						contacts: ["Григорий", "Петр"],
					},
				})
				.returning();

			// PC only knows basic information
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

			// Verify PC knowledge is limited
			const pcKnowledge = await db
				.select()
				.from(playerKnowledge)
				.where(eq(playerKnowledge.entityId, entity.id))
				.limit(1);

			expect(pcKnowledge).toHaveLength(1);
			const facts = pcKnowledge[0].knownFacts as Array<{ property: string }>;

			// PC should only know name and occupation
			expect(facts).toHaveLength(2);
			expect(facts.map((f) => f.property)).toContain("name");
			expect(facts.map((f) => f.property)).toContain("occupation");

			// PC should NOT know secret information
			expect(facts.map((f) => f.property)).not.toContain("realIdentity");
			expect(facts.map((f) => f.property)).not.toContain("secretMission");
			expect(facts.map((f) => f.property)).not.toContain("contacts");

			// World knowledge has all information
			const worldEntity = await db
				.select()
				.from(worldEntities)
				.where(eq(worldEntities.id, entity.id))
				.limit(1);

			expect(worldEntity[0].properties.realIdentity).toBe("шпион");
			expect(worldEntity[0].properties.secretMission).toBe("украсть артефакт");
			expect(worldEntity[0].properties.contacts).toEqual([
				"Григорий",
				"Петр",
			]);
		}, 15000);

		it("should allow PC to learn secrets through gameplay", async () => {
			// Create world entity
			const [entity] = await db
				.insert(worldEntities)
				.values({
					sessionId: testSessionId,
					type: "npc",
					name: "Григорий",
					properties: {
						occupation: "бармен",
						secretAffiliation: "Гильдия Воров",
					},
				})
				.returning();

			// Initially PC only knows basic info
			await db.insert(playerKnowledge).values({
				sessionId: testSessionId,
				entityId: entity.id,
				awarenessLevel: "met",
				knownFacts: [
					{
						property: "name",
						value: "Григорий",
						learnedAt: 1,
						source: "met_personally",
						confidence: "certain",
					},
					{
						property: "occupation",
						value: "бармен",
						learnedAt: 1,
						source: "observation",
						confidence: "certain",
					},
				],
			});

			// PC discovers secret through gameplay
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
											awarenessLevel: "familiar",
											newFacts: [
												{
													property: "secretAffiliation",
													value: "Гильдия Воров",
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
				5,
				"Я слежу за Григорием",
				"Ты видишь, как Григорий встречается с членами Гильдии Воров",
			);
			await persistPlayerKnowledge(testSessionId, 5, update);

			// Verify PC now knows the secret
			const pcKnowledge = await db
				.select()
				.from(playerKnowledge)
				.where(eq(playerKnowledge.entityId, entity.id))
				.limit(1);

			const facts = pcKnowledge[0].knownFacts as Array<{ property: string }>;
			expect(facts).toHaveLength(3);
			expect(facts.map((f) => f.property)).toContain("secretAffiliation");

			// Awareness level should progress
			expect(pcKnowledge[0].awarenessLevel).toBe("familiar");
		}, 15000);
	});

	describe("awareness level progression", () => {
		it("should progress from heard_of to met to familiar", async () => {
			// Create world entity
			const [entity] = await db
				.insert(worldEntities)
				.values({
					sessionId: testSessionId,
					type: "npc",
					name: "Петр",
					properties: { occupation: "кузнец" },
				})
				.returning();

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
											entityName: "Петр",
											entityType: "npc",
											awarenessLevel: "heard_of",
											newFacts: [
												{
													property: "name",
													value: "Петр",
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
				"Где найти кузнеца?",
				'Торговец говорит: "Петр - лучший кузнец в городе"',
			);
			await persistPlayerKnowledge(testSessionId, 1, update1);

			let pcKnowledge = await db
				.select()
				.from(playerKnowledge)
				.where(eq(playerKnowledge.entityId, entity.id))
				.limit(1);
			expect(pcKnowledge[0].awarenessLevel).toBe("heard_of");

			// Turn 2: met
			vi.mocked(callOpenRouter).mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									updates: [
										{
											entityName: "Петр",
											entityType: "npc",
											awarenessLevel: "met",
											newFacts: [
												{
													property: "occupation",
													value: "кузнец",
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
				"Я иду к Петру",
				"Ты встречаешь Петра в его кузнице",
			);
			await persistPlayerKnowledge(testSessionId, 2, update2);

			pcKnowledge = await db
				.select()
				.from(playerKnowledge)
				.where(eq(playerKnowledge.entityId, entity.id))
				.limit(1);
			expect(pcKnowledge[0].awarenessLevel).toBe("met");

			// Turn 3: familiar
			vi.mocked(callOpenRouter).mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: JSON.stringify({
									updates: [
										{
											entityName: "Петр",
											entityType: "npc",
											awarenessLevel: "familiar",
											newFacts: [
												{
													property: "personality",
													value: "дружелюбный",
													source: "observation",
													confidence: "certain",
												},
												{
													property: "specialty",
													value: "мечи",
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
				"Я разговариваю с Петром",
				'Петр дружелюбно говорит: "Я специализируюсь на мечах"',
			);
			await persistPlayerKnowledge(testSessionId, 3, update3);

			pcKnowledge = await db
				.select()
				.from(playerKnowledge)
				.where(eq(playerKnowledge.entityId, entity.id))
				.limit(1);
			expect(pcKnowledge[0].awarenessLevel).toBe("familiar");

			// Verify all facts accumulated
			const facts = pcKnowledge[0].knownFacts as Array<{ property: string }>;
			expect(facts.length).toBeGreaterThanOrEqual(4);
		}, 25000);
	});
});
