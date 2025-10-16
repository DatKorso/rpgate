import {
	DEFAULT_MODEL,
	type Message,
	callOpenRouter,
} from "@/lib/llm/openrouter";
import { z } from "zod";
import type { DecideContext, PlayerInput, RulesOutput } from "./protocol";

const RulesSchema = z.object({
	requiresCheck: z.boolean(),
	type: z.enum(["none", "skill", "contest", "save"]),
	skill: z.string().optional(),
	dc: z.number().int().min(5).max(35).optional(),
	opposedBy: z.string().optional(),
	rationale: z.string().optional(),
	alternative: z
		.enum(["auto_success", "auto_fail", "success_with_cost"])
		.optional(),
	confidence: z.number().min(0).max(1).optional(),
});

export async function classifyRulesLLM(
	input: PlayerInput,
	ctx: DecideContext = {},
): Promise<RulesOutput | null> {
	if (!process.env.OPENROUTER_API_KEY) return null;

	const history = (ctx.history ?? [])
		.slice(-15)
		.map((m) => `${m.role.toUpperCase()}: ${m.content}`)
		.join("\n");

	// Compressed system prompt (optimized for Grok - no caching support)
	const systemPrompt = `Rules Agent. Определи нужна ли проверка d20 для действия.
ВАЖНО: Верни ТОЛЬКО валидный JSON, без дополнительного текста. Язык: RU.
Правила:
- НЕ бросаем: тривиальные действия без риска (поднять кружку, оглядеться)
- Бросаем: риск + неопределённость (драка, прыжок через ров, скрытность)
- type='skill', навыки: athletics, stealth, acrobatics, sleight_of_hand, perception, investigation, persuasion, deception, intimidation
- DC: 10 легко, 15 средне, 20 сложно

Примеры:
1. "Поднять кружку" → {"requiresCheck":false,"type":"none","rationale":"Бытовое"}
2. "Перепрыгнуть ров" → {"requiresCheck":true,"type":"skill","skill":"athletics","dc":15,"rationale":"Риск"}
3. "Ударить противника" → {"requiresCheck":true,"type":"skill","skill":"athletics","dc":15,"rationale":"Бой"}

Верни ТОЛЬКО JSON объект, начинающийся с { и заканчивающийся }.`;

	const userPrompt = `История:\n${history}\n\nДействие: ${input.content}\nКласс: ${input.profile?.className ?? ""}\nБио: ${input.profile?.bio ?? ""}`;

	const messages: Message[] = [
		{ role: "system", content: systemPrompt },
		{ role: "user", content: userPrompt },
	];

	try {
		const resp = await callOpenRouter({
			model: DEFAULT_MODEL,
			temperature: 0,
			max_tokens: 256,
			// Note: response_format not supported by all models (e.g., free Llama)
			// Rely on prompt instructions instead
			messages,
		});

		if (!resp.ok) {
			console.error("Rules LLM API error:", resp.status, resp.statusText);
			return null;
		}

		const data = await resp.json();
		const content = data?.choices?.[0]?.message?.content;
		if (typeof content !== "string") {
			console.error("Rules LLM: No content in response");
			return null;
		}

		// Extract JSON from response (handle cases where model adds extra text)
		let jsonStr = content.trim();
		const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
		if (jsonMatch) {
			jsonStr = jsonMatch[0];
		}

		let parsedJson: unknown;
		try {
			parsedJson = JSON.parse(jsonStr);
		} catch (err) {
			console.error("Rules LLM: Failed to parse JSON:", jsonStr);
			return null;
		}

		const safe = RulesSchema.safeParse(parsedJson);
		if (!safe.success) {
			console.error("Rules LLM: Schema validation failed:", safe.error);
			return null;
		}

		const obj = safe.data as RulesOutput;
		const dc = obj.dc;
		if (dc && ![5, 10, 15, 20, 25, 30].includes(dc)) {
			obj.dc = Math.min(30, Math.max(5, Math.round(dc / 5) * 5));
		}

		return obj;
	} catch (err) {
		console.error("Rules LLM: Unexpected error:", err);
		return null;
	}
}
