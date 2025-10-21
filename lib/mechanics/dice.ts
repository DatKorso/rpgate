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

export function classifyD20(
	roll: number,
	modifiedTotal: number,
	dc?: number,
): DiceCategory {
	// Критические результаты определяются только натуральным броском
	if (roll === 1) return "CRIT_FAIL";
	if (roll === 20) return "CRIT_SUCCESS";

	// Если DC не указан, используем старую логику для обратной совместимости
	if (dc === undefined) {
		return modifiedTotal < 10 ? "FAIL" : "SUCCESS";
	}

	// Правильная логика: сравниваем модифицированный результат с DC
	return modifiedTotal >= dc ? "SUCCESS" : "FAIL";
}

export function applyModifiers(
	roll: number,
	mods: Modifiers,
	dc?: number,
): DiceResult {
	const total =
		(mods.ability ?? 0) +
		(mods.skill ?? 0) +
		(mods.equipment ?? 0) +
		(mods.temporary ?? 0);
	const modified = roll + total;
	const baseCat = classifyD20(roll, modified, dc);
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

export interface SkillCheckResult extends DiceResult {
	dc: number;
	success: boolean;
	margin: number;
	critical: boolean;
}

/**
 * Выполняет полную проверку навыка с учетом DC
 * Возвращает детальный результат включая успех/провал
 */
export function performSkillCheck(
	roll: number,
	modifiers: Modifiers,
	dc: number,
): SkillCheckResult {
	const diceResult = applyModifiers(roll, modifiers, dc);
	const critical = roll === 1 || roll === 20;

	// Логика успеха: критический успех (20) всегда успех,
	// критический провал (1) всегда провал, иначе сравниваем с DC
	const success = critical ? roll === 20 : diceResult.modified >= dc;

	const margin = diceResult.modified - dc;

	return {
		...diceResult,
		dc,
		success,
		margin,
		critical,
	};
}
