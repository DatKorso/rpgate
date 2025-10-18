/**
 * World Knowledge Loader
 *
 * Loads world entities and relationships for narrative context
 */

import { db } from "@/db";
import { worldEntities, worldRelationships } from "@/db/schema";
import type { WorldEntityType } from "@/db/schema";
import { and, eq, inArray, or } from "drizzle-orm";

/**
 * World entity with its relationships
 */
export interface WorldEntityWithRelationships {
	id: number;
	type: WorldEntityType;
	name: string;
	properties: Record<string, unknown>;
	outgoingRelationships: Array<{
		targetEntity: { name: string; type: string };
		relationshipType: string;
		properties: Record<string, unknown>;
	}>;
	incomingRelationships: Array<{
		sourceEntity: { name: string; type: string };
		relationshipType: string;
		properties: Record<string, unknown>;
	}>;
}

/**
 * World knowledge context for narrative generation
 */
export interface WorldKnowledgeContext {
	entities: WorldEntityWithRelationships[];
	loadTimeMs: number;
}

/**
 * Options for loading world knowledge
 */
export interface LoadWorldKnowledgeOptions {
	maxDepth?: number; // How many hops to traverse (default: 1)
	maxEntities?: number; // Maximum entities to load (default: 20)
}

/**
 * Load world knowledge for mentioned entities
 *
 * Loads entities by name and their 1-hop neighbors via relationships.
 * Limits total entities to prevent context overflow.
 *
 * @param sessionId - Session ID
 * @param mentionedEntities - Array of entity names mentioned in player input
 * @param options - Loading options (maxDepth, maxEntities)
 * @returns World knowledge context with entities and relationships
 */
export async function loadWorldKnowledge(
	sessionId: number,
	mentionedEntities: string[],
	options?: LoadWorldKnowledgeOptions,
): Promise<WorldKnowledgeContext> {
	const startTime = Date.now();

	// Validate DATABASE_URL
	if (!process.env.DATABASE_URL) {
		console.error("[World Loader] DATABASE_URL not found in .env file");
		return {
			entities: [],
			loadTimeMs: Date.now() - startTime,
		};
	}

	// Default options
	const maxDepth = options?.maxDepth ?? 1;
	const maxEntities = options?.maxEntities ?? 20;

	// Normalize entity names for case-insensitive matching
	const normalizedNames = mentionedEntities.map((name) =>
		name.trim().toLowerCase(),
	);

	if (normalizedNames.length === 0) {
		return {
			entities: [],
			loadTimeMs: Date.now() - startTime,
		};
	}

	try {
		// Step 1: Load mentioned entities (case-insensitive)
		// Uses index: world_entity_session_type_idx and world_entity_name_idx
		const step1Start = Date.now();
		const mentionedEntityRecords = await db
			.select()
			.from(worldEntities)
			.where(
				and(
					eq(worldEntities.sessionId, sessionId),
					inArray(worldEntities.name, normalizedNames),
				),
			)
			.limit(maxEntities);
		const step1Time = Date.now() - step1Start;

		if (mentionedEntityRecords.length === 0) {
			console.log("[World Loader] No entities found", {
				sessionId,
				mentionedNames: normalizedNames,
				queryTimeMs: step1Time,
			});
			return {
				entities: [],
				loadTimeMs: Date.now() - startTime,
			};
		}

		const entityIds = new Set(mentionedEntityRecords.map((e) => e.id));
		const allEntityRecords = [...mentionedEntityRecords];

		// Step 2: Load 1-hop neighbors if maxDepth >= 1
		let step2Time = 0;
		if (maxDepth >= 1 && entityIds.size < maxEntities) {
			const step2Start = Date.now();
			const neighborIds = await load1HopNeighbors(
				sessionId,
				Array.from(entityIds),
				maxEntities - entityIds.size,
			);
			step2Time = Date.now() - step2Start;

			if (neighborIds.length > 0) {
				// Batch load neighbors using IN clause
				const neighborRecords = await db
					.select()
					.from(worldEntities)
					.where(inArray(worldEntities.id, neighborIds));

				for (const neighbor of neighborRecords) {
					if (!entityIds.has(neighbor.id)) {
						entityIds.add(neighbor.id);
						allEntityRecords.push(neighbor);
					}
				}
			}
		}

		// Step 3: Load all relationships for these entities
		// Uses indexes: world_rel_source_idx and world_rel_target_idx
		const step3Start = Date.now();
		const entityIdArray = Array.from(entityIds);
		const relationships = await db
			.select()
			.from(worldRelationships)
			.where(
				and(
					eq(worldRelationships.sessionId, sessionId),
					or(
						inArray(worldRelationships.sourceEntityId, entityIdArray),
						inArray(worldRelationships.targetEntityId, entityIdArray),
					),
				),
			);
		const step3Time = Date.now() - step3Start;

		// Step 4: Build entity map for quick lookup
		const entityMap = new Map(
			allEntityRecords.map((e) => [
				e.id,
				{
					id: e.id,
					type: e.type as WorldEntityType,
					name: e.name,
					properties: e.properties,
				},
			]),
		);

		// Step 5: Build entities with relationships
		const entitiesWithRelationships: WorldEntityWithRelationships[] = [];

		for (const entity of allEntityRecords) {
			const outgoing = relationships
				.filter((r) => r.sourceEntityId === entity.id)
				.map((r) => {
					const target = entityMap.get(r.targetEntityId);
					return {
						targetEntity: {
							name: target?.name ?? "Unknown",
							type: target?.type ?? "unknown",
						},
						relationshipType: r.relationshipType,
						properties: (r.properties as Record<string, unknown>) ?? {},
					};
				});

			const incoming = relationships
				.filter((r) => r.targetEntityId === entity.id)
				.map((r) => {
					const source = entityMap.get(r.sourceEntityId);
					return {
						sourceEntity: {
							name: source?.name ?? "Unknown",
							type: source?.type ?? "unknown",
						},
						relationshipType: r.relationshipType,
						properties: (r.properties as Record<string, unknown>) ?? {},
					};
				});

			entitiesWithRelationships.push({
				id: entity.id,
				type: entity.type as WorldEntityType,
				name: entity.name,
				properties: entity.properties,
				outgoingRelationships: outgoing,
				incomingRelationships: incoming,
			});
		}

		const loadTimeMs = Date.now() - startTime;

		console.log("[World Loader]", {
			sessionId,
			mentionedCount: mentionedEntities.length,
			loadedCount: entitiesWithRelationships.length,
			relationshipsCount: relationships.length,
			loadTimeMs,
			breakdown: {
				step1_load_mentioned_ms: step1Time,
				step2_load_neighbors_ms: step2Time,
				step3_load_relationships_ms: step3Time,
			},
		});

		return {
			entities: entitiesWithRelationships,
			loadTimeMs,
		};
	} catch (error) {
		console.error("[World Loader] Failed to load world knowledge:", error);
		return {
			entities: [],
			loadTimeMs: Date.now() - startTime,
		};
	}
}

