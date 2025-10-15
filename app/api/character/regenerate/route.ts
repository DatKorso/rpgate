import { db } from "@/db";
import { characters, sessions } from "@/db/schema";
import { generateAbilityScoresForClass } from "@/lib/mechanics/ability-scores";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * POST /api/character/regenerate
 * Regenerates ability scores for existing character
 */
export async function POST() {
	const externalId = cookies().get("rpg_session")?.value;
	if (!externalId) {
		return NextResponse.json(
			{ error: "No session found" },
			{ status: 400 },
		);
	}

	const sess = await db
		.select()
		.from(sessions)
		.where(eq(sessions.externalId, externalId))
		.limit(1);

	if (!sess[0]) {
		return NextResponse.json(
			{ error: "Session not found" },
			{ status: 404 },
		);
	}

	const [character] = await db
		.select()
		.from(characters)
		.where(eq(characters.sessionId, sess[0].id))
		.limit(1);

	if (!character) {
		return NextResponse.json(
			{ error: "Character not found" },
			{ status: 404 },
		);
	}

	// Generate new ability scores based on current class
	const { modifiers } = generateAbilityScoresForClass(
		character.className || "",
	);

	// Update character with new scores
	const updated = (
		await db
			.update(characters)
			.set({
				strMod: modifiers.str,
				dexMod: modifiers.dex,
				conMod: modifiers.con,
				intMod: modifiers.int,
				wisMod: modifiers.wis,
				chaMod: modifiers.cha,
				updatedAt: new Date(),
			})
			.where(eq(characters.id, character.id))
			.returning()
	)[0];

	return NextResponse.json({
		character: updated,
		message: "Характеристики перегенерированы",
	});
}
