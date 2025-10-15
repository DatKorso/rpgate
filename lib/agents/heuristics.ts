import type { PlayerInput, RulesOutput } from "./protocol";

function norm(text: string) {
	return text.toLowerCase().replace(/ё/g, "е").trim();
}

const TRIVIAL_HINTS = [
	"поднять",
	"взять",
	"посмотреть",
	"осмотреться",
	"оглядеться",
	"сесть",
	"встать",
	"идти",
	"пойти",
	"подойти",
	"выпить",
	"надеть",
	"сказать",
	"спросить",
	"улыбнуться",
	"кивнуть",
	"открыть дверь",
	"закрыть дверь",
];

const STAKES_HINTS = [
	"опас",
	"страж",
	"охран",
	"враг",
	"монстр",
	"обрыв",
	"высок",
	"темн",
	"ноч",
	"скольз",
	"тихо",
	"быстро",
	"тайн",
	"слож",
	"тяжел",
	"тяжёл",
	"ловуш",
	"замок",
	"заперт",
];

const ACTIVE_OPPOSITION_HINTS = [
	"страж",
	"охран",
	"враг",
	"бандит",
	"гоблин",
	"волк",
	"против",
];

export function heuristicDecide(input: PlayerInput): RulesOutput | null {
	const text = norm(input.content);

	// Obvious trivial actions without stakes → auto-success
	const trivial = TRIVIAL_HINTS.some((k) => text.includes(k));
	const stakes = STAKES_HINTS.some((k) => text.includes(k));
	if (trivial && !stakes) {
		return {
			requiresCheck: false,
			type: "none",
			rationale: "Тривиальное действие без ставок",
			alternative: "auto_success",
		};
	}

	// Active opposition → let LLM decide (could be contest)
	const opposition = ACTIVE_OPPOSITION_HINTS.some((k) => text.includes(k));
	// For non-trivial or potentially opposed actions — defer to LLM.

	// Default: defer to LLM. Intentionally conservative to avoid excessive checks.
	return null;
}
