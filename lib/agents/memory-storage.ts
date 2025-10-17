/**
 * Memory Storage Agent
 *
 * Extracts important events from game turns and stores them with embeddings.
 * Uses rule-based heuristics to detect importance and classify memory types.
 */

import { db } from "@/db";
import { type MemoryType, memoryEntries } from "@/db/schema";
import { STORAGE_CONFIG } from "@/lib/memory/config";
import { createEmbedding } from "@/lib/memory/embeddings";
import { logStorageOperation } from "@/lib/memory/logger";

const SUMMARY_MAX_LENGTH = 200;
const { EMBEDDING_TIMEOUT_MS, MAX_RETRIES } = STORAGE_CONFIG;

export interface MemoryExtractionResult {
	shouldStore: boolean;
	type?: MemoryType;
	summary?: string;
	fullText?: string;
	entities?: {
		locations?: string[];
		npcs?: string[];
		items?: string[];
	};
}

/**
 * Extract memory-worthy information from a game turn
 *
 * Uses rule-based pattern matching to detect important events
 * and classify them by type (location, npc, event, decision, item).
 *
 * @param playerMessage - Player's input message
 * @param gmMessage - GM's response message
 * @param turnNumber - Turn number in session
 * @returns Extraction result with type, summary, and entities
 */
export function extractMemoryFromTurn(
	playerMessage: string,
	gmMessage: string,
	turnNumber: number,
): MemoryExtractionResult {
	// Skip empty messages
	if (!playerMessage.trim() && !gmMessage.trim()) {
		return { shouldStore: false };
	}

	const combinedText = `${playerMessage} ${gmMessage}`;

	// Importance triggers (Russian language patterns)
	const importanceTriggers = [
		// Location arrival
		/прибыва(ешь|ет|ю|л|ла|ли) (в|на)/i,
		/(вход|входи)(ишь|т|л|ла|ли) (в|на)/i,

		// NPC encounter
		/встреча(ешь|ет|ю|л|ла|ли) (с |персонаж|NPC)/i,
		/(бармен|торговец|странник|воин|маг|жрец|король|королева)/i,
		/по имени/i,

		// Item/artifact
		/находи(шь|т|л|ла|ли) (артефакт|предмет|сокровище|меч|щит|амулет|кольцо)/i,
		/(бер|взял|получа)(ешь|ет|ю|л|ла|ли) (меч|щит|амулет|артефакт|предмет)/i,
		/магический|древний|легендарный/i,

		// Combat/victory
		/побежда(ешь|ет|ю|л|ла|ли)/i,
		/убива(ешь|ет|ю|л|ла|ли)/i,
		/(орк|дракон|гоблин|волк|зомби|скелет) (побежден|повержен|мертв)/i,

		// Quest/decision
		/получа(ешь|ет|ю|л|ла|ли) (квест|задание|миссию)/i,
		/(соглаша|принима)(ешься|ется|юсь|лся|лась) (помочь|выполнить)/i,
		/(завершил|выполнил|закончил)/i,
	];

	const hasImportantEvent = importanceTriggers.some((trigger) =>
		trigger.test(combinedText),
	);

	if (!hasImportantEvent) {
		return { shouldStore: false };
	}

	// Detect memory type
	const type = detectMemoryType(combinedText);

	// Extract entities
	const entities = extractEntities(combinedText);

	// Create summary (first 200 chars of GM message, or combined if short)
	const summary =
		gmMessage.length > 0
			? gmMessage.slice(0, SUMMARY_MAX_LENGTH)
			: playerMessage.slice(0, SUMMARY_MAX_LENGTH);

	// Full text for embedding (both messages)
	const fullText = `${playerMessage}\n${gmMessage}`;

	return {
		shouldStore: true,
		type,
		summary,
		fullText,
		entities,
	};
}

/**
 * Detect memory type based on content patterns
 */
