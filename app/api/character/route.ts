import { db } from "@/db";
import { characters, sessions } from "@/db/schema";
import {
	generateAbilityScoresForClass,
	generateAbilityScoresWithPriority,
} from "@/lib/mechanics/ability-scores";
import {
	validateAbilityPriority,
	validateAppearanceData,
	validateBackgroundData,
	validateEnhancedCharacterData,
} from "@/lib/validation/character-validation";
import {
	ERROR_CODES,
	createCharacterError,
	formatValidationErrors,
	handleCharacterCreationWithFallback,
	logCharacterError,
	withDatabaseErrorHandling,
} from "@/lib/validation/error-handling";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

// Validation schemas for enhanced character data
const appearanceSchema = z.object({
	age: z.number().min(16).max(80).optional(),
	height: z.enum(["низкий", "средний", "высокий"]).optional(),
	build: z.enum(["худощавый", "крепкий", "полный"]).optional(),
	hair: z.enum(["темные", "светлые", "рыжие", "седые"]).optional(),
	eyes: z.enum(["карие", "голубые", "зеленые", "серые"]).optional(),
	distinguishingMarks: z
		.string()
		.max(500)
		.optional()
		.transform((val) => {
			// Sanitize free-text input by trimming and removing potentially harmful characters
			return val?.trim().replace(/[<>]/g, "") || undefined;
		}),
});

const backgroundSchema = z.object({
	origin: z.enum(["деревня", "город", "дворянство", "кочевники"]).optional(),
	profession: z
		.enum(["ремесленник", "торговец", "солдат", "ученый"])
		.optional(),
	motivation: z
		.string()
		.max(1000)
		.optional()
		.transform((val) => {
			// Sanitize free-text input by trimming and removing potentially harmful characters
			return val?.trim().replace(/[<>]/g, "") || undefined;
		}),
});

const schema = z.object({
	sessionId: z.string().optional(),
	className: z.string().optional(),
	bio: z.string().optional(),
	abilities: z
		.object({
			str: z.number(),
			dex: z.number(),
			con: z.number(),
			int: z.number(),
			wis: z.number(),
			cha: z.number(),
		})
		.optional(),
	skills: z.record(z.number()).optional(),
	// Enhanced character data
	appearance: appearanceSchema.optional(),
	background: backgroundSchema.optional(),
	abilityPriority: z.enum(["physical", "mental", "social"]).optional(),
});

export async function GET() {
	const externalId = cookies().get("rpg_session")?.value;
	if (!externalId) {
		return NextResponse.json({ character: null });
	}

	const sess = await db
		.select()
		.from(sessions)
		.where(eq(sessions.externalId, externalId))
		.limit(1);

	if (!sess[0]) {
		return NextResponse.json({ character: null });
	}

	const [character] = await db
		.select()
		.from(characters)
		.where(eq(characters.sessionId, sess[0].id))
		.limit(1);

	// Return enhanced character data with backward compatibility
	if (character) {
		const enhancedCharacter = {
			...character,
			// Ensure appearance and background are objects, not null
			appearance: character.appearance || {},
			background: character.background || {},
		};
		return NextResponse.json({ character: enhancedCharacter });
	}

	return NextResponse.json({ character: null });
}

