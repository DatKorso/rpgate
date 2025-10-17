/**
 * Memory Agent - Retrieval of relevant memories via vector similarity search
 *
 * Retrieves memories from pgvector storage based on semantic similarity
 * to player input. Includes timeout handling and graceful error fallback.
 */

import { db } from "@/db";
import type { MemoryEntryData, MemoryType } from "@/db/schema";
import { RETRIEVAL_CONFIG } from "@/lib/memory/config";
import { createEmbedding } from "@/lib/memory/embeddings";
import { logRetrievalOperation } from "@/lib/memory/logger";
import { sql } from "drizzle-orm";

const {
	DEFAULT_LIMIT,
	DEFAULT_SIMILARITY_THRESHOLD,
	DEFAULT_TIMEOUT_MS,
	QUERY_EMBEDDING_TIMEOUT_MS,
} = RETRIEVAL_CONFIG;

export interface MemoryRetrievalOptions {
	limit?: number;
	similarityThreshold?: number;
	typeFilter?: MemoryType[];
	entityFilter?: string[];
	timeoutMs?: number;
}

export interface MemoryRetrievalResult {
	memories: MemoryEntryData[];
	retrievalTimeMs: number;
	query: string;
}

/**
 * Retrieve relevant memories for a session based on semantic similarity
 *
 * @param sessionId - Session ID to retrieve memories for
 * @param query - Query text to search for (player input)
 * @param options - Retrieval configuration (limit, threshold, filters, timeout)
 * @returns Retrieval result with memories and metrics
 */
export async function retrieveMemories(
	sessionId: number,
	query: string,
	options: MemoryRetrievalOptions = {},
): Promise<MemoryRetrievalResult> {
	const startTime = Date.now();
	const limit = options.limit ?? DEFAULT_LIMIT;
	const similarityThreshold =
		options.similarityThreshold ?? DEFAULT_SIMILARITY_THRESHOLD;
	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

	// Empty result fallback
	const emptyResult: MemoryRetrievalResult = {
		memories: [],
		retrievalTimeMs: 0,
		query,
	};

	try {
		// Create query embedding with timeout
		const retrievalPromise = performRetrieval(
			sessionId,
			query,
			limit,
			similarityThreshold,
			options.typeFilter,
			options.entityFilter,
		);

		// Race against timeout
		const result = await Promise.race([
			retrievalPromise,
			timeoutPromise(timeoutMs),
		]);

		const retrievalTimeMs = Date.now() - startTime;

		// Extract similarity scores for logging
		const similarityScores = result
			.map((m) => m.similarity)
			.filter((s): s is number => s !== undefined);

		// Log retrieval operation
		logRetrievalOperation(
			sessionId,
			query,
			result.length,
			retrievalTimeMs,
			similarityScores,
		);

		return {
			memories: result,
			retrievalTimeMs,
			query,
		};
	} catch (err) {
		const retrievalTimeMs = Date.now() - startTime;

		const isTimeout = err instanceof TimeoutError;
		const errorMessage = err instanceof Error ? err.message : String(err);

		// Log retrieval error/timeout
		logRetrievalOperation(
			sessionId,
			query,
			0,
			retrievalTimeMs,
			[],
			isTimeout,
			!isTimeout,
			errorMessage,
		);

		return {
			...emptyResult,
			retrievalTimeMs,
		};
	}
}

/**
 * Perform the actual retrieval operation
 */
async function performRetrieval(
	sessionId: number,
	query: string,
	limit: number,
	similarityThreshold: number,
	typeFilter?: MemoryType[],
	entityFilter?: string[],
): Promise<MemoryEntryData[]> {
	// Step 1: Create query embedding
	let queryEmbedding: number[];
	try {
		const embeddingResult = await createEmbedding(query, {
			timeoutMs: QUERY_EMBEDDING_TIMEOUT_MS,
		});
		queryEmbedding = embeddingResult.embedding;
	} catch (err) {
		console.error("[Memory Agent] Failed to create query embedding:", {
			error: err instanceof Error ? err.message : String(err),
			query: query.slice(0, 100),
		});
		return [];
	}

	// Step 2: Vector similarity search
	try {
		// Build SQL query with pgvector cosine distance
		// Note: pgvector uses <=> for cosine distance, similarity = 1 - distance
		const embeddingStr = JSON.stringify(queryEmbedding);

		const results = await db.execute<{
			id: number;
			summary: string;
			full_text: string;
			type: string;
			entities: string;
			turn_number: number;
			similarity: number;
		}>(sql`
			SELECT 
				id,
				summary,
				full_text,
				type,
				entities,
				turn_number,
				1 - (embedding <=> ${embeddingStr}::vector) as similarity
			FROM "MemoryEntry"
			WHERE 
				session_id = ${sessionId}
				AND embedding IS NOT NULL
				AND 1 - (embedding <=> ${embeddingStr}::vector) >= ${similarityThreshold}
			ORDER BY similarity DESC
			LIMIT ${limit}
		`);

		// Parse and filter results
		let memories: MemoryEntryData[] = results.rows.map((row) => ({
			id: row.id,
			summary: row.summary,
			fullText: row.full_text,
			type: row.type as MemoryType,
			entities:
				typeof row.entities === "string"
					? JSON.parse(row.entities)
					: row.entities,
			turnNumber: row.turn_number,
			similarity: row.similarity,
		}));

		// Apply type filter if specified
		if (typeFilter && typeFilter.length > 0) {
			memories = memories.filter((m) => typeFilter.includes(m.type));
		}

		// Apply entity filter if specified
		if (entityFilter && entityFilter.length > 0) {
			memories = memories.filter((m) => {
				const allEntities = [
					...(m.entities.locations ?? []),
					...(m.entities.npcs ?? []),
					...(m.entities.items ?? []),
				];
				return entityFilter.some((entity) =>
					allEntities.some((e) =>
						e.toLowerCase().includes(entity.toLowerCase()),
					),
				);
			});
		}

		return memories;
	} catch (err) {
		console.error("[Memory Agent] Vector search failed:", {
			error: err instanceof Error ? err.message : String(err),
			sessionId,
		});
		return [];
	}
}

/**
 * Timeout promise helper
 */
class TimeoutError extends Error {
	constructor(ms: number) {
		super(`Operation timed out after ${ms}ms`);
		this.name = "TimeoutError";
	}
}

function timeoutPromise(ms: number): Promise<never> {
	return new Promise((_, reject) => {
		setTimeout(() => reject(new TimeoutError(ms)), ms);
	});
}