/**
 * Load 1-hop neighbor entity IDs
 *
 * @param sessionId - Session ID
 * @param entityIds - Source entity IDs
 * @param limit - Maximum neighbors to load
 * @returns Array of neighbor entity IDs
 */
async function load1HopNeighbors(
	sessionId: number,
	entityIds: number[],
	limit: number,
): Promise<number[]> {
	// Load relationships where source or target is in entityIds
	const relationships = await db
		.select()
		.from(worldRelationships)
		.where(
			and(
				eq(worldRelationships.sessionId, sessionId),
				or(
					inArray(worldRelationships.sourceEntityId, entityIds),
					inArray(worldRelationships.targetEntityId, entityIds),
				),
			),
		)
		.limit(limit * 2); // Load more relationships to get enough neighbors

	// Extract neighbor IDs (entities connected to our entities)
	const neighborIds = new Set<number>();

	for (const rel of relationships) {
		if (entityIds.includes(rel.sourceEntityId)) {
			neighborIds.add(rel.targetEntityId);
		}
		if (entityIds.includes(rel.targetEntityId)) {
			neighborIds.add(rel.sourceEntityId);
		}
	}

	// Remove original entity IDs
	for (const id of entityIds) {
		neighborIds.delete(id);
	}

	// Return limited number of neighbors
	return Array.from(neighborIds).slice(0, limit);
}

/**
 * Format world knowledge context as structured text for LLM
 *
 * @param context - World knowledge context
 * @returns Formatted text for LLM prompt
 */
export function formatWorldKnowledgeForLLM(
	context: WorldKnowledgeContext,
): string {
	if (context.entities.length === 0) {
		return "";
	}

	const lines: string[] = ["=== WORLD KNOWLEDGE (только для GM) ==="];
	lines.push("Объективные факты о мире:");
	lines.push("");

	for (const entity of context.entities) {
		// Entity header
		const typeRu = translateEntityType(entity.type);
		lines.push(`${typeRu}: ${entity.name}`);

		// Properties
		for (const [key, value] of Object.entries(entity.properties)) {
			if (key === "aliases") continue; // Skip internal aliases
			lines.push(`- ${key}: ${formatPropertyValue(value)}`);
		}

		// Outgoing relationships
		if (entity.outgoingRelationships.length > 0) {
			const relStrings = entity.outgoingRelationships.map(
				(r) => `${r.relationshipType} → ${r.targetEntity.name}`,
			);
			lines.push(`- Связи: ${relStrings.join(", ")}`);
		}

		// Incoming relationships
		if (entity.incomingRelationships.length > 0) {
			const relStrings = entity.incomingRelationships.map(
				(r) => `${r.sourceEntity.name} → ${r.relationshipType}`,
			);
			lines.push(`- Связан с: ${relStrings.join(", ")}`);
		}

		lines.push("");
	}

	return lines.join("\n");
}

/**
 * Translate entity type to Russian
 */
function translateEntityType(type: WorldEntityType): string {
	const translations: Record<WorldEntityType, string> = {
		location: "Локация",
		npc: "NPC",
		item: "Предмет",
		faction: "Фракция",
		event: "Событие",
	};
	return translations[type] || type;
}

/**
 * Format property value for display
 */
function formatPropertyValue(value: unknown): string {
	if (typeof value === "string") {
		return value;
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
