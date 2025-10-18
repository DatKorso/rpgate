/**
 * World Knowledge Persistence Layer
 *
 * Handles database operations for world entities and relationships
 */

import { db } from "@/db";
import { worldEntities, worldRelationships } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import type {
	WorldEntityData,
	WorldKnowledgeUpdate,
	WorldRelationshipData,
} from "../agents/protocol";
import {
	addEntityAlias,
	findBestMatch,
	mergeEntityProperties,
	normalizeEntityName,
} from "./entity-utils";

export interface PersistenceResult {
	entitiesCreated: number;
	entitiesUpdated: number;
	relationshipsCreated: number;
	errors: string[];
}

/**
 * Persist world knowledge update to database
 */
export async function persistWorldKnowledge(
	sessionId: number,
	update: WorldKnowledgeUpdate,
): Promise<PersistenceResult> {
	// Validate DATABASE_URL
	if (!process.env.DATABASE_URL) {
		throw new Error("[World Persistence] DATABASE_URL not found in .env file");
	}

	const result: PersistenceResult = {
		entitiesCreated: 0,
		entitiesUpdated: 0,
		relationshipsCreated: 0,
		errors: [],
	};

	try {
		// Process entities first
		const entityMap = new Map<string, number>(); // normalized name -> entity id

		for (const entityData of update.entities) {
			try {
				const entityId = await upsertEntity(sessionId, entityData);
				const normalizedName = normalizeEntityName(entityData.name);
				entityMap.set(normalizedName, entityId);

				if (entityData.isNew) {
					result.entitiesCreated++;
				} else {
					result.entitiesUpdated++;
				}
			} catch (error) {
				const errorMsg = `Failed to upsert entity ${entityData.name}: ${error instanceof Error ? error.message : String(error)}`;
				console.error("[World Persistence]", errorMsg);
				result.errors.push(errorMsg);
			}
		}

		// Process relationships
		for (const relData of update.relationships) {
			try {
				await createRelationship(sessionId, relData, entityMap);
				result.relationshipsCreated++;
			} catch (error) {
				const errorMsg = `Failed to create relationship ${relData.sourceEntityName} -> ${relData.targetEntityName}: ${error instanceof Error ? error.message : String(error)}`;
				console.error("[World Persistence]", errorMsg);
				result.errors.push(errorMsg);
			}
		}

		return result;
	} catch (error) {
		console.error("[World Persistence] Fatal error:", error);
		throw error;
	}
}

/**
 * Upsert entity (create if new, update if exists)
 * Returns entity ID
 */
async function upsertEntity(
	sessionId: number,
	entityData: WorldEntityData,
): Promise<number> {
	const normalizedName = normalizeEntityName(entityData.name);

	// Check if entity already exists
	const existing = await db
		.select()
		.from(worldEntities)
		.where(
			and(
				eq(worldEntities.sessionId, sessionId),
				eq(worldEntities.type, entityData.type),
				eq(worldEntities.name, normalizedName),
			),
		)
		.limit(1);

	if (existing.length > 0) {
		// Entity exists - update properties
		const existingEntity = existing[0];
		const mergedProperties = mergeEntityProperties(
			existingEntity.properties,
			entityData.properties,
		);

		await db
			.update(worldEntities)
			.set({
				properties: mergedProperties,
				updatedAt: new Date(),
			})
			.where(eq(worldEntities.id, existingEntity.id));

		entityData.isNew = false;
		return existingEntity.id;
	}

	// Check for similar entities (fuzzy matching)
	const similarEntities = await db
		.select()
		.from(worldEntities)
		.where(
			and(
				eq(worldEntities.sessionId, sessionId),
				eq(worldEntities.type, entityData.type),
			),
		);

	if (similarEntities.length > 0) {
		const existingNames = similarEntities.map((e) => e.name);
		const matchIndex = findBestMatch(normalizedName, existingNames, 0.85);

		if (matchIndex !== -1) {
			// Found similar entity - update it and add alias
			const matchedEntity = similarEntities[matchIndex];
			const mergedProperties = mergeEntityProperties(
				matchedEntity.properties,
				entityData.properties,
			);

			// Add original name as alias if different
			const propertiesWithAlias =
				normalizedName !== matchedEntity.name
					? addEntityAlias(mergedProperties, normalizedName)
					: mergedProperties;

			await db
				.update(worldEntities)
				.set({
					properties: propertiesWithAlias,
					updatedAt: new Date(),
				})
				.where(eq(worldEntities.id, matchedEntity.id));

			console.log(
				`[World Persistence] Merged entity "${normalizedName}" into existing "${matchedEntity.name}"`,
			);

			entityData.isNew = false;
			return matchedEntity.id;
		}
	}

	// Entity doesn't exist - create new
	const inserted = await db
		.insert(worldEntities)
		.values({
			sessionId,
			type: entityData.type,
			name: normalizedName,
			properties: entityData.properties,
		})
		.returning({ id: worldEntities.id });

	entityData.isNew = true;
	return inserted[0].id;
}

