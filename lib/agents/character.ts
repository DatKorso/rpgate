import { db } from "@/db";
import { characters } from "@/db/schema";
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
	profile?: { className?: string; bio?: string },
) {
	const existing = await db
		.select()
		.from(characters)
		.where(eq(characters.sessionId, sessionId))
		.limit(1);
	if (existing[0]) {
		// Update class/bio if provided
		if (profile?.className || profile?.bio) {
			await db
				.update(characters)
				.set({
					className: profile.className ?? existing[0].className,
					bio: profile.bio ?? existing[0].bio,
				})
				.where(eq(characters.id, existing[0].id));
		}
		return existing[0];
	}
	const created = (
		await db
			.insert(characters)
			.values({
				sessionId,
				className: profile?.className ?? "",
				bio: profile?.bio ?? "",
			})
			.returning()
	)[0];
	return created;
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
