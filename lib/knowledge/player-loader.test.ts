/**
 * Player Loader Tests
 */

import { describe, expect, it } from "vitest";
import {
	type PlayerKnowledgeContext,
	formatPlayerKnowledgeForLLM,
} from "./player-loader";

describe("Player Loader", () => {
	describe("formatPlayerKnowledgeForLLM", () => {
		it("should return empty string for empty context", () => {
			const context: PlayerKnowledgeContext = {
				knownEntities: [],
				loadTimeMs: 0,
			};

			const result = formatPlayerKnowledgeForLLM(context);
			expect(result).toBe("");
		});

		it("should format entity with heard_of awareness level", () => {
			const context: PlayerKnowledgeContext = {
				knownEntities: [
					{
						entity: {
							id: 1,
							name: "Филип Стенгер",
							type: "npc",
						},
						awarenessLevel: "heard_of",
						knownFacts: [
							{
								property: "Имя",
								value: "Филип Стенгер",
								learnedAt: 15,
								source: "heard_from_npc",
							},
							{
								property: "Занятие",
								value: "мэр",
								learnedAt: 15,
								source: "heard_from_npc",
							},
						],
					},
				],
				loadTimeMs: 10,
			};

			const result = formatPlayerKnowledgeForLLM(context);
			expect(result).toContain("=== PLAYER CHARACTER KNOWLEDGE ===");
			expect(result).toContain("Что персонаж ЗНАЕТ:");
			expect(result).toContain("Филип Стенгер:");
			expect(result).toContain("- Уровень знакомства: слышал о нём");
			expect(result).toContain('Имя: "Филип Стенгер"');
			expect(result).toContain("узнал: ход 15");
			expect(result).toContain("источник: услышал от NPC");
		});

		it("should format entity with met awareness level", () => {
			const context: PlayerKnowledgeContext = {
				knownEntities: [
					{
						entity: {
							id: 2,
							name: "Велен",
							type: "location",
						},
						awarenessLevel: "met",
						knownFacts: [
							{
								property: "Название",
								value: "Велен",
								learnedAt: 12,
								source: "arrived",
							},
							{
								property: "Тип",
								value: "город",
								learnedAt: 12,
								source: "observation",
							},
							{
								property: "Размер",
								value: "большой",
								learnedAt: 12,
								source: "observation",
							},
						],
					},
				],
				loadTimeMs: 15,
			};

			const result = formatPlayerKnowledgeForLLM(context);
			expect(result).toContain("Велен:");
			expect(result).toContain("- Уровень знакомства: встречал");
			expect(result).toContain('Название: "Велен"');
			expect(result).toContain("источник: прибыл");
			expect(result).toContain("источник: наблюдение");
		});

		it("should format entity with familiar awareness level", () => {
			const context: PlayerKnowledgeContext = {
				knownEntities: [
					{
						entity: {
							id: 3,
							name: "Меч Света",
							type: "item",
						},
						awarenessLevel: "familiar",
						knownFacts: [
							{
								property: "Название",
								value: "Меч Света",
								learnedAt: 20,
								source: "owns",
							},
							{
								property: "Урон",
								value: "1d8+2",
								learnedAt: 21,
								source: "used",
							},
						],
					},
				],
				loadTimeMs: 8,
			};

			const result = formatPlayerKnowledgeForLLM(context);
			expect(result).toContain("Меч Света:");
			expect(result).toContain("- Уровень знакомства: хорошо знаком");
			expect(result).toContain("источник: владеет");
			expect(result).toContain("источник: использовал");
		});

		it("should format entity with confidence levels", () => {
			const context: PlayerKnowledgeContext = {
				knownEntities: [
					{
						entity: {
							id: 4,
							name: "Древний Храм",
							type: "location",
						},
						awarenessLevel: "heard_of",
						knownFacts: [
							{
								property: "Местоположение",
								value: "к северу от города",
								learnedAt: 18,
								source: "heard_from_npc",
								confidence: "certain",
							},
							{
								property: "Опасность",
								value: "высокая",
								learnedAt: 18,
								source: "heard_from_npc",
								confidence: "likely",
							},
							{
								property: "Сокровища",
								value: "золото и артефакты",
								learnedAt: 19,
								source: "heard_from_npc",
								confidence: "rumor",
							},
						],
					},
				],
				loadTimeMs: 12,
			};

			const result = formatPlayerKnowledgeForLLM(context);
			expect(result).toContain("Древний Храм:");
			expect(result).toContain("(уверен)");
			expect(result).toContain("(вероятно)");
			expect(result).toContain("(слух)");
		});

		it("should format entity with no facts", () => {
			const context: PlayerKnowledgeContext = {
				knownEntities: [
					{
						entity: {
							id: 5,
							name: "Таинственный Незнакомец",
							type: "npc",
						},
						awarenessLevel: "heard_of",
						knownFacts: [],
					},
				],
				loadTimeMs: 5,
			};

			const result = formatPlayerKnowledgeForLLM(context);
			expect(result).toContain("Таинственный Незнакомец:");
			expect(result).toContain("- Уровень знакомства: слышал о нём");
			expect(result).toContain("- Известные факты: нет");
		});

		it("should format multiple entities", () => {
			const context: PlayerKnowledgeContext = {
				knownEntities: [
					{
						entity: {
							id: 1,
							name: "Велен",
							type: "location",
						},
						awarenessLevel: "met",
						knownFacts: [
							{
								property: "Тип",
								value: "город",
								learnedAt: 12,
								source: "observation",
							},
						],
					},
					{
						entity: {
							id: 2,
							name: "Иван",
							type: "npc",
						},
						awarenessLevel: "familiar",
						knownFacts: [
							{
								property: "Занятие",
								value: "торговец",
								learnedAt: 13,
								source: "met_personally",
							},
						],
					},
				],
				loadTimeMs: 20,
			};

			const result = formatPlayerKnowledgeForLLM(context);
			expect(result).toContain("Велен:");
			expect(result).toContain("Иван:");
			expect(result).toContain("встречал");
			expect(result).toContain("хорошо знаком");
		});

		it("should format facts with different value types", () => {
			const context: PlayerKnowledgeContext = {
				knownEntities: [
					{
						entity: {
							id: 6,
							name: "Магический Кристалл",
							type: "item",
						},
						awarenessLevel: "familiar",
						knownFacts: [
							{
								property: "Название",
								value: "Магический Кристалл",
								learnedAt: 25,
								source: "owns",
							},
							{
								property: "Заряды",
								value: 5,
								learnedAt: 25,
								source: "observation",
							},
							{
								property: "Активен",
								value: true,
								learnedAt: 26,
								source: "used",
							},
						],
					},
				],
				loadTimeMs: 10,
			};

			const result = formatPlayerKnowledgeForLLM(context);
			expect(result).toContain('Название: "Магический Кристалл"');
			expect(result).toContain("Заряды: 5");
			expect(result).toContain("Активен: true");
		});

		it("should format facts read from books", () => {
			const context: PlayerKnowledgeContext = {
				knownEntities: [
					{
						entity: {
							id: 7,
							name: "Драконы",
							type: "faction",
						},
						awarenessLevel: "heard_of",
						knownFacts: [
							{
								property: "История",
								value: "древние существа",
								learnedAt: 30,
								source: "read_in_book",
							},
						],
					},
				],
				loadTimeMs: 7,
			};

			const result = formatPlayerKnowledgeForLLM(context);
			expect(result).toContain("Драконы:");
			expect(result).toContain("источник: прочитал в книге");
		});
	});
});
