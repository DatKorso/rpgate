/**
 * Narrative Context Builder
 *
 * Builds comprehensive context for Narrative Agent including:
 * - Chat history
 * - Vector memories
 * - World knowledge (objective facts)
 * - Player knowledge (what PC knows)
 */

import type { ChatHistoryEntry, MemoryEntryData } from "@/lib/agents/protocol";
import {
	type PlayerKnowledgeContext,
	loadPlayerKnowledge,
} from "@/lib/knowledge/player-loader";
import {
	type WorldKnowledgeContext,
	loadWorldKnowledge,
} from "@/lib/knowledge/world-loader";

/**
 * Character profile for narrative context
 */
export interface CharacterProfile {
	className: string;
	bio: string;
	abilities: {
		str: number;
		dex: number;
		con: number;
		int: number;
		wis: number;
		cha: number;
	};
}

/**
 * Comprehensive narrative context
 */
export interface NarrativeContext {
	history: ChatHistoryEntry[];
	vectorMemories?: MemoryEntryData[];
	worldKnowledge?: WorldKnowledgeContext;
	playerKnowledge?: PlayerKnowledgeContext;
	characterProfile?: CharacterProfile | null;
}

/**
 * Options for building narrative context
 */
export interface BuildNarrativeContextOptions {
	loadWorldKnowledge?: boolean;
	loadPlayerKnowledge?: boolean;
	maxWorldEntities?: number;
	maxWorldDepth?: number;
}

/**
 * Build comprehensive narrative context
 *
 * Combines all available context sources for the Narrative Agent:
 * - Chat history (recent turns)
 * - Vector memories (semantic search results)
 * - World knowledge (objective facts about entities)
 * - Player knowledge (what PC has learned)
 *
 * @param sessionId - Database session ID
 * @param playerInput - Current player input
 * @param history - Recent chat history
 * @param vectorMemories - Memories from vector search (optional)
 * @param mentionedEntities - Entity names extracted from player input (optional)
 * @param characterProfile - Character profile (optional)
 * @param options - Loading options
 * @returns Complete narrative context
 */
export async function buildNarrativeContext(
	sessionId: number,
	playerInput: string,
	history: ChatHistoryEntry[],
	vectorMemories?: MemoryEntryData[],
	mentionedEntities?: string[],
	characterProfile?: CharacterProfile | null,
	options?: BuildNarrativeContextOptions,
): Promise<NarrativeContext> {
	const context: NarrativeContext = {
		history,
		vectorMemories,
		characterProfile,
	};

	// Load world knowledge if requested and entities are mentioned
	if (
		options?.loadWorldKnowledge !== false &&
		mentionedEntities &&
		mentionedEntities.length > 0
	) {
		try {
			const worldKnowledge = await loadWorldKnowledge(
				sessionId,
				mentionedEntities,
				{
					maxDepth: options?.maxWorldDepth ?? 1,
					maxEntities: options?.maxWorldEntities ?? 20,
				},
			);

			if (worldKnowledge.entities.length > 0) {
				context.worldKnowledge = worldKnowledge;
			}
		} catch (error) {
			console.error(
				"[Narrative Context] Failed to load world knowledge:",
				error,
			);
			// Continue without world knowledge
		}
	}

	// Load player knowledge if requested and entities are mentioned
	if (
		options?.loadPlayerKnowledge !== false &&
		mentionedEntities &&
		mentionedEntities.length > 0
	) {
		try {
			const playerKnowledge = await loadPlayerKnowledge(
				sessionId,
				mentionedEntities,
			);

			if (playerKnowledge.knownEntities.length > 0) {
				context.playerKnowledge = playerKnowledge;
			}
		} catch (error) {
			console.error(
				"[Narrative Context] Failed to load player knowledge:",
				error,
			);
			// Continue without player knowledge
		}
	}

	return context;
}
