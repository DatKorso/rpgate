import {
	type PlayerKnowledgeContext,
	formatPlayerKnowledgeForLLM,
} from "@/lib/knowledge/player-loader";
import {
	type WorldKnowledgeContext,
	formatWorldKnowledgeForLLM,
} from "@/lib/knowledge/world-loader";
import {
	DEFAULT_MODEL,
	type Message,
	streamOpenRouter,
} from "@/lib/llm/openrouter";
import type {
	AppearanceData,
	BackgroundData,
	EnhancedCharacterProfile,
	MemoryEntryData,
	PlayerInput,
	RulesOutput,
} from "./protocol";

function buildSystemPrompt() {
	// Compressed prompt (optimized for Grok - no caching support)
	return (
		"Narrative Agent для RPG (RU). " +
		"Мир: фэнтези D&D. " +
		"Пиши от лица GM. " +
		"Исход проверки уже решён — опиши результат. " +
		"Кратко, 2-5 предложений."
	);
}

/**
 * Format appearance data for narrative context
 */
export function formatAppearanceForNarrative(
	appearance: AppearanceData,
): string {
	const parts: string[] = [];

	if (appearance.age) {
		parts.push(`${appearance.age} лет`);
	}

	if (appearance.height) {
		const heightMap = {
			низкий: "низкого роста",
			средний: "среднего роста",
			высокий: "высокого роста",
		};
		parts.push(heightMap[appearance.height]);
	}

	if (appearance.build) {
		const buildMap = {
			худощавый: "худощавого телосложения",
			крепкий: "крепкого телосложения",
			полный: "полного телосложения",
		};
		parts.push(buildMap[appearance.build]);
	}

	if (appearance.hair) {
		const hairMap = {
			темные: "с темными волосами",
			светлые: "со светлыми волосами",
			рыжие: "с рыжими волосами",
			седые: "с седыми волосами",
		};
		parts.push(hairMap[appearance.hair]);
	}

	if (appearance.eyes) {
		const eyeMap = {
			карие: "с карими глазами",
			голубые: "с голубыми глазами",
			зеленые: "с зелеными глазами",
			серые: "с серыми глазами",
		};
		parts.push(eyeMap[appearance.eyes]);
	}

	if (appearance.distinguishingMarks) {
		parts.push(`особые приметы: ${appearance.distinguishingMarks}`);
	}

	return parts.join(", ");
}

/**
 * Format background data for narrative context
 */
export function formatBackgroundForNarrative(
	background: BackgroundData,
): string {
	const parts: string[] = [];

	if (background.origin) {
		const originMap = {
			деревня: "родом из деревни",
			город: "родом из города",
			дворянство: "дворянского происхождения",
			кочевники: "из кочевого племени",
		};
		parts.push(originMap[background.origin]);
	}

	if (background.profession) {
		const professionMap = {
			ремесленник: "по профессии ремесленник",
			торговец: "по профессии торговец",
			солдат: "по профессии солдат",
			ученый: "по профессии ученый",
		};
		parts.push(professionMap[background.profession]);
	}

	if (background.motivation) {
		parts.push(`мотивация: ${background.motivation}`);
	}

	return parts.join(", ");
}

