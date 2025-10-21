import { describe, expect, it } from "vitest";
import {
	type Modifiers,
	applyModifiers,
	classifyD20,
	performSkillCheck,
	rollD20,
} from "./dice";

describe("dice mechanics", () => {
	describe("classifyD20", () => {
		it("should classify 1 as CRIT_FAIL", () => {
			expect(classifyD20(1, 15)).toBe("CRIT_FAIL");
		});

		it("should classify 20 as CRIT_SUCCESS", () => {
			expect(classifyD20(20, 25)).toBe("CRIT_SUCCESS");
		});

		it("should use legacy logic without DC", () => {
			expect(classifyD20(2, 8)).toBe("FAIL");
			expect(classifyD20(5, 9)).toBe("FAIL");
			expect(classifyD20(10, 10)).toBe("SUCCESS");
			expect(classifyD20(15, 15)).toBe("SUCCESS");
		});

		it("should use DC-based logic when DC provided", () => {
			expect(classifyD20(10, 15, 20)).toBe("FAIL"); // 15 < 20
			expect(classifyD20(10, 20, 20)).toBe("SUCCESS"); // 20 >= 20
			expect(classifyD20(5, 18, 15)).toBe("SUCCESS"); // 18 >= 15
		});

		it("should handle critical results with DC", () => {
			expect(classifyD20(1, 25, 10)).toBe("CRIT_FAIL"); // Always fail on 1
			expect(classifyD20(20, 22, 25)).toBe("CRIT_SUCCESS"); // Always success on 20
		});
	});

	describe("applyModifiers", () => {
		it("should apply all modifiers correctly", () => {
			const mods: Modifiers = {
				ability: 3,
				skill: 2,
				equipment: 1,
				temporary: 1,
			};
			const result = applyModifiers(10, mods);

			expect(result.roll).toBe(10);
			expect(result.modified).toBe(17); // 10 + 3 + 2 + 1 + 1
			expect(result.category).toBe("SUCCESS");
			expect(result.modifierBreakdown.total).toBe(7);
		});

		it("should handle zero modifiers", () => {
			const mods: Modifiers = {
				ability: 0,
				skill: 0,
				equipment: 0,
				temporary: 0,
			};
			const result = applyModifiers(15, mods);

			expect(result.roll).toBe(15);
			expect(result.modified).toBe(15);
			expect(result.modifierBreakdown.total).toBe(0);
		});

		it("should handle negative modifiers", () => {
			const mods: Modifiers = {
				ability: -2,
				skill: 1,
				equipment: 0,
				temporary: -1,
			};
			const result = applyModifiers(12, mods);

			expect(result.roll).toBe(12);
			expect(result.modified).toBe(10); // 12 - 2 + 1 - 1
			expect(result.modifierBreakdown.total).toBe(-2);
		});

		it("should preserve critical roll classification", () => {
			const mods: Modifiers = {
				ability: 5,
				skill: 5,
				equipment: 5,
				temporary: 5,
			};

			const crit20 = applyModifiers(20, mods);
			expect(crit20.category).toBe("CRIT_SUCCESS");
			expect(crit20.modified).toBe(40);

			const crit1 = applyModifiers(1, mods);
			expect(crit1.category).toBe("CRIT_FAIL");
			expect(crit1.modified).toBe(21);
		});
	});

	describe("rollD20", () => {
		it("should return value between 1 and 20", () => {
			for (let i = 0; i < 100; i++) {
				const roll = rollD20();
				expect(roll).toBeGreaterThanOrEqual(1);
				expect(roll).toBeLessThanOrEqual(20);
			}
		});

		it("should use custom random function", () => {
			const mockRandom = () => 0; // Always returns 0
			const roll = rollD20(mockRandom);
			expect(roll).toBe(1); // floor(0 * 20) + 1 = 1
		});

		it("should handle edge case random values", () => {
			const roll19 = rollD20(() => 0.95); // floor(0.95 * 20) + 1 = 20
			expect(roll19).toBe(20);

			const roll1 = rollD20(() => 0.01); // floor(0.01 * 20) + 1 = 1
			expect(roll1).toBe(1);
		});
	});

	describe("performSkillCheck", () => {
		it("should perform complete skill check with success", () => {
			const mods: Modifiers = {
				ability: 3,
				skill: 2,
				equipment: 1,
				temporary: 0,
			};
			const result = performSkillCheck(12, mods, 15);

			expect(result.roll).toBe(12);
			expect(result.modified).toBe(18); // 12 + 3 + 2 + 1
			expect(result.dc).toBe(15);
			expect(result.success).toBe(true); // 18 >= 15
			expect(result.margin).toBe(3); // 18 - 15
			expect(result.critical).toBe(false);
			expect(result.category).toBe("SUCCESS");
		});

		it("should handle critical success", () => {
			const mods: Modifiers = {
				ability: 0,
				skill: 0,
				equipment: 0,
				temporary: 0,
			};
			const result = performSkillCheck(20, mods, 25);

			expect(result.roll).toBe(20);
			expect(result.modified).toBe(20);
			expect(result.success).toBe(true); // Critical success always succeeds
			expect(result.critical).toBe(true);
			expect(result.category).toBe("CRIT_SUCCESS");
		});

		it("should handle critical failure", () => {
			const mods: Modifiers = {
				ability: 10,
				skill: 5,
				equipment: 3,
				temporary: 2,
			};
			const result = performSkillCheck(1, mods, 5);

			expect(result.roll).toBe(1);
			expect(result.modified).toBe(21); // 1 + 20
			expect(result.success).toBe(false); // Critical failure always fails
			expect(result.critical).toBe(true);
			expect(result.category).toBe("CRIT_FAIL");
		});

		it("should handle regular failure", () => {
			const mods: Modifiers = {
				ability: 1,
				skill: 1,
				equipment: 0,
				temporary: 0,
			};
			const result = performSkillCheck(8, mods, 15);

			expect(result.roll).toBe(8);
			expect(result.modified).toBe(10); // 8 + 2
			expect(result.success).toBe(false); // 10 < 15
			expect(result.margin).toBe(-5); // 10 - 15
			expect(result.critical).toBe(false);
			expect(result.category).toBe("FAIL");
		});
	});
});
