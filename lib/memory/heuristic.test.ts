import type { ChatHistoryEntry } from "@/lib/agents/protocol";
import { describe, expect, it } from "vitest";
import { analyzeMemoryNeed } from "./heuristic";

describe("analyzeMemoryNeed", () => {
	describe("explicit_request trigger", () => {
		it("should detect 'помнишь' trigger", () => {
			const result = analyzeMemoryNeed("Помнишь ту таверну?", []);
			expect(result.shouldRetrieve).toBe(true);
			expect(result.triggers).toContain("explicit_request");
			expect(result.confidence).toBe(1.0);
		});

		it("should detect 'вспомни' trigger", () => {
			const result = analyzeMemoryNeed("Вспомни, что случилось в лесу", []);
			expect(result.shouldRetrieve).toBe(true);
			expect(result.triggers).toContain("explicit_request");
			expect(result.confidence).toBe(1.0);
		});

		it("should detect 'расскажи о' trigger", () => {
			const result = analyzeMemoryNeed("Расскажи о том драконе", []);
			expect(result.shouldRetrieve).toBe(true);
			expect(result.triggers).toContain("explicit_request");
			expect(result.confidence).toBe(1.0);
		});

		it("should detect 'напомни' trigger", () => {
			const result = analyzeMemoryNeed("Напомни мне про квест", []);
			expect(result.shouldRetrieve).toBe(true);
			expect(result.triggers).toContain("explicit_request");
			expect(result.confidence).toBe(1.0);
		});
	});

	describe("location_return trigger", () => {
		it("should detect 'вернулся в' trigger", () => {
			const result = analyzeMemoryNeed("Я вернулся в город", []);
			expect(result.shouldRetrieve).toBe(true);
			expect(result.triggers).toContain("location_return");
		});

		it("should detect 'иду на' trigger", () => {
			const result = analyzeMemoryNeed("Иду на рынок", []);
			expect(result.shouldRetrieve).toBe(true);
			expect(result.triggers).toContain("location_return");
		});

		it("should detect 'возвращаюсь к' trigger", () => {
			const result = analyzeMemoryNeed("Возвращаюсь к старому дому", []);
			expect(result.shouldRetrieve).toBe(true);
			expect(result.triggers).toContain("location_return");
		});

		it("should detect 'прибываю в' trigger", () => {
			const result = analyzeMemoryNeed("Прибываю в таверну", []);
			expect(result.shouldRetrieve).toBe(true);
			expect(result.triggers).toContain("location_return");
		});
	});

	describe("past_question trigger", () => {
		it("should detect 'что было' trigger", () => {
			const result = analyzeMemoryNeed("Что было в той пещере?", []);
			expect(result.shouldRetrieve).toBe(true);
			expect(result.triggers).toContain("past_question");
			expect(result.confidence).toBe(0.8);
		});

		it("should detect 'где я был' trigger", () => {
			const result = analyzeMemoryNeed("Где я был вчера?", []);
			expect(result.shouldRetrieve).toBe(true);
			expect(result.triggers).toContain("past_question");
		});

		it("should detect 'когда мы' trigger", () => {
			const result = analyzeMemoryNeed("Когда мы встречали того торговца?", []);
			expect(result.shouldRetrieve).toBe(true);
			expect(result.triggers).toContain("past_question");
		});

		it("should detect 'как я попал' trigger", () => {
			const result = analyzeMemoryNeed("Как я попал в этот город?", []);
			expect(result.shouldRetrieve).toBe(true);
			expect(result.triggers).toContain("past_question");
		});
	});

	describe("npc_mention trigger", () => {
		it("should detect 'кто такой' trigger", () => {
			const result = analyzeMemoryNeed("Кто такой Артур?", []);
			expect(result.shouldRetrieve).toBe(true);
			expect(result.triggers).toContain("npc_mention");
		});

		it("should detect 'где находится' trigger", () => {
			const result = analyzeMemoryNeed("Где находится кузнец?", []);
			expect(result.shouldRetrieve).toBe(true);
			expect(result.triggers).toContain("npc_mention");
		});

		it("should detect 'что за человек' trigger", () => {
			const result = analyzeMemoryNeed("Что за человек этот маг?", []);
			expect(result.shouldRetrieve).toBe(true);
			expect(result.triggers).toContain("npc_mention");
		});
	});

	describe("unknown_entity trigger", () => {
		it("should detect unknown entity not in recent context", () => {
			const recentContext: ChatHistoryEntry[] = [
				{ role: "player", content: "Я иду в лес" },
				{ role: "gm", content: "Ты входишь в темный лес" },
			];
			const result = analyzeMemoryNeed(
				"Я возвращаюсь в таверну Золотой Дракон",
				recentContext,
			);
			expect(result.shouldRetrieve).toBe(true);
			expect(result.triggers).toContain("unknown_entity");
			expect(result.entities).toContain("Золотой");
			expect(result.entities).toContain("Дракон");
		});

		it("should not trigger for known entity in recent context", () => {
			const recentContext: ChatHistoryEntry[] = [
				{
					role: "gm",
					content: "Ты находишься в таверне Золотой Дракон",
				},
				{ role: "player", content: "Я осматриваюсь" },
			];
			const result = analyzeMemoryNeed(
				"Я остаюсь в таверне Золотой Дракон",
				recentContext,
			);
			expect(result.triggers).not.toContain("unknown_entity");
		});

		it("should have confidence 0.6 for unknown entity only", () => {
			const recentContext: ChatHistoryEntry[] = [];
			const result = analyzeMemoryNeed("Я ищу Артура", []);
			expect(result.confidence).toBe(0.6);
			expect(result.shouldRetrieve).toBe(true);
		});
	});

	describe("entity extraction", () => {
		it("should extract location with marker", () => {
			const result = analyzeMemoryNeed("Иду в город Каменный Брод", []);
			expect(result.entities).toContain("Каменный");
			expect(result.entities).toContain("Брод");
		});

		it("should extract tavern name", () => {
			const result = analyzeMemoryNeed(
				"Возвращаюсь в таверну Золотой Дракон",
				[],
			);
			expect(result.entities).toContain("Золотой");
			expect(result.entities).toContain("Дракон");
		});

		it("should extract capitalized words not at sentence start", () => {
			const result = analyzeMemoryNeed("Я встречаю Артура в лесу", []);
			expect(result.entities).toContain("Артура");
		});

		it("should not extract first word of sentence", () => {
			const result = analyzeMemoryNeed("Артур идет по дороге", []);
			expect(result.entities).not.toContain("Артур");
		});

		it("should extract multiple location types", () => {
			const result = analyzeMemoryNeed(
				"Иду из деревни Светлая в замок Темный",
				[],
			);
			expect(result.entities).toContain("Светлая");
			expect(result.entities).toContain("Темный");
		});
	});

	describe("confidence scoring", () => {
		it("should return 1.0 for explicit request", () => {
			const result = analyzeMemoryNeed("Помнишь ту битву?", []);
			expect(result.confidence).toBe(1.0);
		});

		it("should return 0.9 for location_return + unknown_entity", () => {
			const result = analyzeMemoryNeed(
				"Возвращаюсь в таверну Золотой Дракон",
				[],
			);
			expect(result.confidence).toBe(0.9);
		});

		it("should return 0.8 for past_question", () => {
			const result = analyzeMemoryNeed("Что было в пещере?", []);
			expect(result.confidence).toBe(0.8);
		});

		it("should return 0.7 for location_return without unknown entity", () => {
			const recentContext: ChatHistoryEntry[] = [
				{ role: "gm", content: "Ты в городе Каменный Брод" },
			];
			const result = analyzeMemoryNeed(
				"Иду в город Каменный Брод",
				recentContext,
			);
			expect(result.confidence).toBe(0.7);
		});

		it("should return 0.6 for unknown_entity only", () => {
			const result = analyzeMemoryNeed("Я ищу Артура", []);
			expect(result.confidence).toBe(0.6);
		});
	});

	describe("edge cases", () => {
		it("should handle empty input", () => {
			const result = analyzeMemoryNeed("", []);
			expect(result.shouldRetrieve).toBe(false);
			expect(result.triggers).toHaveLength(0);
			expect(result.entities).toHaveLength(0);
			expect(result.confidence).toBe(0.0);
		});

		it("should handle whitespace only input", () => {
			const result = analyzeMemoryNeed("   ", []);
			expect(result.shouldRetrieve).toBe(false);
			expect(result.confidence).toBe(0.0);
		});

		it("should handle punctuation only input", () => {
			const result = analyzeMemoryNeed("...", []);
			expect(result.shouldRetrieve).toBe(false);
			expect(result.triggers).toHaveLength(0);
		});

		it("should handle input with no triggers", () => {
			const result = analyzeMemoryNeed("Я иду налево", []);
			expect(result.shouldRetrieve).toBe(false);
			expect(result.confidence).toBe(0.0);
		});

		it("should handle case-insensitive matching", () => {
			const result = analyzeMemoryNeed("ПОМНИШЬ ту таверну?", []);
			expect(result.triggers).toContain("explicit_request");
		});

		it("should remove duplicate triggers", () => {
			const result = analyzeMemoryNeed("Помнишь? Вспомни!", []);
			expect(
				result.triggers.filter((t) => t === "explicit_request"),
			).toHaveLength(1);
		});

		it("should remove duplicate entities", () => {
			const result = analyzeMemoryNeed(
				"Артур встречает Артура. Артур говорит",
				[],
			);
			const arturaCount = result.entities.filter((e) => e === "Артура").length;
			expect(arturaCount).toBe(1);
		});
	});
});
