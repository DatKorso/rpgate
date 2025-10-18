/**
 * Memory deduplication utilities
 *
 * Provides functions to deduplicate memory entries by ID,
 * merge similarity scores, and sort by relevance.
 */

import type { MemoryEntryData } from "@/db/schema";

/**
 * Deduplicate memories by ID, keeping the entry with highest similarity score
 *
 * @param memories - Array of memory entries (may contain duplicates)
 * @returns Deduplicated array sorted by similarity (highest first)
 */
export function deduplicateMemories(
	memories: MemoryEntryData[],
): MemoryEntryData[] {
	// Use Map to deduplicate by ID
	const memoryMap = new Map<number, MemoryEntryData>();

	for (const memory of memories) {
		const existing = memoryMap.get(memory.id);

		// Keep the memory with highest similarity score
		if (!existing || (memory.similarity ?? 0) > (existing.similarity ?? 0)) {
			memoryMap.set(memory.id, memory);
		}
	}

	// Convert to array and sort by similarity (highest first)
	return Array.from(memoryMap.values()).sort(
		(a, b) => (b.similarity ?? 0) - (a.similarity ?? 0),
	);
}

/**
 * Merge multiple memory result sets, deduplicate, and limit total results
 *
 * @param resultSets - Array of memory result sets from different queries
 * @param maxResults - Maximum number of results to return (default: 10)
 * @returns Deduplicated and limited array sorted by similarity
 */
export function mergeMemoryResults(
	resultSets: MemoryEntryData[][],
	maxResults = 10,
): MemoryEntryData[] {
	// Flatten all results into single array
	const allMemories = resultSets.flat();

	// Deduplicate and sort
	const uniqueMemories = deduplicateMemories(allMemories);

	// Limit total results
	return uniqueMemories.slice(0, maxResults);
}

/**
 * Combine memories from multiple sources with different weights
 *
 * @param sources - Array of { memories, weight } objects
 * @param maxResults - Maximum number of results to return (default: 10)
 * @returns Deduplicated and weighted array sorted by adjusted similarity
 */
export function combineWeightedMemories(
	sources: Array<{ memories: MemoryEntryData[]; weight: number }>,
	maxResults = 10,
): MemoryEntryData[] {
	// Apply weights to similarity scores
	const weightedMemories: MemoryEntryData[] = [];

	for (const { memories, weight } of sources) {
		for (const memory of memories) {
			weightedMemories.push({
				...memory,
				similarity: (memory.similarity ?? 0) * weight,
			});
		}
	}

	// Deduplicate (will keep highest weighted similarity)
	const uniqueMemories = deduplicateMemories(weightedMemories);

	// Limit total results
	return uniqueMemories.slice(0, maxResults);
}