/**
 * Create relationship between entities
 */
async function createRelationship(
	sessionId: number,
	relData: WorldRelationshipData,
	entityMap: Map<string, number>,
): Promise<void> {
	// Resolve entity IDs
	const sourceNormalized = normalizeEntityName(relData.sourceEntityName);
	const targetNormalized = normalizeEntityName(relData.targetEntityName);

	let sourceId = entityMap.get(sourceNormalized);
	let targetId = entityMap.get(targetNormalized);

	// If entities not in current batch, look them up in database
	if (!sourceId) {
		sourceId = await findEntityId(sessionId, sourceNormalized);
	}

	if (!targetId) {
		targetId = await findEntityId(sessionId, targetNormalized);
	}

	if (!sourceId || !targetId) {
		throw new Error(
			`Cannot create relationship: missing entities (source: ${relData.sourceEntityName}, target: ${relData.targetEntityName})`,
		);
	}

	// Check if relationship already exists
	const existing = await db
		.select()
		.from(worldRelationships)
		.where(
			and(
				eq(worldRelationships.sessionId, sessionId),
				eq(worldRelationships.sourceEntityId, sourceId),
				eq(worldRelationships.targetEntityId, targetId),
				eq(worldRelationships.relationshipType, relData.relationshipType),
			),
		)
		.limit(1);

	if (existing.length > 0) {
		// Relationship already exists - optionally update properties
		if (relData.properties && Object.keys(relData.properties).length > 0) {
			const mergedProperties = mergeEntityProperties(
				existing[0].properties ?? {},
				relData.properties,
			);

			await db
				.update(worldRelationships)
				.set({
					properties: mergedProperties,
				})
				.where(eq(worldRelationships.id, existing[0].id));
		}
		return;
	}

	// Create new relationship
	await db.insert(worldRelationships).values({
		sessionId,
		sourceEntityId: sourceId,
		targetEntityId: targetId,
		relationshipType: relData.relationshipType,
		properties: relData.properties ?? {},
	});
}

/**
 * Find entity ID by name (with fuzzy matching)
 */
async function findEntityId(
	sessionId: number,
	normalizedName: string,
): Promise<number | undefined> {
	// Try exact match first
	const exact = await db
		.select({ id: worldEntities.id })
		.from(worldEntities)
		.where(
			and(
				eq(worldEntities.sessionId, sessionId),
				eq(worldEntities.name, normalizedName),
			),
		)
		.limit(1);

	if (exact.length > 0) {
		return exact[0].id;
	}

	// Try fuzzy match
	const allEntities = await db
		.select({ id: worldEntities.id, name: worldEntities.name })
		.from(worldEntities)
		.where(eq(worldEntities.sessionId, sessionId));

	if (allEntities.length > 0) {
		const names = allEntities.map((e) => e.name);
		const matchIndex = findBestMatch(normalizedName, names, 0.85);

		if (matchIndex !== -1) {
			return allEntities[matchIndex].id;
		}
	}

	return undefined;
}

/**
 * Get all entities for a session
 */
export async function getSessionEntities(sessionId: number) {
	return await db
		.select()
		.from(worldEntities)
		.where(eq(worldEntities.sessionId, sessionId));
}

/**
 * Get all relationships for a session
 */
export async function getSessionRelationships(sessionId: number) {
	return await db
		.select()
		.from(worldRelationships)
		.where(eq(worldRelationships.sessionId, sessionId));
}
