import { describe, expect, it } from "vitest";
import {
	generateAbilityScores,
	generateAbilityScoresForClass,
	roll4d6DropLowest,
	scoreToModifier,
} from "./ability-scores";

describe("Ability Score Generation", () => {
	describe("roll4d6DropLowest", () => {
		it("should return a value between 3 and 18", () => {
			for (let i = 0; i < 100; i++) {
				const result = roll4d6DropLowest();
				expect(result).toBeGreaterThanOrEqual(3);
				expect(result).toBeLessThanOrEqual(18);
			}
		});

		it("should have reasonable distribution (mostly 8-15)", () => {
			const results: number[] = [];
			for (let i = 0; i < 1000; i++) {
				results.push(roll4d6DropLowest());
			}
			const avg = results.reduce((a, b) => a + b, 0) / results.length;
			// 4d6 drop lowest has average around 12-13
			expect(avg).toBeGreaterThan(11);
			expect(avg).toBeLessThan(14);
		});
	});

	describe("scoreToModifier", () => {
		it("should convert score 10-11 to +0", () => {
			expect(scoreToModifier(10)).toBe(0);
			expect(scoreToModifier(11)).toBe(0);
		});

		it("should convert score 8-9 to -1", () => {
			expect(scoreToModifier(8)).toBe(-1);
			expect(scoreToModifier(9)).toBe(-1);
		});

		it("should convert score 12-13 to +1", () => {
			expect(scoreToModifier(12)).toBe(1);
			expect(scoreToModifier(13)).toBe(1);
		});

		it("should convert score 18-19 to +4", () => {
			expect(scoreToModifier(18)).toBe(4);
			expect(scoreToModifier(19)).toBe(4);
		});

		it("should convert score 3 to -4", () => {
			expect(scoreToModifier(3)).toBe(-4);
		});

		it("should convert score 20 to +5", () => {
			expect(scoreToModifier(20)).toBe(5);
		});
	});

	describe("generateAbilityScores", () => {
		it("should generate 6 ability scores", () => {
			const result = generateAbilityScores();
			expect(result.scores).toHaveProperty("str");
			expect(result.scores).toHaveProperty("dex");
			expect(result.scores).toHaveProperty("con");
			expect(result.scores).toHaveProperty("int");
			expect(result.scores).toHaveProperty("wis");
			expect(result.scores).toHaveProperty("cha");
		});

		it("should generate 6 modifiers", () => {
			const result = generateAbilityScores();
			expect(result.modifiers).toHaveProperty("str");
			expect(result.modifiers).toHaveProperty("dex");
			expect(result.modifiers).toHaveProperty("con");
			expect(result.modifiers).toHaveProperty("int");
			expect(result.modifiers).toHaveProperty("wis");
			expect(result.modifiers).toHaveProperty("cha");
		});

		it("should have all scores in valid range", () => {
			const result = generateAbilityScores();
			for (const score of Object.values(result.scores)) {
				expect(score).toBeGreaterThanOrEqual(3);
				expect(score).toBeLessThanOrEqual(18);
			}
		});

		it("should have modifiers matching scores", () => {
			const result = generateAbilityScores();
			expect(result.modifiers.str).toBe(scoreToModifier(result.scores.str));
			expect(result.modifiers.dex).toBe(scoreToModifier(result.scores.dex));
			expect(result.modifiers.con).toBe(scoreToModifier(result.scores.con));
			expect(result.modifiers.int).toBe(scoreToModifier(result.scores.int));
			expect(result.modifiers.wis).toBe(scoreToModifier(result.scores.wis));
			expect(result.modifiers.cha).toBe(scoreToModifier(result.scores.cha));
		});
	});

	describe("generateAbilityScoresForClass", () => {
		it("should prioritize STR for warrior classes", () => {
			const warrior = generateAbilityScoresForClass("Воин");
			const barbarian = generateAbilityScoresForClass("Барбар");

			// STR should be among the highest scores
			const warriorScores = Object.values(warrior.scores);
			const barbarianScores = Object.values(barbarian.scores);

			const warriorMax = Math.max(...warriorScores);
			const barbarianMax = Math.max(...barbarianScores);

			// STR should be the highest or second highest
			expect(warrior.scores.str).toBeGreaterThanOrEqual(warriorMax - 3);
			expect(barbarian.scores.str).toBeGreaterThanOrEqual(barbarianMax - 3);
		});

		it("should prioritize DEX for rogue classes", () => {
			const rogue = generateAbilityScoresForClass("Вор");

			const scores = Object.values(rogue.scores);
			const max = Math.max(...scores);

			// DEX should be the highest or second highest
			expect(rogue.scores.dex).toBeGreaterThanOrEqual(max - 3);
		});

		it("should prioritize INT for wizard classes", () => {
			const wizard = generateAbilityScoresForClass("Маг");

			const scores = Object.values(wizard.scores);
			const max = Math.max(...scores);

			// INT should be the highest or second highest
			expect(wizard.scores.int).toBeGreaterThanOrEqual(max - 3);
		});

		it("should prioritize WIS for cleric classes", () => {
			const cleric = generateAbilityScoresForClass("Жрец");

			const scores = Object.values(cleric.scores);
			const max = Math.max(...scores);

			// WIS should be the highest or second highest
			expect(cleric.scores.wis).toBeGreaterThanOrEqual(max - 3);
		});

		it("should prioritize CHA for bard classes", () => {
			const bard = generateAbilityScoresForClass("Бард");

			const scores = Object.values(bard.scores);
			const max = Math.max(...scores);

			// CHA should be the highest or second highest
			expect(bard.scores.cha).toBeGreaterThanOrEqual(max - 3);
		});

		it("should handle unknown class with balanced distribution", () => {
			const result = generateAbilityScoresForClass("Неизвестный класс");

			// Should still generate valid scores
			for (const score of Object.values(result.scores)) {
				expect(score).toBeGreaterThanOrEqual(3);
				expect(score).toBeLessThanOrEqual(18);
			}
		});

		it("should generate different scores on multiple calls", () => {
			const result1 = generateAbilityScoresForClass("Воин");
			const result2 = generateAbilityScoresForClass("Воин");

			// Very unlikely to be identical
			const same =
				result1.scores.str === result2.scores.str &&
				result1.scores.dex === result2.scores.dex &&
				result1.scores.con === result2.scores.con &&
				result1.scores.int === result2.scores.int &&
				result1.scores.wis === result2.scores.wis &&
				result1.scores.cha === result2.scores.cha;

			expect(same).toBe(false);
		});
	});
});
