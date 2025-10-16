import {
	DEFAULT_MODEL,
	type Message,
	streamOpenRouter,
} from "@/lib/llm/openrouter";
import type { DecideContext, PlayerInput, RulesOutput } from "./protocol";

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

function buildUserPrompt(
	input: PlayerInput,
	rules: RulesOutput,
	outcome: { success: boolean; critical: boolean; margin: number } | null,
	history: { role: "player" | "gm"; content: string }[],
	characterProfile?: {
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
	} | null,
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
		profile = `${className || "Искатель"}. ${bio ? `${bio}. ` : ""}${abilityStr}.`;
	}

	return `История:\n${hist}\n\nДействие: ${input.content}\n${profile ? `Персонаж: ${profile}\n` : ""}Проверка: ${ruleText}. Исход: ${outcomeText}.\nОпиши результат (2-5 предложений).`;
}

export async function* streamNarrative(
	input: PlayerInput,
	rules: RulesOutput,
	outcome: { success: boolean; critical: boolean; margin: number } | null,
	history: { role: "player" | "gm"; content: string }[],
	characterProfile?: {
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
	} | null,
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