function detectMemoryType(text: string): MemoryType {
	// Decision/quest patterns (check first - highest priority for quests)
	const decisionPatterns = [
		/получа(ешь|ет|ю|л|ла|ли) (квест|задание|миссию)/i,
		/(соглаша|принима)(ешься|ется|юсь|лся|лась)/i,
	];

	// Item patterns
	const itemPatterns = [
		/находи(шь|т|л|ла|ли) (артефакт|предмет|сокровище)/i,
		/(меч|щит|амулет|кольцо|посох|доспех)/i,
		/магический|древний|легендарный/i,
	];

	// NPC patterns
	const npcPatterns = [
		/встреча(ешь|ет|ю|л|ла|ли)/i,
		/(бармен|торговец|странник|воин|маг|жрец|король|королева|стражник)/i,
		/по имени/i,
	];

	// Location patterns
	const locationPatterns = [
		/прибыва(ешь|ет|ю|л|ла|ли) (в|на)/i,
		/(вход|входи)(ишь|т|л|ла|ли) (в|на)/i,
		/(город|деревн|таверн|пещер|замок|храм|лес)/i,
	];

	// Event patterns (combat, etc.)
	const eventPatterns = [
		/побежда(ешь|ет|ю|л|ла|ли)/i,
		/убива(ешь|ет|ю|л|ла|ли)/i,
		/(орк|дракон|гоблин|волк|зомби|скелет)/i,
	];

	// Priority order: decision > item > npc > location > event (default)
	if (decisionPatterns.some((p) => p.test(text))) {
		return "decision";
	}
	if (itemPatterns.some((p) => p.test(text))) {
		return "item";
	}
	if (npcPatterns.some((p) => p.test(text))) {
		return "npc";
	}
	if (locationPatterns.some((p) => p.test(text))) {
		return "location";
	}

	return "event";
}

/**
 * Extract entities (locations, NPCs, items) from text
 *
 * Uses simple pattern matching and capitalization heuristics.
 */
