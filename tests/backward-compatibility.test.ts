/**
 * Backward Compatibility Tests
 *
 * Ensures that the system works correctly when knowledge graph features are disabled.
 * Tests Requirements: 11.1, 11.2, 11.3, 11.4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
	getFeatureFlags,
	setSessionFeatureFlags,
	clearSessionFeatureFlags,
	isMemoryAgentEnabled,
	isWorldKnowledgeEnabled,
	isPlayerKnowledgeEnabled,
} from "@/lib/feature-flags";
import { buildNarrativeContext } from "@/lib/agents/narrative-context";
import { analyzeMemoryNeed as analyzeMemoryNeedHeuristic } from "@/lib/memory/heuristic";

describe("Backward Compatibility", () => {
	const testSessionId = 999;

	beforeEach(() => {
		// Clear any existing overrides
		clearSessionFeatureFlags(testSessionId);
	});

	afterEach(() => {
		clearSessionFeatureFlags(testSessionId);
	});

	describe("Feature Flags", () => {
		it("should allow disabling Memory Agent per session", () => {
			// Requirement 11.1: Memory Agent can be disabled
			setSessionFeatureFlags(testSessionId, { enableMemoryAgent: false });

			const flags = getFeatureFlags(testSessionId);
			expect(flags.enableMemoryAgent).toBe(false);
			expect(isMemoryAgentEnabled(testSessionId)).toBe(false);
		});

		it("should allow disabling World Knowledge per session", () => {
			// Requirement 11.2: World Knowledge can be disabled
			setSessionFeatureFlags(testSessionId, { enableWorldKnowledge: false });

			const flags = getFeatureFlags(testSessionId);
			expect(flags.enableWorldKnowledge).toBe(false);
			expect(isWorldKnowledgeEnabled(testSessionId)).toBe(false);
		});

		it("should allow disabling Player Knowledge per session", () => {
			// Requirement 11.2: Player Knowledge can be disabled
			setSessionFeatureFlags(testSessionId, { enablePlayerKnowledge: false });

			const flags = getFeatureFlags(testSessionId);
			expect(flags.enablePlayerKnowledge).toBe(false);
			expect(isPlayerKnowledgeEnabled(testSessionId)).toBe(false);
		});

		it("should allow disabling all knowledge graph features", () => {
			// Requirement 11.3: All features can be disabled together
			setSessionFeatureFlags(testSessionId, {
				enableMemoryAgent: false,
				enableWorldKnowledge: false,
				enablePlayerKnowledge: false,
			});

			const flags = getFeatureFlags(testSessionId);
			expect(flags.enableMemoryAgent).toBe(false);
			expect(flags.enableWorldKnowledge).toBe(false);
			expect(flags.enablePlayerKnowledge).toBe(false);
		});

		it("should preserve other flags when disabling one feature", () => {
			// Requirement 11.4: Partial disabling works correctly
			setSessionFeatureFlags(testSessionId, { enableMemoryAgent: false });

			const flags = getFeatureFlags(testSessionId);
			expect(flags.enableMemoryAgent).toBe(false);
			expect(flags.enableWorldKnowledge).toBe(true);
			expect(flags.enablePlayerKnowledge).toBe(true);
		});
	});

	describe("Heuristic Fallback", () => {
		it("should work without Memory Agent", () => {
			// Requirement 11.1: Heuristic fallback works when Memory Agent disabled
			const playerInput = "Вспомни о таверне";
			const history = [
				{ role: "player" as const, content: "Я иду в таверну" },
				{ role: "gm" as const, content: "Ты входишь в таверну" },
			];

			const decision = analyzeMemoryNeedHeuristic(playerInput, history);

			expect(decision).toBeDefined();
			expect(decision.shouldRetrieve).toBe(true);
			expect(decision.triggers).toContain("explicit_request");
		});

		it("should detect memory triggers with heuristic", () => {
			// Requirement 11.1: Heuristic can detect memory needs
			const testCases = [
				{ input: "Что было в прошлый раз?", shouldRetrieve: true },
				{ input: "Напомни о драконе", shouldRetrieve: true },
				{ input: "Я атакую врага", shouldRetrieve: false },
			];

			for (const testCase of testCases) {
				const decision = analyzeMemoryNeedHeuristic(testCase.input, []);
				expect(decision.shouldRetrieve).toBe(testCase.shouldRetrieve);
			}
		});
	});

	describe("Narrative Context Without Knowledge Graph", () => {
		it("should build context without world knowledge", async () => {
			// Requirement 11.2: Narrative works without world knowledge
			const context = await buildNarrativeContext(
				testSessionId,
				"Я иду в город",
				[
					{ role: "player", content: "Привет" },
					{ role: "gm", content: "Привет, путник" },
				],
				undefined,
				["Велен"],
				null,
				{
					loadWorldKnowledge: false,
					loadPlayerKnowledge: true,
				},
			);

			expect(context).toBeDefined();
			expect(context.history).toHaveLength(2);
			expect(context.worldKnowledge).toBeUndefined();
		});

		it("should build context without player knowledge", async () => {
			// Requirement 11.2: Narrative works without player knowledge
			const context = await buildNarrativeContext(
				testSessionId,
				"Я иду в город",
				[
					{ role: "player", content: "Привет" },
					{ role: "gm", content: "Привет, путник" },
				],
				undefined,
				["Велен"],
				null,
				{
					loadWorldKnowledge: true,
					loadPlayerKnowledge: false,
				},
			);

			expect(context).toBeDefined();
			expect(context.history).toHaveLength(2);
			expect(context.playerKnowledge).toBeUndefined();
		});

		it("should build context without any knowledge graph features", async () => {
			// Requirement 11.3: Narrative works with all knowledge features disabled
			const context = await buildNarrativeContext(
				testSessionId,
				"Я иду в город",
				[
					{ role: "player", content: "Привет" },
					{ role: "gm", content: "Привет, путник" },
				],
				undefined,
				undefined,
				null,
				{
					loadWorldKnowledge: false,
					loadPlayerKnowledge: false,
				},
			);

			expect(context).toBeDefined();
			expect(context.history).toHaveLength(2);
			expect(context.worldKnowledge).toBeUndefined();
			expect(context.playerKnowledge).toBeUndefined();
		});

		it("should build context with only vector memories", async () => {
			// Requirement 11.4: Vector memory works independently
			const vectorMemories = [
				{
					id: 1,
					sessionId: testSessionId,
					turnId: 1,
					turnNumber: 1,
					type: "location_discovery" as const,
					summary: "Прибыл в Велен",
					content: "Игрок прибыл в город Велен",
					entities: ["Велен"],
					embedding: null,
					similarity: 0.9,
					createdAt: new Date(),
				},
			];

			const context = await buildNarrativeContext(
				testSessionId,
				"Что я знаю о Велене?",
				[],
				vectorMemories,
				undefined,
				null,
				{
					loadWorldKnowledge: false,
					loadPlayerKnowledge: false,
				},
			);

			expect(context).toBeDefined();
			expect(context.vectorMemories).toHaveLength(1);
			expect(context.vectorMemories?.[0].summary).toBe("Прибыл в Велен");
			expect(context.worldKnowledge).toBeUndefined();
			expect(context.playerKnowledge).toBeUndefined();
		});
	});

	describe("Graceful Degradation", () => {
		it("should handle missing entities gracefully", async () => {
			// Requirement 11.3: System works when no entities exist
			const context = await buildNarrativeContext(
				testSessionId,
				"Я иду в город",
				[],
				undefined,
				["НесуществующийГород"],
				null,
				{
					loadWorldKnowledge: true,
					loadPlayerKnowledge: true,
				},
			);

			expect(context).toBeDefined();
			// Should not throw error, just return empty knowledge
			expect(context.worldKnowledge?.entities || []).toHaveLength(0);
			expect(context.playerKnowledge?.knownEntities || []).toHaveLength(0);
		});

		it("should handle empty mentioned entities", async () => {
			// Requirement 11.4: System works with no entity mentions
			const context = await buildNarrativeContext(
				testSessionId,
				"Я иду вперёд",
				[],
				undefined,
				[],
				null,
				{
					loadWorldKnowledge: true,
					loadPlayerKnowledge: true,
				},
			);

			expect(context).toBeDefined();
			expect(context.worldKnowledge).toBeUndefined();
			expect(context.playerKnowledge).toBeUndefined();
		});

		it("should handle undefined mentioned entities", async () => {
			// Requirement 11.4: System works with undefined entities
			const context = await buildNarrativeContext(
				testSessionId,
				"Я иду вперёд",
				[],
				undefined,
				undefined,
				null,
				{
					loadWorldKnowledge: true,
					loadPlayerKnowledge: true,
				},
			);

			expect(context).toBeDefined();
			expect(context.worldKnowledge).toBeUndefined();
			expect(context.playerKnowledge).toBeUndefined();
		});
	});

	describe("Vector Memory Independence", () => {
		it("should retrieve vector memories without knowledge graph", async () => {
			// Requirement 11.1: Vector memory works independently
			const vectorMemories = [
				{
					id: 1,
					sessionId: testSessionId,
					turnId: 1,
					turnNumber: 1,
					type: "npc_interaction" as const,
					summary: "Встреча с торговцем",
					content: "Игрок встретил торговца Ивана",
					entities: ["Иван"],
					embedding: null,
					similarity: 0.85,
					createdAt: new Date(),
				},
				{
					id: 2,
					sessionId: testSessionId,
					turnId: 2,
					turnNumber: 2,
					type: "location_discovery" as const,
					summary: "Обнаружена пещера",
					content: "Игрок нашёл тёмную пещеру",
					entities: ["Пещера"],
					embedding: null,
					similarity: 0.75,
					createdAt: new Date(),
				},
			];

			const context = await buildNarrativeContext(
				testSessionId,
				"Что я помню?",
				[],
				vectorMemories,
				undefined,
				null,
				{
					loadWorldKnowledge: false,
					loadPlayerKnowledge: false,
				},
			);

			expect(context.vectorMemories).toHaveLength(2);
			expect(context.vectorMemories?.[0].type).toBe("npc_interaction");
			expect(context.vectorMemories?.[1].type).toBe("location_discovery");
		});
	});

	describe("Character Profile Independence", () => {
		it("should include character profile without knowledge graph", async () => {
			// Requirement 11.4: Character profile works independently
			const characterProfile = {
				className: "Воин",
				bio: "Опытный боец",
				abilities: {
					str: 3,
					dex: 1,
					con: 2,
					int: -1,
					wis: 0,
					cha: 0,
				},
			};

			const context = await buildNarrativeContext(
				testSessionId,
				"Я атакую",
				[],
				undefined,
				undefined,
				characterProfile,
				{
					loadWorldKnowledge: false,
					loadPlayerKnowledge: false,
				},
			);

			expect(context.characterProfile).toBeDefined();
			expect(context.characterProfile?.className).toBe("Воин");
			expect(context.characterProfile?.abilities.str).toBe(3);
		});
	});

	describe("Error Handling", () => {
		it("should continue without knowledge graph on load errors", async () => {
			// Requirement 11.3: Errors don't break main flow
			// Mock a database error by using invalid session ID
			const invalidSessionId = -1;

			const context = await buildNarrativeContext(
				invalidSessionId,
				"Я иду в город",
				[],
				undefined,
				["Велен"],
				null,
				{
					loadWorldKnowledge: true,
					loadPlayerKnowledge: true,
				},
			);

			// Should not throw, just return context without knowledge
			expect(context).toBeDefined();
			expect(context.history).toHaveLength(0);
		});
	});
});
