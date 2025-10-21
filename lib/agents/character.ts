import { db } from "@/db";
import { characters } from "@/db/schema";
import type {
	AppearanceData,
	BackgroundData,
	EnhancedCharacterProfile,
	PlayerProfile,
} from "@/lib/agents/protocol";
import {
	generateAbilityScoresForClass,
	generateAbilityScoresWithPriority,
} from "@/lib/mechanics/ability-scores";
import { validateEnhancedCharacterData } from "@/lib/validation/character-validation";
import {
	createCharacterError,
	handleCharacterCreationWithFallback,
	logCharacterError,
	withDatabaseErrorHandling,
} from "@/lib/validation/error-handling";
import { eq } from "drizzle-orm";

type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";

const skillAbilityMap: Record<string, AbilityKey> = {
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

export async function getOrCreateCharacter(
	sessionId: number,
	profile?: PlayerProfile,
) {
	const existingResult = await withDatabaseErrorHandling(async () => {
		return await db
			.select()
			.from(characters)
			.where(eq(characters.sessionId, sessionId))
			.limit(1);
	}, "поиске существующего персонажа");

	if (!existingResult.success) {
		throw new Error(`Database error: ${existingResult.errors?.[0]?.message}`);
	}

	const existing = existingResult.data?.[0];

	if (existing) {
		// Update character data if provided with validation
		if (profile) {
			// Validate enhanced character data
			const validation = validateEnhancedCharacterData({
				appearance: profile.appearance,
				background: profile.background,
				abilityPriority: profile.abilityPriority,
			});

			const updateData: Partial<typeof characters.$inferInsert> = {};

			if (profile.className !== undefined) {
				updateData.className = profile.className;
			}
			if (profile.bio !== undefined) {
				updateData.bio = profile.bio;
			}

			// Only update enhanced data if validation passes
			if (validation.success) {
				if (validation.data?.appearance !== undefined) {
					updateData.appearance = validation.data.appearance;
				}
				if (validation.data?.background !== undefined) {
					updateData.background = validation.data.background;
				}
				if (validation.data?.abilityPriority !== undefined) {
					updateData.abilityPriority = validation.data.abilityPriority;
				}
			} else {
				// Log validation errors but continue with basic updates
				const error = createCharacterError(
					"VALIDATION_FAILED",
					"Ошибка валидации при обновлении персонажа",
					undefined,
					validation.errors,
				);

				logCharacterError(error, {
					sessionId: sessionId.toString(),
					requestData: profile,
					timestamp: new Date(),
				});
			}

			// Only update if there are changes
			if (Object.keys(updateData).length > 0) {
				const updateResult = await withDatabaseErrorHandling(async () => {
					return await db
						.update(characters)
						.set(updateData)
						.where(eq(characters.id, existing.id))
						.returning();
				}, "обновлении персонажа");

				if (!updateResult.success) {
					throw new Error(
						`Database error: ${updateResult.errors?.[0]?.message}`,
					);
				}

				return updateResult.data?.[0] || existing;
			}
		}
		return existing;
	}

	// Create new character with validation and fallback
	if (!profile) {
		// No profile provided, create basic character
		const abilityData = generateAbilityScoresForClass("");

		const createResult = await withDatabaseErrorHandling(async () => {
			return await db
				.insert(characters)
				.values({
					sessionId,
					className: "",
					bio: "",
					strMod: abilityData.modifiers.str,
					dexMod: abilityData.modifiers.dex,
					conMod: abilityData.modifiers.con,
					intMod: abilityData.modifiers.int,
					wisMod: abilityData.modifiers.wis,
					chaMod: abilityData.modifiers.cha,
					appearance: {},
					background: {},
					abilityPriority: null,
				})
				.returning();
		}, "создании базового персонажа");

		if (!createResult.success) {
			throw new Error(`Database error: ${createResult.errors?.[0]?.message}`);
		}

		return createResult.data?.[0];
	}

	// Validate enhanced character data
	const validation = validateEnhancedCharacterData({
		appearance: profile.appearance,
		background: profile.background,
		abilityPriority: profile.abilityPriority,
	});

	const createResult = await handleCharacterCreationWithFallback(
		validation,
		profile,
		// Success handler - create with enhanced data
		async (validatedProfile) => {
			const className = validatedProfile.className ?? "";
			let abilityData: {
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
			};

			if (validation.data?.abilityPriority) {
				abilityData = generateAbilityScoresWithPriority(
					validation.data.abilityPriority,
				);
			} else {
				abilityData = generateAbilityScoresForClass(className);
			}

			const created = (
				await db
					.insert(characters)
					.values({
						sessionId,
						className,
						bio: validatedProfile.bio ?? "",
						strMod: abilityData.modifiers.str,
						dexMod: abilityData.modifiers.dex,
						conMod: abilityData.modifiers.con,
						intMod: abilityData.modifiers.int,
						wisMod: abilityData.modifiers.wis,
						chaMod: abilityData.modifiers.cha,
						appearance: validation.data?.appearance ?? {},
						background: validation.data?.background ?? {},
						abilityPriority: validation.data?.abilityPriority ?? null,
					})
					.returning()
			)[0];
			return created;
		},
		// Fallback handler - create with basic data only
		async (fallbackProfile) => {
			const className = fallbackProfile.className ?? "";
			const abilityData = generateAbilityScoresForClass(className);

			const created = (
				await db
					.insert(characters)
					.values({
						sessionId,
						className,
						bio: fallbackProfile.bio ?? "",
						strMod: abilityData.modifiers.str,
						dexMod: abilityData.modifiers.dex,
						conMod: abilityData.modifiers.con,
						intMod: abilityData.modifiers.int,
						wisMod: abilityData.modifiers.wis,
						chaMod: abilityData.modifiers.cha,
						appearance: {},
						background: {},
						abilityPriority: null,
					})
					.returning()
			)[0];
			return created;
		},
	);

	if (!createResult.success) {
		throw new Error(
			`Character creation failed: ${createResult.errors?.[0]?.message}`,
		);
	}

	return createResult.data;
}

/**
 * Get character profile from database
 * Returns className, bio, and ability modifiers
 */
export async function getCharacterProfile(sessionId: number): Promise<{
	className: string;
	bio: string;
	abilities: {
		str: number;
		dex: number;
		con: number;
		int: number;
		wis: number;
		cha: number;
	};
} | null> {
	const [char] = await db
		.select()
		.from(characters)
		.where(eq(characters.sessionId, sessionId))
		.limit(1);

	if (!char) return null;

	return {
		className: char.className || "",
		bio: char.bio || "",
		abilities: {
			str: char.strMod,
			dex: char.dexMod,
			con: char.conMod,
			int: char.intMod,
			wis: char.wisMod,
			cha: char.chaMod,
		},
	};
}

/**
 * Get enhanced character profile from database
 * Returns complete character data including appearance and background
 * Handles backward compatibility with characters missing enhanced data
 */
export async function getEnhancedCharacterProfile(
	sessionId: number,
): Promise<EnhancedCharacterProfile | null> {
	const [char] = await db
		.select()
		.from(characters)
		.where(eq(characters.sessionId, sessionId))
		.limit(1);

	if (!char) return null;

	// Use utility function to ensure proper defaults for backward compatibility
	return mergeWithEnhancedDefaults(char);
}

export async function computeSkillModifiers(
	sessionId: number,
	skillName?: string,
): Promise<{
	ability: number;
	skill: number;
	equipment: number;
	temporary: number;
}> {
	const [char] = await db
		.select()
		.from(characters)
		.where(eq(characters.sessionId, sessionId))
		.limit(1);
	if (!char) return { ability: 0, skill: 0, equipment: 0, temporary: 0 };

	const abilityKey = skillName
		? skillAbilityMap[skillName.toLowerCase()]
		: undefined;
	const ability = abilityKey
		? abilityKey === "str"
			? char.strMod
			: abilityKey === "dex"
				? char.dexMod
				: abilityKey === "con"
					? char.conMod
					: abilityKey === "int"
						? char.intMod
						: abilityKey === "wis"
							? char.wisMod
							: char.chaMod
		: 0;

	const skill =
		(char.skills as Record<string, number> | null | undefined)?.[
			skillName ?? ""
		] ?? 0;
	const equipment = 0; // TODO: aggregate from equipment items when available
	const temporary = 0; // TODO: derive from active effects/buffs
	return { ability, skill, equipment, temporary };
}
/**
 * Provides sensible defaults for missing enhanced character data
 * Used to ensure backward compatibility with characters created before enhanced features
 */
export function getEnhancedDataDefaults(): {
	appearance: AppearanceData;
	background: BackgroundData;
	abilityPriority: "physical" | "mental" | "social" | null;
} {
	return {
		appearance: {},
		background: {},
		abilityPriority: null,
	};
}

/**
 * Merges existing character data with enhanced data defaults
 * Ensures all enhanced fields have proper values for backward compatibility
 */
export function mergeWithEnhancedDefaults(
	characterData: any,
): EnhancedCharacterProfile {
	const defaults = getEnhancedDataDefaults();

	return {
		name: characterData.className || undefined,
		className: characterData.className || "",
		bio: characterData.bio || "",
		appearance: characterData.appearance || defaults.appearance,
		background: characterData.background || defaults.background,
		abilityPriority: characterData.abilityPriority || defaults.abilityPriority,
		abilities: {
			str: characterData.strMod || 0,
			dex: characterData.dexMod || 0,
			con: characterData.conMod || 0,
			int: characterData.intMod || 0,
			wis: characterData.wisMod || 0,
			cha: characterData.chaMod || 0,
		},
	};
}
