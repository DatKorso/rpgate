/**
 * Ability score generation for D&D-style character creation
 */

/**
 * Roll 4d6, drop lowest, sum the rest
 * This is the standard D&D method for generating ability scores
 */
export function roll4d6DropLowest(): number {
	const rolls = [
		Math.floor(Math.random() * 6) + 1,
		Math.floor(Math.random() * 6) + 1,
		Math.floor(Math.random() * 6) + 1,
		Math.floor(Math.random() * 6) + 1,
	];

	// Sort descending and take top 3
	rolls.sort((a, b) => b - a);
	return rolls[0] + rolls[1] + rolls[2];
}

/**
 * Convert ability score (3-18) to modifier (-4 to +4)
 * D&D 5e formula: (score - 10) / 2, rounded down
 */
export function scoreToModifier(score: number): number {
	return Math.floor((score - 10) / 2);
}

/**
 * Generate a full set of ability scores using 4d6 drop lowest
 * Returns both raw scores and modifiers
 */
export function generateAbilityScores(): {
	scores: {
		str: number;
		dex: number;
		con: number;
		int: number;
		wis: number;
		cha: number;
	};
	modifiers: {
		str: number;
		dex: number;
		con: number;
		int: number;
		wis: number;
		cha: number;
	};
} {
	const str = roll4d6DropLowest();
	const dex = roll4d6DropLowest();
	const con = roll4d6DropLowest();
	const int = roll4d6DropLowest();
	const wis = roll4d6DropLowest();
	const cha = roll4d6DropLowest();

	return {
		scores: { str, dex, con, int, wis, cha },
		modifiers: {
			str: scoreToModifier(str),
			dex: scoreToModifier(dex),
			con: scoreToModifier(con),
			int: scoreToModifier(int),
			wis: scoreToModifier(wis),
			cha: scoreToModifier(cha),
		},
	};
}

/**
 * Generate ability scores with class-based optimization
 * Assigns highest rolls to primary abilities for the class
 */
export function generateAbilityScoresForClass(className: string): {
	scores: {
		str: number;
		dex: number;
		con: number;
		int: number;
		wis: number;
		cha: number;
	};
	modifiers: {
		str: number;
		dex: number;
		con: number;
		int: number;
		wis: number;
		cha: number;
	};
} {
	// Roll 6 scores
	const rolls = [
		roll4d6DropLowest(),
		roll4d6DropLowest(),
		roll4d6DropLowest(),
		roll4d6DropLowest(),
		roll4d6DropLowest(),
		roll4d6DropLowest(),
	];

	// Sort descending to assign best scores to primary abilities
	rolls.sort((a, b) => b - a);

	// Determine primary abilities based on class
	const classLower = className.toLowerCase();
	let abilityOrder: Array<"str" | "dex" | "con" | "int" | "wis" | "cha">;

	if (
		classLower.includes("воин") ||
		classLower.includes("warrior") ||
		classLower.includes("fighter") ||
		classLower.includes("барбар") ||
		classLower.includes("barbarian")
	) {
		// Strength-based: STR, CON, DEX, WIS, CHA, INT
		abilityOrder = ["str", "con", "dex", "wis", "cha", "int"];
	} else if (
		classLower.includes("вор") ||
		classLower.includes("rogue") ||
		classLower.includes("плут") ||
		classLower.includes("разбойник")
	) {
		// Dexterity-based: DEX, CON, INT, CHA, WIS, STR
		abilityOrder = ["dex", "con", "int", "cha", "wis", "str"];
	} else if (
		classLower.includes("маг") ||
		classLower.includes("wizard") ||
		classLower.includes("волшебник") ||
		classLower.includes("чародей") ||
		classLower.includes("sorcerer")
	) {
		// Intelligence/Charisma-based: INT, CON, DEX, WIS, CHA, STR
		abilityOrder = ["int", "con", "dex", "wis", "cha", "str"];
	} else if (
		classLower.includes("жрец") ||
		classLower.includes("cleric") ||
		classLower.includes("друид") ||
		classLower.includes("druid") ||
		classLower.includes("монах") ||
		classLower.includes("monk")
	) {
		// Wisdom-based: WIS, CON, DEX, STR, CHA, INT
		abilityOrder = ["wis", "con", "dex", "str", "cha", "int"];
	} else if (
		classLower.includes("бард") ||
		classLower.includes("bard") ||
		classLower.includes("паладин") ||
		classLower.includes("paladin")
	) {
		// Charisma-based: CHA, CON, STR, DEX, WIS, INT
		abilityOrder = ["cha", "con", "str", "dex", "wis", "int"];
	} else if (
		classLower.includes("рейнджер") ||
		classLower.includes("ranger") ||
		classLower.includes("следопыт")
	) {
		// Dex/Wis-based: DEX, WIS, CON, STR, INT, CHA
		abilityOrder = ["dex", "wis", "con", "str", "int", "cha"];
	} else {
		// Default balanced distribution
		abilityOrder = ["str", "dex", "con", "int", "wis", "cha"];
	}

	// Assign rolls to abilities based on priority
	const scores = {
		str: rolls[abilityOrder.indexOf("str")],
		dex: rolls[abilityOrder.indexOf("dex")],
		con: rolls[abilityOrder.indexOf("con")],
		int: rolls[abilityOrder.indexOf("int")],
		wis: rolls[abilityOrder.indexOf("wis")],
		cha: rolls[abilityOrder.indexOf("cha")],
	};

	return {
		scores,
		modifiers: {
			str: scoreToModifier(scores.str),
			dex: scoreToModifier(scores.dex),
			con: scoreToModifier(scores.con),
			int: scoreToModifier(scores.int),
			wis: scoreToModifier(scores.wis),
			cha: scoreToModifier(scores.cha),
		},
	};
}
