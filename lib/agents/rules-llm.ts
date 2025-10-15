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

	const system = `Вы — Rules Agent. Определяете, требуется ли проверка (бросок кубика) для действия игрока.
Возвращайте только JSON по схеме. Язык — русский. НЕ пишите нарратив.
Руководство:
— НЕ бросаем для тривиальных бытовых действий без ставок (поднять кружку, оглядеться, сесть, подойти к столу).
— Бросаем, когда имеется неопределённость И значимые ставки (риск/награда), особенно при силовых/боевых/скрытных действиях или активном противодействии.
— Для текущей версии используйте type='skill' (contest/save пока не используем).
— Примеры навыков: athletics (силовые, драка/прыжок), stealth (скрытность), acrobatics (ловкость), sleight_of_hand (вскрытие/ловкость рук), perception/investigation (замечать/искать), persuasion/deception/intimidation (социальные).
— DC: 10 (легко), 15 (средне), 20 (сложно).`;

	const fewShots: { role: "user" | "assistant"; content: string }[] = [
		{
			role: "user",
			content: "Действие: Поднять кружку со стола",
		},
		{
			role: "assistant",
			content: JSON.stringify({
				requiresCheck: false,
				type: "none",
				rationale: "Бытовое действие",
			}),
		},
		{
			role: "user",
			content: "Действие: Перепрыгнуть широкий ров",
		},
		{
			role: "assistant",
			content: JSON.stringify({
				requiresCheck: true,
				type: "skill",
				skill: "athletics",
				dc: 15,
				rationale: "Физический риск и неопределённость",
			}),
		},
		{
			role: "user",
			content: "Действие: Пытаюсь ударить ногой противника в таверне",
		},
		{
			role: "assistant",
			content: JSON.stringify({
				requiresCheck: true,
				type: "skill",
				skill: "athletics",
				dc: 15,
				rationale: "Боевое действие с противодействием",
			}),
		},
	];

	const user = `Контекст (последние реплики):\n${history}\n\nДействие игрока: ${input.content}\nКласс: ${input.profile?.className ?? ""}\nБио: ${input.profile?.bio ?? ""}`;

	const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
		},
		body: JSON.stringify({
			model: "x-ai/grok-4-fast",
			temperature: 0,
			max_tokens: 256,
			response_format: { type: "json_object" },
			messages: [
				{ role: "system", content: system },
				...fewShots,
				{ role: "user", content: user },
			],
		}),
	});
	if (!resp.ok) return null;
	const data = await resp.json();
	const content = data?.choices?.[0]?.message?.content;
	if (typeof content !== "string") return null;
	let parsedJson: unknown;
	try {
		parsedJson = JSON.parse(content);
	} catch {
		return null;
	}
	const safe = RulesSchema.safeParse(parsedJson);
	if (!safe.success) return null;
	const obj = safe.data as RulesOutput;
	const dc = obj.dc;
	if (dc && ![5, 10, 15, 20, 25, 30].includes(dc)) {
		obj.dc = Math.min(30, Math.max(5, Math.round(dc / 5) * 5));
	}
	return obj;
}