function buildUserPrompt(
	input: PlayerInput,
	rules: RulesOutput,
	outcome: { success: boolean; critical: boolean; margin: number } | null,
	history: { role: "player" | "gm"; content: string }[],
	characterProfile?:
		| EnhancedCharacterProfile
		| {
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
		  }
		| null,
	memories?: MemoryEntryData[],
	worldKnowledge?: WorldKnowledgeContext,
	playerKnowledge?: PlayerKnowledgeContext,
) {
	// Compressed history format
	const hist = history
		.map((m) => `${m.role[0].toUpperCase()}: ${m.content}`)
		.join("\n");

	const outcomeText = outcome
		? `${outcome.critical ? "Крит " : ""}${outcome.success ? "успех" : "провал"} (${outcome.margin > 0 ? "+" : ""}${outcome.margin})`
		: "Без проверки";

	const ruleText = rules.requiresCheck
		? `${rules.skill ?? rules.type} DC${rules.dc ?? "?"}`
		: "Авто";

	let profile = "";
	if (characterProfile) {
		const { className, bio, abilities } = characterProfile;
		const abilityStr = `СИЛ${abilities.str >= 0 ? "+" : ""}${abilities.str} ЛОВ${abilities.dex >= 0 ? "+" : ""}${abilities.dex} ТЕЛ${abilities.con >= 0 ? "+" : ""}${abilities.con} ИНТ${abilities.int >= 0 ? "+" : ""}${abilities.int} МДР${abilities.wis >= 0 ? "+" : ""}${abilities.wis} ХАР${abilities.cha >= 0 ? "+" : ""}${abilities.cha}`;

		const profileParts = [`${className || "Искатель"}`];

		if (bio) {
			profileParts.push(bio);
		}

		// Add appearance if available (enhanced profile)
		if (
			"appearance" in characterProfile &&
			characterProfile.appearance &&
			Object.keys(characterProfile.appearance).length > 0
		) {
			const appearanceText = formatAppearanceForNarrative(
				characterProfile.appearance,
			);
			if (appearanceText) {
				profileParts.push(`Внешность: ${appearanceText}`);
			}
		}

		// Add background if available (enhanced profile)
		if (
			"background" in characterProfile &&
			characterProfile.background &&
			Object.keys(characterProfile.background).length > 0
		) {
			const backgroundText = formatBackgroundForNarrative(
				characterProfile.background,
			);
			if (backgroundText) {
				profileParts.push(`Предыстория: ${backgroundText}`);
			}
		}

		profileParts.push(abilityStr);
		profile = `${profileParts.join(". ")}.`;
	}

	// Format memories for prompt context in Russian
	let memoriesText = "";
	if (memories && memories.length > 0) {
		memoriesText = `\n\nВоспоминания:\n${memories
			.map((m, i) => `${i + 1}. [Ход ${m.turnNumber}] ${m.summary}`)
			.join("\n")}`;
	}

	// Format world knowledge (GM only)
	let worldKnowledgeText = "";
	if (worldKnowledge && worldKnowledge.entities.length > 0) {
		worldKnowledgeText = `\n\n${formatWorldKnowledgeForLLM(worldKnowledge)}`;
	}

	// Format player knowledge (what PC knows)
	let playerKnowledgeText = "";
	if (playerKnowledge && playerKnowledge.knownEntities.length > 0) {
		playerKnowledgeText = `\n\n${formatPlayerKnowledgeForLLM(playerKnowledge)}`;
	}

	// Add knowledge boundary instructions if knowledge is present
	let knowledgeInstructions = "";
	if (worldKnowledgeText || playerKnowledgeText) {
		knowledgeInstructions = `\n\n=== ИНСТРУКЦИЯ ===
Используй World Knowledge для понимания мира и создания консистентного повествования.

КРИТИЧЕСКИ ВАЖНО: Персонаж может использовать только информацию из раздела "PLAYER CHARACTER KNOWLEDGE"!

Если персонаж пытается вспомнить что-то, чего нет в его знаниях:
- Скажи, что он не знает этого
- Предложи способ узнать (спросить у NPC, исследовать, и т.д.)

Если NPC знает информацию из World Knowledge, он может рассказать её персонажу.
После этого информация будет добавлена в Player Knowledge автоматически.`;
	}

	return `История:\n${hist}\n\nДействие: ${input.content}\n${profile ? `Персонаж: ${profile}\n` : ""}${memoriesText}${worldKnowledgeText}${playerKnowledgeText}${knowledgeInstructions}\nПроверка: ${ruleText}. Исход: ${outcomeText}.\nОпиши результат (2-5 предложений).`;
}

export async function* streamNarrative(
	input: PlayerInput,
	rules: RulesOutput,
	outcome: { success: boolean; critical: boolean; margin: number } | null,
	history: { role: "player" | "gm"; content: string }[],
	characterProfile?:
		| EnhancedCharacterProfile
		| {
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
		  }
		| null,
	memories?: MemoryEntryData[],
	worldKnowledge?: WorldKnowledgeContext,
	playerKnowledge?: PlayerKnowledgeContext,
	timeoutMs = 30000,
): AsyncGenerator<string, void, void> {
	if (!process.env.OPENROUTER_API_KEY) {
		// Fallback text when key is absent
		const text =
			outcome == null
				? "Ты продолжаешь своё действие без проверок."
				: outcome.critical
					? outcome.success
						? "Критический успех! Твоё действие приносит выдающийся результат."
						: "Критический провал... обстоятельства складываются против тебя."
					: outcome.success
						? "Успех: ты достигаешь задуманного."
						: "Провал: задуманное не удаётся, возникли препятствия.";
		yield text;
		return;
	}

	const systemPrompt = buildSystemPrompt();
	const userPrompt = buildUserPrompt(
		input,
		rules,
		outcome,
		history,
		characterProfile,
		memories,
		worldKnowledge,
		playerKnowledge,
	);

	const messages: Message[] = [
		{ role: "system", content: systemPrompt },
		{ role: "user", content: userPrompt },
	];

	try {
		yield* streamOpenRouter(
			{
				model: DEFAULT_MODEL,
				temperature: 0.7,
				messages,
			},
			{ timeoutMs },
		);
	} catch (err) {
		if ((err as Error).name === "AbortError") {
			yield "Время ожидания истекло, но приключение продолжается...";
			return;
		}
		yield "Происходит заминка, но всё идёт своим чередом.";
	}
}
