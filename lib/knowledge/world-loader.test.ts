/**
 * World Loader Tests
 */

import { describe, expect, it } from "vitest";
import {
	type WorldKnowledgeContext,
	formatWorldKnowledgeForLLM,
} from "./world-loader";

describe("World Loader", () => {
	describe("formatWorldKnowledgeForLLM", () => {
		it("should return empty string for empty context", () => {
			const context: WorldKnowledgeContext = {
				entities: [],
				loadTimeMs: 0,
			};

			const result = formatWorldKnowledgeForLLM(context);
			expect(result).toBe("");
		});

		it("should format single entity without relationships", () => {
			const context: WorldKnowledgeContext = {
				entities: [
					{
						id: 1,
						type: "location",
						name: "Велен",
						properties: {
							size: "большой",
							population: 10000,
						},
						outgoingRelationships: [],
						incomingRelationships: [],
					},
				],
				loadTimeMs: 10,
			};

			const result = formatWorldKnowledgeForLLM(context);
			expect(result).toContain("=== WORLD KNOWLEDGE (только для GM) ===");
			expect(result).toContain("Локация: Велен");
			expect(result).toContain("- size: большой");
			expect(result).toContain("- population: 10000");
		});

		it("should format entity with outgoing relationships", () => {
			const context: WorldKnowledgeContext = {
				entities: [
					{
						id: 1,
						type: "npc",
						name: "Филип Стенгер",
						properties: {
							occupation: "мэр",
							age: 45,
						},
						outgoingRelationships: [
							{
								targetEntity: { name: "Велен", type: "location" },
								relationshipType: "управляет",
								properties: {},
							},
						],
						incomingRelationships: [],
					},
				],
				loadTimeMs: 15,
			};

			const result = formatWorldKnowledgeForLLM(context);
			expect(result).toContain("NPC: Филип Стенгер");
			expect(result).toContain("- occupation: мэр");
			expect(result).toContain("- Связи: управляет → Велен");
		});

		it("should format entity with incoming relationships", () => {
			const context: WorldKnowledgeContext = {
				entities: [
					{
						id: 2,
						type: "location",
						name: "Велен",
						properties: {
							type: "город",
						},
						outgoingRelationships: [],
						incomingRelationships: [
							{
								sourceEntity: { name: "Филип Стенгер", type: "npc" },
								relationshipType: "управляет",
								properties: {},
							},
						],
					},
				],
				loadTimeMs: 12,
			};

			const result = formatWorldKnowledgeForLLM(context);
			expect(result).toContain("Локация: Велен");
			expect(result).toContain("- Связан с: Филип Стенгер → управляет");
		});

		it("should format multiple entities", () => {
			const context: WorldKnowledgeContext = {
				entities: [
					{
						id: 1,
						type: "location",
						name: "Велен",
						properties: { type: "город" },
						outgoingRelationships: [],
						incomingRelationships: [],
					},
					{
						id: 2,
						type: "npc",
						name: "Иван",
						properties: { occupation: "торговец" },
						outgoingRelationships: [],
						incomingRelationships: [],
					},
				],
				loadTimeMs: 20,
			};

			const result = formatWorldKnowledgeForLLM(context);
			expect(result).toContain("Локация: Велен");
			expect(result).toContain("NPC: Иван");
		});

		it("should handle array property values", () => {
			const context: WorldKnowledgeContext = {
				entities: [
					{
						id: 1,
						type: "faction",
						name: "Гильдия Торговцев",
						properties: {
							members: ["Иван", "Петр", "Мария"],
						},
						outgoingRelationships: [],
						incomingRelationships: [],
					},
				],
				loadTimeMs: 8,
			};

			const result = formatWorldKnowledgeForLLM(context);
			expect(result).toContain("Фракция: Гильдия Торговцев");
			expect(result).toContain("- members: Иван, Петр, Мария");
		});

		it("should skip aliases property", () => {
			const context: WorldKnowledgeContext = {
				entities: [
					{
						id: 1,
						type: "npc",
						name: "Иван",
						properties: {
							occupation: "торговец",
							aliases: ["торговец", "Иван Торговец"],
						},
						outgoingRelationships: [],
						incomingRelationships: [],
					},
				],
				loadTimeMs: 5,
			};

			const result = formatWorldKnowledgeForLLM(context);
			expect(result).toContain("- occupation: торговец");
			expect(result).not.toContain("aliases");
		});
	});
});
