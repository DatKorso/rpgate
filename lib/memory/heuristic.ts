import type { ChatHistoryEntry } from "@/lib/agents/protocol";
import { HEURISTIC_CONFIG } from "./config";
import { logHeuristicDecision } from "./logger";

const { CONFIDENCE_THRESHOLD, RECENT_CONTEXT_SIZE } = HEURISTIC_CONFIG;

export type TriggerType =
	| "location_return"
	| "past_question"
	| "npc_mention"
	| "explicit_request"
	| "unknown_entity";

export interface HeuristicResult {
	shouldRetrieve: boolean;
	triggers: TriggerType[];
	entities: string[];
	confidence: number;
}

/**
 * Analyzes player input to determine if memory retrieval is needed
 * Uses pattern matching and entity extraction without LLM calls
 */
export function analyzeMemoryNeed(
	playerInput: string,
	recentContext: ChatHistoryEntry[],
): HeuristicResult {
	if (!playerInput || playerInput.trim().length === 0) {
		return {
			shouldRetrieve: false,
			triggers: [],
			entities: [],
			confidence: 0.0,
		};
	}

	const triggers: TriggerType[] = [];
	const entities: string[] = [];
	let confidence = 0.0;

	// Pattern matching for triggers
	const patterns = {
		explicit_request: [
			/помнишь/i,
			/вспомни/i,
			/расскажи (о|про)/i,
			/напомни/i,
			/что ты знаешь/i,
		],
		location_return: [
			/вернул(ся|ась|ись) (в|на|к)/i,
			/иду (в|на|к)/i,
			/вхожу (в|на)/i,
			/въезжа(ю|ем) (в|на)/i,
			/возвращаюсь (в|на|к)/i,
			/прибыва(ю|ем) (в|на|к)/i,
			/отправля(юсь|емся) (в|на|к)/i,
			/направля(юсь|емся) (в|на|к)/i,
			/(вход|входи)(л|ла|ли|шь|т|ю) (в|на)/i,
		],
		past_question: [
			/что (было|был|была)/i,
			/где (я|мы) (был|была|были)/i,
			/когда (я|мы)/i,
			/как (я|мы) (попал|попала|попали)/i,
			/что случилось/i,
			/что произошло/i,
		],
		npc_mention: [
			/кто (такой|такая|это|этот)/i,
			/где (находится|живет|живёт)/i,
			/что (за|это за) (человек|персонаж)/i,
			/встреча(ю|л|ла|ли) (с |кого-то)/i,
		],
	};

	// Check each pattern type
	for (const [triggerType, regexList] of Object.entries(patterns)) {
		for (const regex of regexList) {
			if (regex.test(playerInput)) {
				triggers.push(triggerType as TriggerType);
				break; // Only add trigger type once
			}
		}
	}

	// Entity extraction
	const extractedEntities = extractEntities(playerInput);
	entities.push(...extractedEntities);

	// Check for unknown entities (not in recent context)
	const unknownEntities = findUnknownEntities(extractedEntities, recentContext);
	if (unknownEntities.length > 0) {
		triggers.push("unknown_entity");
	}

	// Confidence scoring
	if (triggers.includes("explicit_request")) {
		confidence = 1.0;
	} else if (
		triggers.includes("location_return") &&
		triggers.includes("unknown_entity")
	) {
		confidence = 0.9;
	} else if (triggers.includes("past_question")) {
		confidence = 0.8;
	} else if (triggers.includes("unknown_entity")) {
		confidence = 0.6;
	} else if (
		triggers.includes("location_return") ||
		triggers.includes("npc_mention")
	) {
		confidence = 0.7;
	}

	const shouldRetrieve = confidence >= CONFIDENCE_THRESHOLD;

	const result = {
		shouldRetrieve,
		triggers: [...new Set(triggers)], // Remove duplicates
		entities,
		confidence,
	};

	// Log heuristic decision
	logHeuristicDecision(
		playerInput,
		result.shouldRetrieve,
		result.triggers,
		result.entities,
		result.confidence,
	);

	return result;
}

/**
 * Extracts entities from text (capitalized words, location markers)
 */
function extractEntities(text: string): string[] {
	const entities: string[] = [];

	// Extract location markers: "город X", "таверна Y", "пещера Z"
	const locationPatterns = [
		/(город|деревня|таверна|пещера|замок|крепость|храм|лес|гора|река|озеро|дом|здание)\s+([А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+)*)/gi,
	];

	for (const pattern of locationPatterns) {
		const matches = text.matchAll(pattern);
		for (const match of matches) {
			// Capture the full location name (e.g., "Золотой Дракон")
			entities.push(match[2]);
		}
	}

	// Extract capitalized words (potential names/places)
	// Not at sentence start, 2+ characters
	const sentences = text.split(/[.!?]\s+/);
	for (const sentence of sentences) {
		const words = sentence.split(/\s+/);
		// Skip first word (sentence start)
		for (let i = 1; i < words.length; i++) {
			const word = words[i].replace(/[,;:()]/g, "");
			// Check if word starts with capital letter and is 2+ chars
			if (/^[А-ЯЁ][а-яё]{1,}$/.test(word)) {
				entities.push(word);
			}
		}
	}

	return [...new Set(entities)]; // Remove duplicates
}

/**
 * Finds entities that are not mentioned in recent context
 */
function findUnknownEntities(
	entities: string[],
	recentContext: ChatHistoryEntry[],
): string[] {
	if (entities.length === 0) {
		return [];
	}

	// Get last N messages from context (configured)
	const recentMessages = recentContext.slice(-RECENT_CONTEXT_SIZE);
	const contextText = recentMessages.map((m) => m.content).join(" ");

	// Find entities not in recent context
	return entities.filter((entity) => {
		// Case-insensitive search
		return !contextText.toLowerCase().includes(entity.toLowerCase());
	});
}
