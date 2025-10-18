/**
 * Player Knowledge Persistence Layer
 *
 * Handles database operations for player knowledge tracking
 */

import { db } from "@/db";
import { playerKnowledge, worldEntities } from "@/db/schema";
import type { AwarenessLevel, KnownFact } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import type {
	PlayerKnowledgeData,
	PlayerKnowledgeUpdate,
} from "../agents/protocol";
import { normalizeEntityName } from "./entity-utils";

export interface PlayerPersistenceResult {
	knowledgeCreated: number;
	knowledgeUpdated: number;
	factsAdded: number;
	errors: string[];
}

/**
 * Persist player knowledge update to database
 */
export async function persistPlayerKnowledge(
	sessionId: number,
	turnNumber: number,
	update: PlayerKnowledgeUpdate,
): Promise<PlayerPersistenceResult> {
	// Validate DATABASE_URL
	if (!process.env.DATABASE_URL) {
		throw new Error("[Player Persistence] DATABASE_URL not found in .env file");
	}

	const result: PlayerPersistenceResult = {
		knowledgeCreated: 0,
		knowledgeUpdated: 0,
		factsAdded: 0,
		errors: [],
	};

	try {
		for (const knowledgeData of update.updates) {
			try {
				const {
					created,
					factsAdded,
					awarenessLevelChanged,
					oldLevel,
					newLevel,
				} = await upsertPlayerKnowledge(sessionId, turnNumber, knowledgeData);

				if (created) {
					result.knowledgeCreated++;
					console.log("[Player Persistence] Knowledge Created", {
						sessionId,
						turnNumber,
						entity: knowledgeData.entityName,
						type: knowledgeData.entityType,
						awarenessLevel: knowledgeData.awarenessLevel,
						factsAdded,
					});
				} else {
					result.knowledgeUpdated++;
					console.log("[Player Persistence] Knowledge Updated", {
						sessionId,
						turnNumber,
						entity: knowledgeData.entityName,
						type: knowledgeData.entityType,
						factsAdded,
						awarenessLevelChanged,
						oldLevel,
						newLevel,
					});

					// Log awareness level changes specifically
					if (awarenessLevelChanged) {
						console.log("[Player Persistence] Awareness Level Changed", {
							sessionId,
							turnNumber,
							entity: knowledgeData.entityName,
							progression: `${oldLevel} → ${newLevel}`,
						});
					}
				}

				result.factsAdded += factsAdded;
			} catch (error) {
				const errorMsg = `Failed to upsert player knowledge for ${knowledgeData.entityName}: ${error instanceof Error ? error.message : String(error)}`;
				console.error("[Player Persistence]", errorMsg);
				result.errors.push(errorMsg);
			}
		}

		// Log summary
		console.log("[Player Persistence] Batch Complete", {
			sessionId,
			turnNumber,
			knowledgeCreated: result.knowledgeCreated,
			knowledgeUpdated: result.knowledgeUpdated,
			factsAdded: result.factsAdded,
			errors: result.errors.length,
		});

		return result;
	} catch (error) {
		console.error("[Player Persistence] Fatal error:", error);
		throw error;
	}
}

/**
 * Upsert player knowledge (create if new, update if exists)
 * Returns whether it was created, how many facts were added, and awareness level changes
 */
