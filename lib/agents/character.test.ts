import { describe, expect, it } from "vitest";

// Unit tests for character logic without DB
describe("character agent logic", () => {
	describe("skill to ability mapping", () => {
		const skillAbilityMap: Record<string, string> = {
			athletics: "str",
			acrobatics: "dex",
			stealth: "dex",
			sleight_of_hand: "dex",
			perception: "wis",
			survival: "wis",
			insight: "wis",
			investigation: "int",
			arcana: "int",
			history: "int",
			nature: "int",
			religion: "int",
			persuasion: "cha",
			deception: "cha",
			intimidation: "cha",
			performance: "cha",
		};

		it("should map physical skills to correct abilities", () => {
			expect(skillAbilityMap.athletics).toBe("str");
			expect(skillAbilityMap.acrobatics).toBe("dex");
			expect(skillAbilityMap.stealth).toBe("dex");
		});

		it("should map mental skills to correct abilities", () => {
			expect(skillAbilityMap.investigation).toBe("int");
			expect(skillAbilityMap.arcana).toBe("int");
			expect(skillAbilityMap.perception).toBe("wis");
		});

		it("should map social skills to charisma", () => {
			expect(skillAbilityMap.persuasion).toBe("cha");
			expect(skillAbilityMap.deception).toBe("cha");
			expect(skillAbilityMap.intimidation).toBe("cha");
			expect(skillAbilityMap.performance).toBe("cha");
		});
	});

	describe("modifier calculation logic", () => {
		it("should calculate total modifier from components", () => {
			const ability = 3;
			const skill = 2;
			const equipment = 1;
			const temporary = 1;
			const total = ability + skill + equipment + temporary;

			expect(total).toBe(7);
		});

		it("should handle zero modifiers", () => {
			const total = 0 + 0 + 0 + 0;
			expect(total).toBe(0);
		});

		it("should handle negative modifiers", () => {
			const ability = -2;
			const skill = 1;
			const equipment = 0;
			const temporary = -1;
			const total = ability + skill + equipment + temporary;

			expect(total).toBe(-2);
		});
	});

	describe("ability score to modifier conversion", () => {
		// D&D 5e standard: (score - 10) / 2, rounded down
		function abilityToModifier(score: number): number {
			return Math.floor((score - 10) / 2);
		}

		it("should convert standard ability scores", () => {
			expect(abilityToModifier(10)).toBe(0);
			expect(abilityToModifier(12)).toBe(1);
			expect(abilityToModifier(14)).toBe(2);
			expect(abilityToModifier(16)).toBe(3);
			expect(abilityToModifier(18)).toBe(4);
			expect(abilityToModifier(20)).toBe(5);
		});

		it("should handle low ability scores", () => {
			expect(abilityToModifier(8)).toBe(-1);
			expect(abilityToModifier(6)).toBe(-2);
			expect(abilityToModifier(3)).toBe(-4);
		});

		it("should handle odd ability scores", () => {
			expect(abilityToModifier(11)).toBe(0);
			expect(abilityToModifier(13)).toBe(1);
			expect(abilityToModifier(15)).toBe(2);
		});
	});
});