function extractEntities(text: string): {
	locations?: string[];
	npcs?: string[];
	items?: string[];
} {
	const entities: {
		locations?: string[];
		npcs?: string[];
		items?: string[];
	} = {};

	// Extract location names (after location markers or standalone city names)
	const locationMarkers = [
		/(?:город|деревн[яюе]|таверн[аеу]|пещер[аеу]|замок|храм|лес)\s+([А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+)*)/gi,
		/(?:в|на|о)\s+(?:древнем\s+)?город[еу]?\s+([А-ЯЁ][а-яё]+)/gi,
	];

	const locations = new Set<string>();
	for (const pattern of locationMarkers) {
		const matches = text.matchAll(pattern);
		for (const match of matches) {
			if (match[1] && match[1].length > 2) {
				locations.add(match[1]);
			}
		}
	}

	if (locations.size > 0) {
		entities.locations = Array.from(locations);
	}

	// Extract NPC names (capitalized words after role markers or "по имени")
	const npcMarkers = [
		/(?:бармен|торговец|странник|воин|маг|жрец|король|королева|стражник)\s+([А-ЯЁ][а-яё]+)/gi,
		/по имени\s+([А-ЯЁ][а-яё]+)/gi,
		/встреча(?:ешь|ет|ю|л|ла|ли)\s+(?:с\s+)?([А-ЯЁ][а-яё]+)/gi,
		/рассказыва(?:ет|ю)\s+(?:тебе\s+)?о\s+(?:древнем\s+)?город[еу]?\s+([А-ЯЁ][а-яё]+)/gi,
		/спрашива(?:ю|ешь)\s+([А-ЯЁ][а-яё]+[ау]?)/gi,
		/([А-ЯЁ][а-яё]+)\s+рассказыва(?:ет|ю)/gi,
	];

	const npcs = new Set<string>();
	for (const pattern of npcMarkers) {
		const matches = text.matchAll(pattern);
		for (const match of matches) {
			if (match[1] && match[1].length > 2) {
				npcs.add(match[1]);
			}
		}
	}

	if (npcs.size > 0) {
		entities.npcs = Array.from(npcs);
	}

	// Extract item names (multi-word capitalized phrases)
	const itemMarkers = [
		/(?:меч|щит|амулет|кольцо|посох|доспех|артефакт|предмет)\s+([А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+)*)/gi,
		/находи(?:шь|т|л|ла|ли)\s+([А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+)*)/gi,
		/([А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+)\s+и\s+([А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+)/g,
	];

	const items = new Set<string>();
	for (const pattern of itemMarkers) {
		const matches = text.matchAll(pattern);
		for (const match of matches) {
			// For the "X и Y" pattern, add both items
			if (match[2]) {
				if (match[1] && match[1].length > 2) {
					items.add(match[1]);
				}
				if (match[2] && match[2].length > 2) {
					items.add(match[2]);
				}
			} else if (match[1] && match[1].length > 2) {
				items.add(match[1]);
			}
		}
	}

	if (items.size > 0) {
		entities.items = Array.from(items);
	}

	return entities;
}

/**
 * Store memory in database with embedding
 *
 * Creates embedding for the memory text and inserts into database.
 * Includes retry logic for DB operations and graceful error handling.
 *
 * @param sessionId - Session ID
 * @param turnId - Turn ID (can be null)
 * @param turnNumber - Turn number
 * @param extraction - Extracted memory data
 */
export async function storeMemory(
	sessionId: number,
	turnId: number | null,
	turnNumber: number,
	extraction: MemoryExtractionResult,
): Promise<void> {
	if (!extraction.shouldStore) {
		return;
	}

	const { type, summary, fullText, entities } = extraction;

	if (!type || !summary || !fullText) {
		console.warn("[MemoryStorage] Missing required fields, skipping storage");
		return;
	}

	const startTime = Date.now();

	try {
		// Create embedding for summary + fullText
		const embeddingText = `${summary}\n${fullText}`;
		const embeddingResult = await createEmbedding(embeddingText, {
			timeoutMs: EMBEDDING_TIMEOUT_MS,
		});

		// Store in database with retry
		await storeWithRetry(
			sessionId,
			turnId,
			turnNumber,
			type,
			summary,
			fullText,
			embeddingResult.embedding,
			entities || {},
		);

		const storageTimeMs = Date.now() - startTime;

		// Log successful storage
		logStorageOperation(
			sessionId,
			turnNumber,
			type,
			summary,
			entities || {},
			embeddingResult.usage.totalTokens,
			storageTimeMs,
			true,
		);
	} catch (err) {
		const storageTimeMs = Date.now() - startTime;
		const error = err instanceof Error ? err : new Error(String(err));

		// Log failed storage
		logStorageOperation(
			sessionId,
			turnNumber,
			type || "unknown",
			summary || "",
			entities || {},
			0,
			storageTimeMs,
			false,
			error.message,
		);

		// Don't throw - storage failure should not break main flow
	}
}

/**
 * Store memory in database with retry attempts
 */
async function storeWithRetry(
	sessionId: number,
	turnId: number | null,
	turnNumber: number,
	type: MemoryType,
	summary: string,
	fullText: string,
	embedding: number[],
	entities: {
		locations?: string[];
		npcs?: string[];
		items?: string[];
	},
): Promise<void> {
	const maxAttempts = MAX_RETRIES + 1; // MAX_RETRIES is number of retries, so +1 for initial attempt

	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		try {
			await db
				.insert(memoryEntries)
				.values({
					sessionId,
					turnId,
					turnNumber,
					type,
					summary,
					fullText,
					embedding,
					entities,
				})
				.returning({ id: memoryEntries.id });

			return; // Success
		} catch (err) {
			const error = err instanceof Error ? err : new Error(String(err));
			console.error(
				`[MemoryStorage] DB insert attempt ${attempt + 1}/${maxAttempts} failed:`,
				error.message,
			);

			if (attempt === maxAttempts - 1) {
				throw error; // Final attempt failed
			}

			// Wait 500ms before retry
			await new Promise((resolve) => setTimeout(resolve, 500));
		}
	}
}
