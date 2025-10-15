export type DiceCategory = "CRIT_FAIL" | "FAIL" | "SUCCESS" | "CRIT_SUCCESS";

export interface Modifiers {
	ability: number;
	skill: number;
	equipment: number;
	temporary: number;
}

export interface DiceResult {
	roll: number;
	modified: number;
	category: DiceCategory;
	modifierBreakdown: Modifiers & { total: number };
}

export function classifyD20(roll: number): DiceCategory {
	if (roll === 1) return "CRIT_FAIL";
	if (roll === 20) return "CRIT_SUCCESS";
	return roll < 10 ? "FAIL" : "SUCCESS";
}

export function applyModifiers(roll: number, mods: Modifiers): DiceResult {
	const total =
		(mods.ability ?? 0) +
		(mods.skill ?? 0) +
		(mods.equipment ?? 0) +
		(mods.temporary ?? 0);
	const modified = roll + total;
	const baseCat = classifyD20(roll);
	return {
		roll,
		modified,
		category: baseCat,
		modifierBreakdown: { ...mods, total },
	};
}

export function rollD20(random: () => number = Math.random): number {
	return Math.floor(random() * 20) + 1;
}
