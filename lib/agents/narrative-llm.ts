import type { DecideContext, PlayerInput, RulesOutput } from "./protocol";

function buildSystemPrompt() {
	return (
		"Вы — Narrative Agent для текстовой RPG (RU). " +
		"Мир: средневековое фэнтези, вдохновлено D&D. " +
		"Оформляйте ответ живым текстом от лица ведущего (GM). " +
		"Нельзя менять исход механик: результат проверки уже решён кодом. " +
		"Кратко и насыщенно, без дублирования фактов."
	);
}

function buildUserPrompt(
	input: PlayerInput,
	rules: RulesOutput,
	outcome: { success: boolean; critical: boolean; margin: number } | null,
	history: { role: "player" | "gm"; content: string }[],
) {
	const hist = history
		.map((m) => `${m.role === "player" ? "Игрок" : "GM"}: ${m.content}`)
		.join("\n");
	const outcomeText = outcome
		? `Исход проверки: ${outcome.critical ? "критический " : ""}${outcome.success ? "успех" : "провал"}, margin=${outcome.margin}.`
		: "Проверка не требуется.";
	const ruleText = rules.requiresCheck
		? `Решение Rules: ${rules.type}${rules.skill ? `, навык=${rules.skill}` : ""}${rules.dc ? `, DC=${rules.dc}` : ""}.`
		: "Решение Rules: проверка не требуется.";
	const profile = input.profile
		? `Класс: ${input.profile.className ?? ""}. Био: ${input.profile.bio ?? ""}.`
		: "";

	return `История (последние реплики):\n${hist}\n\nДействие игрока: ${input.content}\n${profile}\n${ruleText} ${outcomeText}\nЗадача: опишите результат в каноне мира. Кратко (2-5 предложений).`;
}

export async function* streamNarrative(
	input: PlayerInput,
	rules: RulesOutput,
	outcome: { success: boolean; critical: boolean; margin: number } | null,
	history: { role: "player" | "gm"; content: string }[],
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

	const system = buildSystemPrompt();
	const user = buildUserPrompt(input, rules, outcome, history);

	const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
		},
		body: JSON.stringify({
			model: "x-ai/grok-4-fast",
			temperature: 0.7,
			stream: true,
			messages: [
				{ role: "system", content: system },
				{ role: "user", content: user },
			],
		}),
	});

	if (!resp.ok || !resp.body) {
		yield "Происходит заминка, но всё идёт своим чередом.";
		return;
	}

	const reader = resp.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	while (true) {
		const { value, done } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split(/\n/);
		// keep last partial in buffer
		buffer = lines.pop() ?? "";
		for (const raw of lines) {
			const line = raw.trim();
			if (!line.startsWith("data:")) continue;
			const payload = line.slice(5).trim();
			if (!payload || payload === "[DONE]") continue;
			try {
				const json = JSON.parse(payload);
				const content = json?.choices?.[0]?.delta?.content ?? "";
				if (content) {
					yield content as string;
				}
			} catch {
				// ignore
			}
		}
	}
}
