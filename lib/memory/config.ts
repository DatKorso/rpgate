/**
 * Memory System Configuration
 *
 * Centralized configuration constants for the Personal Memory System.
 * All timeouts, thresholds, and limits are defined here.
 */

/**
 * Embedding Service Configuration
 */
export const EMBEDDING_CONFIG = {
	/** AITunnel API model for embeddings */
	MODEL: "text-embedding-v4" as const,

	/** Vector dimensions for text-embedding-v4 */
	DIMENSIONS: 1024,

	/** Default timeout for embedding API requests (ms) */
	TIMEOUT_MS: 10000,

	/** Maximum retry attempts for failed API requests */
	MAX_RETRIES: 3,

	/** Maximum text length for embedding (chars) */
	MAX_TEXT_LENGTH: 8000,

	/** AITunnel API base URL */
	BASE_URL: "https://api.aitunnel.ru/v1/" as const,
} as const;

/**
 * Memory Retrieval Configuration
 */
export const RETRIEVAL_CONFIG = {
	/** Default number of memories to retrieve */
	DEFAULT_LIMIT: 5,

	/** Minimum cosine similarity threshold (0-1) */
	DEFAULT_SIMILARITY_THRESHOLD: 0.7,

	/** Default timeout for retrieval operations (ms) */
	DEFAULT_TIMEOUT_MS: 4000,

	/** Timeout for query embedding creation during retrieval (ms) */
	QUERY_EMBEDDING_TIMEOUT_MS: 5000,
} as const;

/**
 * Memory Storage Configuration
 */
export const STORAGE_CONFIG = {
	/** Maximum retry attempts for storage operations */
	MAX_RETRIES: 1,

	/** Timeout for embedding creation during storage (ms) */
	EMBEDDING_TIMEOUT_MS: 10000,
} as const;

/**
 * Heuristic Gate Configuration
 */
export const HEURISTIC_CONFIG = {
	/** Minimum confidence threshold to trigger retrieval (0-1) */
	CONFIDENCE_THRESHOLD: 0.6,

	/** Number of recent messages to check for entity context */
	RECENT_CONTEXT_SIZE: 5,
} as const;

/**
 * Memory Agent Configuration
 */
export const MEMORY_AGENT_CONFIG = {
	/** Default timeout for Memory Agent LLM calls (ms) */
	DEFAULT_TIMEOUT_MS: 6000,

	/** Default LLM model for Memory Agent */
	DEFAULT_MODEL: "x-ai/grok-4-fast" as const,

	/** Minimum confidence threshold to trigger retrieval (0-1) */
	CONFIDENCE_THRESHOLD: 0.6,
} as const;

/**
 * pgvector Index Configuration
 */
export const VECTOR_INDEX_CONFIG = {
	/** HNSW index parameter: max connections per layer */
	HNSW_M: 16,

	/** HNSW index parameter: construction time accuracy */
	HNSW_EF_CONSTRUCTION: 64,
} as const;
