/**
 * Feature Flags for Knowledge Graph System
 *
 * Enables gradual rollout and per-session overrides for knowledge graph features.
 * Supports backward compatibility by allowing features to be disabled.
 */

export interface FeatureFlags {
	enableMemoryAgent: boolean;
	enableWorldKnowledge: boolean;
	enablePlayerKnowledge: boolean;
}

export interface FeatureFlagOverrides {
	sessionId: number;
	flags: Partial<FeatureFlags>;
}

/**
 * Global default feature flags
 * These can be overridden per-session
 */
const DEFAULT_FLAGS: FeatureFlags = {
	enableMemoryAgent: true,
	enableWorldKnowledge: true,
	enablePlayerKnowledge: true,
};

/**
 * Per-session flag overrides
 * Key: sessionId, Value: partial flag overrides
 */
const sessionOverrides = new Map<number, Partial<FeatureFlags>>();

/**
 * Get feature flags for a specific session
 * Merges global defaults with session-specific overrides
 */
export function getFeatureFlags(sessionId: number): FeatureFlags {
	const overrides = sessionOverrides.get(sessionId);

	if (!overrides) {
		return { ...DEFAULT_FLAGS };
	}

	return {
		...DEFAULT_FLAGS,
		...overrides,
	};
}

/**
 * Set feature flag overrides for a specific session
 */
export function setSessionFeatureFlags(
	sessionId: number,
	flags: Partial<FeatureFlags>,
): void {
	sessionOverrides.set(sessionId, flags);
}

/**
 * Clear feature flag overrides for a specific session
 * Session will revert to global defaults
 */
export function clearSessionFeatureFlags(sessionId: number): void {
	sessionOverrides.delete(sessionId);
}

/**
 * Get all session overrides
 * Useful for admin endpoints
 */
export function getAllSessionOverrides(): FeatureFlagOverrides[] {
	const overrides: FeatureFlagOverrides[] = [];

	for (const [sessionId, flags] of sessionOverrides.entries()) {
		overrides.push({ sessionId, flags });
	}

	return overrides;
}

/**
 * Update global default flags
 * Affects all sessions without specific overrides
 */
export function setGlobalFeatureFlags(flags: Partial<FeatureFlags>): void {
	Object.assign(DEFAULT_FLAGS, flags);
}

/**
 * Get current global default flags
 */
export function getGlobalFeatureFlags(): FeatureFlags {
	return { ...DEFAULT_FLAGS };
}

/**
 * Check if Memory Agent is enabled for a session
 */
export function isMemoryAgentEnabled(sessionId: number): boolean {
	return getFeatureFlags(sessionId).enableMemoryAgent;
}

/**
 * Check if World Knowledge is enabled for a session
 */
export function isWorldKnowledgeEnabled(sessionId: number): boolean {
	return getFeatureFlags(sessionId).enableWorldKnowledge;
}

/**
 * Check if Player Knowledge is enabled for a session
 */
export function isPlayerKnowledgeEnabled(sessionId: number): boolean {
	return getFeatureFlags(sessionId).enablePlayerKnowledge;
}