async function upsertPlayerKnowledge(
	sessionId: number,
	turnNumber: number,
	knowledgeData: PlayerKnowledgeData,
): Promise<{
	created: boolean;
	factsAdded: number;
	awarenessLevelChanged: boolean;
	oldLevel?: AwarenessLevel;
	newLevel?: AwarenessLevel;
}> {
	// Find the world entity (with fuzzy matching)
	const normalizedName = normalizeEntityName(knowledgeData.entityName);

	// First try exact match
	let entity = await db
		.select()
		.from(worldEntities)
		.where(
			and(
				eq(worldEntities.sessionId, sessionId),
				eq(worldEntities.type, knowledgeData.entityType),
				eq(worldEntities.name, normalizedName),
			),
		)
		.limit(1);

	// If no exact match, try fuzzy matching (e.g., "Автоматический Арбалет" -> "Арбалет")
	if (entity.length === 0) {
		const allEntities = await db
			.select()
			.from(worldEntities)
			.where(
				and(
					eq(worldEntities.sessionId, sessionId),
					eq(worldEntities.type, knowledgeData.entityType),
				),
			);

		// Find best match using similarity
		const { findBestMatch } = await import("@/lib/knowledge/entity-utils");
		const entityNames = allEntities.map((e) => e.name);
		const bestMatchIndex = findBestMatch(normalizedName, entityNames, 0.7);

		if (bestMatchIndex >= 0) {
			entity = [allEntities[bestMatchIndex]];
			console.log("[Player Persistence] Fuzzy matched entity:", {
				requested: knowledgeData.entityName,
				matched: entity[0].name,
			});
		}
	}

	if (entity.length === 0) {
		throw new Error(
			`Entity not found: ${knowledgeData.entityName} (${knowledgeData.entityType})`,
		);
	}

	const entityId = entity[0].id;

	// Check if player knowledge already exists
	const existing = await db
		.select()
		.from(playerKnowledge)
		.where(
			and(
				eq(playerKnowledge.sessionId, sessionId),
				eq(playerKnowledge.entityId, entityId),
			),
		)
		.limit(1);

	// Convert new facts to KnownFact format
	const newFacts: KnownFact[] = knowledgeData.newFacts.map((fact) => ({
		property: fact.property,
		value: fact.value,
		learnedAt: turnNumber,
		source: fact.source as KnownFact["source"],
		confidence: fact.confidence as KnownFact["confidence"],
	}));

	if (existing.length > 0) {
		// Player knowledge exists - update it
		const existingKnowledge = existing[0];
		const currentFacts = existingKnowledge.knownFacts as KnownFact[];

		// Append new facts (never remove existing ones)
		const updatedFacts = [...currentFacts, ...newFacts];

		// Progress awareness level (never regress)
		const oldLevel = existingKnowledge.awarenessLevel as AwarenessLevel;
		const updatedAwarenessLevel = progressAwarenessLevel(
			oldLevel,
			knowledgeData.awarenessLevel,
		);
		const awarenessLevelChanged = oldLevel !== updatedAwarenessLevel;

		await db
			.update(playerKnowledge)
			.set({
				awarenessLevel: updatedAwarenessLevel,
				knownFacts: updatedFacts,
				updatedAt: new Date(),
			})
			.where(eq(playerKnowledge.id, existingKnowledge.id));

		return {
			created: false,
			factsAdded: newFacts.length,
			awarenessLevelChanged,
			oldLevel,
			newLevel: updatedAwarenessLevel,
		};
	}

	// Player knowledge doesn't exist - create new
	await db.insert(playerKnowledge).values({
		sessionId,
		entityId,
		awarenessLevel: knowledgeData.awarenessLevel,
		knownFacts: newFacts,
	});

	return {
		created: true,
		factsAdded: newFacts.length,
		awarenessLevelChanged: false,
	};
}

/**
 * Progress awareness level (never regress)
 * Order: unaware < heard_of < met < familiar
 */
function progressAwarenessLevel(
	current: AwarenessLevel,
	proposed: AwarenessLevel,
): AwarenessLevel {
	const levels: AwarenessLevel[] = ["unaware", "heard_of", "met", "familiar"];

	const currentIndex = levels.indexOf(current);
	const proposedIndex = levels.indexOf(proposed);

	// Return the higher level
	return proposedIndex > currentIndex ? proposed : current;
}

/**
 * Get player knowledge for a session
 */
export async function getPlayerKnowledge(
	sessionId: number,
	entityIds?: number[],
) {
	if (entityIds && entityIds.length > 0) {
		// Get knowledge for specific entities
		return await db
			.select()
			.from(playerKnowledge)
			.where(
				and(
					eq(playerKnowledge.sessionId, sessionId),
					// @ts-expect-error - Drizzle typing issue with inArray
					eq(playerKnowledge.entityId, entityIds),
				),
			);
	}

	// Get all knowledge for session
	return await db
		.select()
		.from(playerKnowledge)
		.where(eq(playerKnowledge.sessionId, sessionId));
}

/**
 * Get player knowledge for specific entity
 */
export async function getPlayerKnowledgeForEntity(
	sessionId: number,
	entityId: number,
) {
	const result = await db
		.select()
		.from(playerKnowledge)
		.where(
			and(
				eq(playerKnowledge.sessionId, sessionId),
				eq(playerKnowledge.entityId, entityId),
			),
		)
		.limit(1);

	return result.length > 0 ? result[0] : null;
}