export async function POST(req: Request) {
	try {
		const body = await req.json().catch(() => null);
		const parsed = schema.safeParse(body);

		if (!parsed.success) {
			const error = createCharacterError(
				"VALIDATION_FAILED",
				"Неверный формат данных запроса",
				undefined,
				parsed.error.errors.map(
					(err) => `${err.path.join(".")}: ${err.message}`,
				),
			);

			logCharacterError(error, {
				requestData: body,
				timestamp: new Date(),
			});

			return NextResponse.json(
				{
					error: error.message,
					details: error.details,
					code: error.code,
				},
				{ status: 400 },
			);
		}

		// Validate enhanced character data if provided
		const enhancedValidation = validateEnhancedCharacterData({
			appearance: parsed.data.appearance,
			background: parsed.data.background,
			abilityPriority: parsed.data.abilityPriority,
		});

		const externalId =
			parsed.data.sessionId || cookies().get("rpg_session")?.value || "anon";

		// Get or create session with error handling
		const sessionResult = await withDatabaseErrorHandling(async () => {
			let sess = await db
				.select()
				.from(sessions)
				.where(eq(sessions.externalId, externalId))
				.limit(1);

			if (!sess[0]) {
				const created = (
					await db
						.insert(sessions)
						.values({ externalId, locale: "ru", setting: "medieval_fantasy" })
						.returning()
				)[0];
				sess = [created];
			}

			return sess[0];
		}, "получении или создании сессии");

		if (!sessionResult.success) {
			return NextResponse.json(
				{
					error: sessionResult.errors?.[0]?.message || "Ошибка сессии",
					code: sessionResult.errors?.[0]?.code,
				},
				{ status: 500 },
			);
		}

		if (!sessionResult.data) {
			return NextResponse.json(
				{
					error: "Не удалось получить данные сессии",
					code: "SESSION_ERROR",
				},
				{ status: 500 },
			);
		}

		const session = sessionResult.data;

		// Check for existing character
		const existingResult = await withDatabaseErrorHandling(async () => {
			const [existing] = await db
				.select()
				.from(characters)
				.where(eq(characters.sessionId, session.id))
				.limit(1);
			return existing;
		}, "поиске существующего персонажа");

		if (!existingResult.success) {
			return NextResponse.json(
				{
					error:
						existingResult.errors?.[0]?.message || "Ошибка поиска персонажа",
					code: existingResult.errors?.[0]?.code,
				},
				{ status: 500 },
			);
		}

		const existing = existingResult.data;

		if (!existing) {
			// Create new character with enhanced validation and fallback
			const createResult = await handleCharacterCreationWithFallback(
				enhancedValidation,
				parsed.data,
				// Success handler - create with enhanced data
				async (validatedData) => {
					const abilityMods = validatedData.abilities
						? {
								str: validatedData.abilities.str,
								dex: validatedData.abilities.dex,
								con: validatedData.abilities.con,
								int: validatedData.abilities.int,
								wis: validatedData.abilities.wis,
								cha: validatedData.abilities.cha,
							}
						: validatedData.abilityPriority
							? generateAbilityScoresWithPriority(validatedData.abilityPriority)
									.modifiers
							: generateAbilityScoresForClass(validatedData.className ?? "")
									.modifiers;

					const created = (
						await db
							.insert(characters)
							.values({
								sessionId: session.id,
								className: validatedData.className ?? "",
								bio: validatedData.bio ?? "",
								strMod: abilityMods.str,
								dexMod: abilityMods.dex,
								conMod: abilityMods.con,
								intMod: abilityMods.int,
								wisMod: abilityMods.wis,
								chaMod: abilityMods.cha,
								appearance: enhancedValidation.data?.appearance || {},
								background: enhancedValidation.data?.background || {},
								abilityPriority:
									enhancedValidation.data?.abilityPriority || null,
								...(validatedData.skills
									? { skills: validatedData.skills }
									: {}),
							})
							.returning()
					)[0];

					return {
						...created,
						appearance: created.appearance || {},
						background: created.background || {},
					};
				},
				// Fallback handler - create with basic data only
				async (fallbackData) => {
					const abilityMods = generateAbilityScoresForClass(
						fallbackData.className ?? "",
					).modifiers;

					const created = (
						await db
							.insert(characters)
							.values({
								sessionId: session.id,
								className: fallbackData.className ?? "",
								bio: fallbackData.bio ?? "",
								strMod: abilityMods.str,
								dexMod: abilityMods.dex,
								conMod: abilityMods.con,
								intMod: abilityMods.int,
								wisMod: abilityMods.wis,
								chaMod: abilityMods.cha,
								appearance: {},
								background: {},
								abilityPriority: null,
							})
							.returning()
					)[0];

					return {
						...created,
						appearance: {},
						background: {},
					};
				},
			);

			if (!createResult.success) {
				return NextResponse.json(
					{
						error:
							createResult.errors?.[0]?.message ||
							"Не удалось создать персонажа",
						code: createResult.errors?.[0]?.code,
						details: createResult.errors?.flatMap((e) => e.details || []),
					},
					{ status: 500 },
				);
			}

			// Return success response with fallback information if used
			const response = createResult.data as Record<string, unknown>;
			if (createResult.fallbackUsed) {
				response._fallbackUsed = true;
				response._validationErrors = createResult.errors?.map((e) => e.message);
			}

			return NextResponse.json(response);
		}

		// Update existing character with enhanced validation
		const updateResult = await handleCharacterCreationWithFallback(
			enhancedValidation,
			parsed.data,
			// Success handler - update with enhanced data
			async (validatedData) => {
				const update: Partial<typeof existing> = {};

				if (validatedData.className !== undefined)
					update.className = validatedData.className;
				if (validatedData.bio !== undefined) update.bio = validatedData.bio;
				if (validatedData.abilities) {
					update.strMod = validatedData.abilities.str;
					update.dexMod = validatedData.abilities.dex;
					update.conMod = validatedData.abilities.con;
					update.intMod = validatedData.abilities.int;
					update.wisMod = validatedData.abilities.wis;
					update.chaMod = validatedData.abilities.cha;
				}
				if (validatedData.skills) update.skills = validatedData.skills;

				// Handle enhanced character data updates with validation
				if (enhancedValidation.data?.appearance !== undefined) {
					const existingAppearance = existing.appearance || {};
					update.appearance = {
						...existingAppearance,
						...enhancedValidation.data.appearance,
					};
				}
				if (enhancedValidation.data?.background !== undefined) {
					const existingBackground = existing.background || {};
					update.background = {
						...existingBackground,
						...enhancedValidation.data.background,
					};
				}
				if (enhancedValidation.data?.abilityPriority !== undefined) {
					update.abilityPriority = enhancedValidation.data.abilityPriority;
				}

				update.updatedAt = new Date();

				const updated = (
					await db
						.update(characters)
						.set(update)
						.where(eq(characters.id, existing.id))
						.returning()
				)[0];

				return {
					...updated,
					appearance: updated.appearance || {},
					background: updated.background || {},
				};
			},
			// Fallback handler - update with basic data only
			async (fallbackData) => {
				const update: Partial<typeof existing> = {};

				if (fallbackData.className !== undefined)
					update.className = fallbackData.className;
				if (fallbackData.bio !== undefined) update.bio = fallbackData.bio;

				update.updatedAt = new Date();

				const updated = (
					await db
						.update(characters)
						.set(update)
						.where(eq(characters.id, existing.id))
						.returning()
				)[0];

				return {
					...updated,
					appearance: updated.appearance || {},
					background: updated.background || {},
				};
			},
		);

		if (!updateResult.success) {
			return NextResponse.json(
				{
					error:
						updateResult.errors?.[0]?.message ||
						"Не удалось обновить персонажа",
					code: updateResult.errors?.[0]?.code,
					details: updateResult.errors?.flatMap((e) => e.details || []),
				},
				{ status: 500 },
			);
		}

		// Return success response with fallback information if used
		const response = updateResult.data as Record<string, unknown>;
		if (updateResult.fallbackUsed) {
			response._fallbackUsed = true;
			response._validationErrors = updateResult.errors?.map((e) => e.message);
		}

		return NextResponse.json(response);
	} catch (error) {
		const unexpectedError = createCharacterError(
			"UNEXPECTED_ERROR",
			"Произошла неожиданная ошибка сервера",
			undefined,
			[String(error)],
		);

		logCharacterError(unexpectedError, {
			timestamp: new Date(),
		});

		return NextResponse.json(
			{
				error: unexpectedError.message,
				code: unexpectedError.code,
			},
			{ status: 500 },
		);
	}
}
