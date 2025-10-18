/**
 * Player Knowledge Loader
 *
 * Loads player character knowledge for narrative context
 */

import { db } from "@/db";
import { playerKnowledge, worldEntities } from "@/db/schema";
import type { AwarenessLevel, KnownFact } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { normalizeEntityName } from "./entity-utils";

/**
 * Player knowledge entry with entity details
 */
export interface PlayerKnowledgeEntry {
	entity: {
		id: number;
		name: string;
		type: string;
	};
	awarenessLevel: AwarenessLevel;
	knownFacts: KnownFact[];
}

/**
 * Player knowledge context for narrative generation
 */
export interface PlayerKnowledgeContext {
	knownEntities: PlayerKnowledgeEntry[];
	loadTimeMs: number;
}

/**
 * Load player knowledge for mentioned entities
 *
 * Loads what the player character knows about entities mentioned in their input.
 * This ensures the GM only uses information the PC has actually learned.
 *
 * @param sessionId - Session ID
 * @param mentionedEntities - Array of entity names mentioned in player input
 * @returns Player knowledge context with known entities and facts
 */
export async function loadPlayerKnowledge(
	sessionId: number,
	mentionedEntities: string[],
): Promise<PlayerKnowledgeContext> {
	const startTime = Date.now();

	// Validate DATABASE_URL
	if (!process.env.DATABASE_URL) {
		console.error("[Player Loader] DATABASE_URL not found in .env file");
		return {
			knownEntities: [],
			loadTimeMs: Date.now() - startTime,
		};
	}

	// Normalize entity names for case-insensitive matching
	const normalizedNames = mentionedEntities.map((name) =>
		normalizeEntityName(name),
	);

	if (normalizedNames.length === 0) {
		return {
			knownEntities: [],
			loadTimeMs: Date.now() - startTime,
		};
	}

	try {
		// Step 1: Find world entities by name
		const entities = await db
			.select()
			.from(worldEntities)
			.where(
				and(
					eq(worldEntities.sessionId, sessionId),
					inArray(worldEntities.name, normalizedNames),
				),
			);

		if (entities.length === 0) {
			console.log("[Player Loader] No entities found", {
				sessionId,
				mentionedNames: normalizedNames,
			});
			return {
				knownEntities: [],
				loadTimeMs: Date.now() - startTime,
			};
		}

		const entityIds = entities.map((e) => e.id);

		// Step 2: Load player knowledge for these entities
		const knowledgeRecords = await db
			.select()
			.from(playerKnowledge)
			.where(
				and(
					eq(playerKnowledge.sessionId, sessionId),
					inArray(playerKnowledge.entityId, entityIds),
				),
			);

		// Step 3: Build entity map for quick lookup
		const entityMap = new Map(
			entities.map((e) => [
				e.id,
				{
					id: e.id,
					name: e.name,
					type: e.type,
				},
			]),
		);

		// Step 4: Build player knowledge entries
		const knownEntities: PlayerKnowledgeEntry[] = knowledgeRecords
			.map((knowledge) => {
				const entity = entityMap.get(knowledge.entityId);
				if (!entity) return null;

				return {
					entity,
					awarenessLevel: knowledge.awarenessLevel as AwarenessLevel,
					knownFacts: knowledge.knownFacts as KnownFact[],
				};
			})
			.filter((entry): entry is PlayerKnowledgeEntry => entry !== null);

		const loadTimeMs = Date.now() - startTime;

		console.log("[Player Loader]", {
			sessionId,
			mentionedCount: mentionedEntities.length,
			entitiesFound: entities.length,
			knownEntitiesCount: knownEntities.length,
			loadTimeMs,
		});

		return {
			knownEntities,
			loadTimeMs,
		};
	} catch (error) {
		console.error("[Player Loader] Failed to load player knowledge:", error);
		return {
			knownEntities: [],
			loadTimeMs: Date.now() - startTime,
		};
	}
}

/**
 * Format player knowledge context as structured text for LLM
 *
 * @param context - Player knowledge context
 * @returns Formatted text for LLM prompt
 */
export function formatPlayerKnowledgeForLLM(
	context: PlayerKnowledgeContext,
): string {
	if (context.knownEntities.length === 0) {
		return "";
	}

	const lines: string[] = ["=== PLAYER CHARACTER KNOWLEDGE ==="];
	lines.push("Что персонаж ЗНАЕТ:");
	lines.push("");

	for (const entry of context.knownEntities) {
		// Entity header
		lines.push(`${entry.entity.name}:`);

		// Awareness level
		const awarenessRu = translateAwarenessLevel(entry.awarenessLevel);
		lines.push(`- Уровень знакомства: ${awarenessRu}`);

		// Known facts
		if (entry.knownFacts.length > 0) {
			lines.push("- Известные факты:");
			for (const fact of entry.knownFacts) {
				const sourceRu = translateKnowledgeSource(fact.source);
				const confidenceStr = fact.confidence
					? ` (${translateConfidence(fact.confidence)})`
					: "";
				lines.push(
					`  * ${fact.property}: ${formatFactValue(fact.value)} (узнал: ход ${fact.learnedAt}, источник: ${sourceRu})${confidenceStr}`,
				);
			}
		} else {
			lines.push("- Известные факты: нет");
		}

		lines.push("");
	}

	return lines.join("\n");
}

/**
 * Translate awareness level to Russian
 */
function translateAwarenessLevel(level: AwarenessLevel): string {
	const translations: Record<AwarenessLevel, string> = {
		unaware: "не знает",
		heard_of: "слышал о нём",
		met: "встречал",
		familiar: "хорошо знаком",
	};
	return translations[level] || level;
}

/**
 * Translate knowledge source to Russian
 */
function translateKnowledgeSource(source: KnownFact["source"]): string {
	const translations: Record<KnownFact["source"], string> = {
		arrived: "прибыл",
		observation: "наблюдение",
		heard_from_npc: "услышал от NPC",
		read_in_book: "прочитал в книге",
		met_personally: "встретил лично",
		owns: "владеет",
		used: "использовал",
	};
	return translations[source] || source;
}

/**
 * Translate confidence level to Russian
 */
function translateConfidence(
	confidence: "certain" | "likely" | "rumor",
): string {
	const translations = {
		certain: "уверен",
		likely: "вероятно",
		rumor: "слух",
	};
	return translations[confidence] || confidence;
}

/**
 * Format fact value for display
 */
function formatFactValue(value: unknown): string {
	if (typeof value === "string") {
		return `"${value}"`;
	}
	if (typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}
	if (Array.isArray(value)) {
		return value.join(", ");
	}
	if (typeof value === "object" && value !== null) {
		return JSON.stringify(value);
	}
	return String(value);
}
