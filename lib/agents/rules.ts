import { z } from "zod";
import { heuristicDecide } from "./heuristics";
import type { DecideContext, PlayerInput, RulesOutput } from "./protocol";
import { classifyRulesLLM } from "./rules-llm";

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
});

export async function decideCheck(
	input: PlayerInput,
	ctx: DecideContext = {},
): Promise<RulesOutput> {
	// Step 1: heuristic gates
	const heur = heuristicDecide(input);
	if (heur) return heur;

	// Step 2: LLM classifier (when API key present); else fallback
	const llm = await classifyRulesLLM(input, ctx).catch(() => null);
	const candidate = llm ?? {
		requiresCheck: false,
		type: "none",
		rationale: "Безопасный фоллбек: проверка не требуется",
	};
	const parsed = RulesSchema.safeParse(candidate);
	if (!parsed.success) {
		return {
			requiresCheck: false,
			type: "none",
			rationale: "Ошибка классификации, безопасный фоллбек",
		};
	}
	if (parsed.data.dc && ![5, 10, 15, 20, 25, 30].includes(parsed.data.dc)) {
		parsed.data.dc = Math.min(
			30,
			Math.max(5, Math.round(parsed.data.dc / 5) * 5),
		);
	}
	return parsed.data;
}
