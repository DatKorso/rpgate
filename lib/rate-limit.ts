/**
 * Simple in-memory rate limiter
 * For production, consider Redis-based solution
 */

type RateLimitStore = Map<string, { count: number; resetAt: number }>;

const stores = new Map<string, RateLimitStore>();

export interface RateLimitConfig {
	/** Unique identifier for this rate limiter */
	id: string;
	/** Maximum requests allowed in the window */
	limit: number;
	/** Time window in milliseconds */
	window: number;
}

export interface RateLimitResult {
	success: boolean;
	limit: number;
	remaining: number;
	reset: number;
}

/**
 * Check if a request is within rate limits
 * @param key - Unique identifier for the client (e.g., IP, session ID)
 * @param config - Rate limit configuration
 * @returns Rate limit result with remaining quota
 */
export function checkRateLimit(
	key: string,
	config: RateLimitConfig,
): RateLimitResult {
	const now = Date.now();
	let store = stores.get(config.id);
	if (!store) {
		store = new Map();
		stores.set(config.id, store);
	}

	const record = store.get(key);
	if (!record || now > record.resetAt) {
		// New window
		const resetAt = now + config.window;
		store.set(key, { count: 1, resetAt });
		return {
			success: true,
			limit: config.limit,
			remaining: config.limit - 1,
			reset: resetAt,
		};
	}

	// Within existing window
	if (record.count >= config.limit) {
		return {
			success: false,
			limit: config.limit,
			remaining: 0,
			reset: record.resetAt,
		};
	}

	record.count++;
	return {
		success: true,
		limit: config.limit,
		remaining: config.limit - record.count,
		reset: record.resetAt,
	};
}

/**
 * Clean up expired entries (call periodically)
 */
export function cleanupRateLimits() {
	const now = Date.now();
	for (const [_id, store] of stores) {
		for (const [key, record] of store) {
			if (now > record.resetAt) {
				store.delete(key);
			}
		}
	}
}

// Auto-cleanup every 5 minutes
if (typeof setInterval !== "undefined") {
	setInterval(cleanupRateLimits, 5 * 60 * 1000);
}
