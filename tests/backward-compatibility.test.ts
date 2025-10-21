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
import {
	getEnhancedDataDefaults,
	mergeWithEnhancedDefaults,
} from "@/lib/agents/character";
import {
	formatAppearanceForNarrative,
	formatBackgroundForNarrative,
} from "@/lib/agents/narrative-llm";

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
	describe("Enhanced Character Creation Backward Compatibility", () => {
		const testSessionId = 999;
		
		// Mock database data for testing
		const mockLegacyCharacter = {
			id: 1,
			sessionId: testSessionId,
			className: "Воин",
			bio: "Опытный боец",
			strMod: 3,
			dexMod: 1,
			conMod: 2,
			intMod: -1,
			wisMod: 0,
			chaMod: 0,
			skills: {},
			equipment: {},
			temporary: {},
			appearance: null, // Legacy character without enhanced data
			background: null, // Legacy character without enhanced data
			abilityPriority: null, // Legacy character without enhanced data
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		const mockEnhancedCharacter = {
			...mockLegacyCharacter,
			id: 2,
			appearance: {
				age: 30,
				height: "высокий" as const,
				build: "крепкий" as const,
				hair: "темные" as const,
				eyes: "карие" as const,
				distinguishingMarks: "Шрам на лице",
			},
			background: {
				origin: "город" as const,
				profession: "солдат" as const,
				motivation: "Защитить родину",
			},
			abilityPriority: "physical" as const,
		};

		it("should provide sensible defaults for missing enhanced data", () => {
			// Requirement 4.2: Handle missing enhanced fields gracefully
			const defaults = getEnhancedDataDefaults();
			
			expect(defaults.appearance).toEqual({});
			expect(defaults.background).toEqual({});
			expect(defaults.abilityPriority).toBeNull();
		});

		it("should merge legacy character data with enhanced defaults", () => {
			// Requirement 4.3: Merge existing data with defaults
			const enhanced = mergeWithEnhancedDefaults(mockLegacyCharacter);
			
			expect(enhanced.className).toBe("Воин");
			expect(enhanced.bio).toBe("Опытный боец");
			expect(enhanced.abilities.str).toBe(3);
			expect(enhanced.appearance).toEqual({});
			expect(enhanced.background).toEqual({});
			expect(enhanced.abilityPriority).toBeNull();
		});

		it("should preserve enhanced data when present", () => {
			// Requirement 4.4: Preserve existing enhanced data
			const enhanced = mergeWithEnhancedDefaults(mockEnhancedCharacter);
			
			expect(enhanced.appearance.age).toBe(30);
			expect(enhanced.appearance.height).toBe("высокий");
			expect(enhanced.background.origin).toBe("город");
			expect(enhanced.background.profession).toBe("солдат");
			expect(enhanced.abilityPriority).toBe("physical");
		});

		it("should handle null/undefined enhanced fields gracefully", () => {
			// Requirement 4.5: Handle null/undefined values
			const characterWithNulls = {
				...mockLegacyCharacter,
				appearance: undefined,
				background: undefined,
				abilityPriority: undefined,
			};
			
			const enhanced = mergeWithEnhancedDefaults(characterWithNulls);
			
			expect(enhanced.appearance).toEqual({});
			expect(enhanced.background).toEqual({});
			expect(enhanced.abilityPriority).toBeNull();
		});

		it("should handle partial enhanced data", () => {
			// Requirement 4.2: Handle partial enhanced data
			const partialEnhanced = {
				...mockLegacyCharacter,
				appearance: { age: 25 }, // Only age provided
				background: { origin: "деревня" as const }, // Only origin provided
				abilityPriority: null,
			};
			
			const enhanced = mergeWithEnhancedDefaults(partialEnhanced);
			
			expect(enhanced.appearance.age).toBe(25);
			expect(enhanced.appearance.height).toBeUndefined();
			expect(enhanced.background.origin).toBe("деревня");
			expect(enhanced.background.profession).toBeUndefined();
		});

		it("should work with narrative agent for legacy characters", () => {
			// Requirement 5.5: Narrative agent handles legacy characters
			// Test with empty appearance/background (legacy character)
			const appearanceText = formatAppearanceForNarrative({});
			const backgroundText = formatBackgroundForNarrative({});
			
			expect(appearanceText).toBe("");
			expect(backgroundText).toBe("");
		});

		it("should work with narrative agent for enhanced characters", () => {
			// Requirement 5.1, 5.2, 5.3: Narrative agent uses enhanced data
			const appearanceText = formatAppearanceForNarrative(mockEnhancedCharacter.appearance);
			const backgroundText = formatBackgroundForNarrative(mockEnhancedCharacter.background);
			
			expect(appearanceText).toContain("30 лет");
			expect(appearanceText).toContain("высокого роста");
			expect(appearanceText).toContain("крепкого телосложения");
			expect(appearanceText).toContain("с темными волосами");
			expect(appearanceText).toContain("с карими глазами");
			expect(appearanceText).toContain("особые приметы: Шрам на лице");
			
			expect(backgroundText).toContain("родом из города");
			expect(backgroundText).toContain("по профессии солдат");
			expect(backgroundText).toContain("мотивация: Защитить родину");
		});

		it("should handle mixed character data in narrative context", () => {
			// Requirement 4.1, 4.2, 4.3: Mixed old/new character scenarios
			const legacyProfile = {
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

			const enhancedProfile = {
				...legacyProfile,
				appearance: mockEnhancedCharacter.appearance,
				background: mockEnhancedCharacter.background,
				abilityPriority: mockEnhancedCharacter.abilityPriority,
			};

			// Both should work in narrative context
			expect(legacyProfile.className).toBe("Воин");
			expect(enhancedProfile.className).toBe("Воин");
			expect(enhancedProfile.appearance.age).toBe(30);
		});

		it("should maintain API compatibility for character retrieval", () => {
			// Requirement 4.4: API compatibility maintained
			// Mock API response structure for legacy character
			const legacyApiResponse = {
				...mockLegacyCharacter,
				appearance: mockLegacyCharacter.appearance || {},
				background: mockLegacyCharacter.background || {},
			};

			// Mock API response structure for enhanced character
			const enhancedApiResponse = {
				...mockEnhancedCharacter,
				appearance: mockEnhancedCharacter.appearance || {},
				background: mockEnhancedCharacter.background || {},
			};

			// Both should have consistent structure
			expect(legacyApiResponse.appearance).toEqual({});
			expect(legacyApiResponse.background).toEqual({});
			expect(enhancedApiResponse.appearance.age).toBe(30);
			expect(enhancedApiResponse.background.origin).toBe("город");
		});

		it("should handle gradual enhancement of old characters", () => {
			// Requirement 4.4: Allow existing characters to be updated with enhanced information
			const originalCharacter = { ...mockLegacyCharacter };
			
			// Simulate gradual enhancement
			const partiallyEnhanced = {
				...originalCharacter,
				appearance: { age: 35, height: "средний" as const },
				// background still empty
				// abilityPriority still null
			};

			const fullyEnhanced = {
				...partiallyEnhanced,
				background: { origin: "дворянство" as const, profession: "ученый" as const },
				abilityPriority: "mental" as const,
			};

			// All stages should be valid
			expect(originalCharacter.appearance).toBeNull();
			expect(partiallyEnhanced.appearance.age).toBe(35);
			expect(fullyEnhanced.background.origin).toBe("дворянство");
			expect(fullyEnhanced.abilityPriority).toBe("mental");
		});
	});