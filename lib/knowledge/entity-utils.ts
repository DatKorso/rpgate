/**
 * Entity name normalization and resolution utilities
 */

/**
 * Normalize entity name to canonical form
 * - Trim whitespace
 * - Convert to title case
 * - Handle special characters
 */
export function normalizeEntityName(name: string): string {
	// Trim whitespace
	let normalized = name.trim();

	// Remove extra spaces
	normalized = normalized.replace(/\s+/g, " ");

	// Convert to title case (capitalize first letter of each word)
	normalized = normalized
		.split(" ")
		.map((word) => {
			if (word.length === 0) return word;
			// Keep short all-caps words (like NPC, GM, ID) as-is
			if (word === word.toUpperCase() && word.length <= 3) {
				return word;
			}
			// Capitalize first letter, lowercase rest
			return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
		})
		.join(" ");

	return normalized;
}

/**
 * Calculate similarity between two strings using Levenshtein distance
 * Returns a value between 0 (completely different) and 1 (identical)
 */
export function calculateSimilarity(str1: string, str2: string): number {
	const s1 = str1.toLowerCase();
	const s2 = str2.toLowerCase();

	if (s1 === s2) return 1.0;

	const len1 = s1.length;
	const len2 = s2.length;

	if (len1 === 0) return len2 === 0 ? 1.0 : 0.0;
	if (len2 === 0) return 0.0;

	// Levenshtein distance
	const matrix: number[][] = [];

	for (let i = 0; i <= len1; i++) {
		matrix[i] = [i];
	}

	for (let j = 0; j <= len2; j++) {
		matrix[0][j] = j;
	}

	for (let i = 1; i <= len1; i++) {
		for (let j = 1; j <= len2; j++) {
			const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
			matrix[i][j] = Math.min(
				matrix[i - 1][j] + 1, // deletion
				matrix[i][j - 1] + 1, // insertion
				matrix[i - 1][j - 1] + cost, // substitution
			);
		}
	}

	const distance = matrix[len1][len2];
	const maxLen = Math.max(len1, len2);

	return 1 - distance / maxLen;
}

/**
 * Check if two entity names are similar enough to be considered the same entity
 * Uses fuzzy matching with a threshold
 */
export function areEntitiesSimilar(
	name1: string,
	name2: string,
	threshold = 0.85,
): boolean {
	const normalized1 = normalizeEntityName(name1);
	const normalized2 = normalizeEntityName(name2);

	// Exact match after normalization
	if (normalized1 === normalized2) return true;

	// Check if one is a substring of the other (e.g., "Ivan" vs "Merchant Ivan")
	if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
		return true;
	}

	// Fuzzy match using similarity score
	const similarity = calculateSimilarity(normalized1, normalized2);
	return similarity >= threshold;
}

/**
 * Find the best matching entity from a list of existing entities
 * Returns the index of the best match, or -1 if no good match found
 */
export function findBestMatch(
	targetName: string,
	existingNames: string[],
	threshold = 0.85,
): number {
	const normalizedTarget = normalizeEntityName(targetName);
	let bestMatchIndex = -1;
	let bestSimilarity = 0;

	for (let i = 0; i < existingNames.length; i++) {
		const normalizedExisting = normalizeEntityName(existingNames[i]);

		// Exact match
		if (normalizedTarget === normalizedExisting) {
			return i;
		}

		// Substring match
		if (
			normalizedTarget.includes(normalizedExisting) ||
			normalizedExisting.includes(normalizedTarget)
		) {
			return i;
		}

		// Fuzzy match
		const similarity = calculateSimilarity(
			normalizedTarget,
			normalizedExisting,
		);
		if (similarity > bestSimilarity) {
			bestSimilarity = similarity;
			bestMatchIndex = i;
		}
	}

	// Return best match only if it meets threshold
	return bestSimilarity >= threshold ? bestMatchIndex : -1;
}

/**
 * Merge entity properties
 * New properties are added, existing properties are kept unless explicitly overwritten
 */
export function mergeEntityProperties(
	existing: Record<string, unknown>,
	updates: Record<string, unknown>,
): Record<string, unknown> {
	const merged = { ...existing };

	for (const [key, value] of Object.entries(updates)) {
		// Skip null/undefined values
		if (value === null || value === undefined) continue;

		// Add or update property
		merged[key] = value;
	}

	return merged;
}

/**
 * Add alias to entity properties
 */
export function addEntityAlias(
	properties: Record<string, unknown>,
	alias: string,
): Record<string, unknown> {
	const aliases = (properties.aliases as string[]) ?? [];

	// Normalize alias
	const normalizedAlias = normalizeEntityName(alias);

	// Add if not already present
	if (!aliases.includes(normalizedAlias)) {
		aliases.push(normalizedAlias);
	}

	return {
		...properties,
		aliases,
	};
}
