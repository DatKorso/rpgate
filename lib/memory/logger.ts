/**
 * Memory System Logging and Monitoring
 *
 * Provides structured logging and metrics collection for the memory system.
 * Tracks heuristic decisions, retrieval operations, and storage operations.
 */

export interface HeuristicLogEntry {
	timestamp: number;
	playerInput: string;
	shouldRetrieve: boolean;
	triggers: string[];
	entities: string[];
	confidence: number;
	sessionId?: number;
}

export interface RetrievalLogEntry {
	timestamp: number;
	sessionId: number;
	query: string;
	memoriesFound: number;
	retrievalTimeMs: number;
	topSimilarity: number | null;
	similarityScores: number[];
	timeoutOccurred: boolean;
	errorOccurred: boolean;
	errorMessage?: string;
}

export interface StorageLogEntry {
	timestamp: number;
	sessionId: number;
	turnNumber: number;
	type: string;
	summary: string;
	entities: {
		locations?: string[];
		npcs?: string[];
		items?: string[];
	};
	embeddingTokens: number;
	storageTimeMs: number;
	success: boolean;
	errorMessage?: string;
}

export interface MemoryMetrics {
	// Heuristic metrics
	heuristicHitRate: number; // % of times retrieval was triggered
	totalHeuristicChecks: number;
	totalRetrievalTriggered: number;

	// Retrieval metrics
	averageRetrievalTimeMs: number;
	p95RetrievalTimeMs: number;
	p99RetrievalTimeMs: number;
	averageSimilarityScore: number;
	totalRetrievals: number;
	totalRetrievalTimeouts: number;
	totalRetrievalErrors: number;

	// Storage metrics
	averageStorageTimeMs: number;
	totalStorageAttempts: number;
	totalStorageSuccesses: number;
	totalStorageFailures: number;
	totalEmbeddingTokens: number;

	// Memory type distribution
	memoryTypeDistribution: Record<string, number>;
}

/**
 * In-memory metrics store
 * In production, this should be replaced with a proper metrics backend
 * (e.g., Prometheus, DataDog, CloudWatch)
 */
class MemoryMetricsStore {
	private heuristicLogs: HeuristicLogEntry[] = [];
	private retrievalLogs: RetrievalLogEntry[] = [];
	private storageLogs: StorageLogEntry[] = [];

	// Limits to prevent memory leaks
	private readonly MAX_LOGS = 1000;

	logHeuristic(entry: HeuristicLogEntry): void {
		this.heuristicLogs.push(entry);
		if (this.heuristicLogs.length > this.MAX_LOGS) {
			this.heuristicLogs.shift();
		}
	}

	logRetrieval(entry: RetrievalLogEntry): void {
		this.retrievalLogs.push(entry);
		if (this.retrievalLogs.length > this.MAX_LOGS) {
			this.retrievalLogs.shift();
		}
	}

	logStorage(entry: StorageLogEntry): void {
		this.storageLogs.push(entry);
		if (this.storageLogs.length > this.MAX_LOGS) {
			this.storageLogs.shift();
		}
	}

	getMetrics(): MemoryMetrics {
		const totalHeuristicChecks = this.heuristicLogs.length;
		const totalRetrievalTriggered = this.heuristicLogs.filter(
			(log) => log.shouldRetrieve,
		).length;

		const retrievalTimes = this.retrievalLogs.map((log) => log.retrievalTimeMs);
		const similarityScores = this.retrievalLogs.flatMap(
			(log) => log.similarityScores,
		);
		const storageTimes = this.storageLogs.map((log) => log.storageTimeMs);

		// Calculate percentiles
		const p95RetrievalTimeMs = this.calculatePercentile(retrievalTimes, 0.95);
		const p99RetrievalTimeMs = this.calculatePercentile(retrievalTimes, 0.99);

		// Memory type distribution
		const memoryTypeDistribution: Record<string, number> = {};
		for (const log of this.storageLogs) {
			if (log.success) {
				memoryTypeDistribution[log.type] =
					(memoryTypeDistribution[log.type] || 0) + 1;
			}
		}

		return {
			heuristicHitRate:
				totalHeuristicChecks > 0
					? totalRetrievalTriggered / totalHeuristicChecks
					: 0,
			totalHeuristicChecks,
			totalRetrievalTriggered,

			averageRetrievalTimeMs: this.average(retrievalTimes),
			p95RetrievalTimeMs,
			p99RetrievalTimeMs,
			averageSimilarityScore: this.average(similarityScores),
			totalRetrievals: this.retrievalLogs.length,
			totalRetrievalTimeouts: this.retrievalLogs.filter(
				(log) => log.timeoutOccurred,
			).length,
			totalRetrievalErrors: this.retrievalLogs.filter(
				(log) => log.errorOccurred,
			).length,

			averageStorageTimeMs: this.average(storageTimes),
			totalStorageAttempts: this.storageLogs.length,
			totalStorageSuccesses: this.storageLogs.filter((log) => log.success)
				.length,
			totalStorageFailures: this.storageLogs.filter((log) => !log.success)
				.length,
			totalEmbeddingTokens: this.storageLogs.reduce(
				(sum, log) => sum + log.embeddingTokens,
				0,
			),

			memoryTypeDistribution,
		};
	}

	getRecentHeuristicLogs(limit = 10): HeuristicLogEntry[] {
		return this.heuristicLogs.slice(-limit);
	}

	getRecentRetrievalLogs(limit = 10): RetrievalLogEntry[] {
		return this.retrievalLogs.slice(-limit);
	}

	getRecentStorageLogs(limit = 10): StorageLogEntry[] {
		return this.storageLogs.slice(-limit);
	}

	private average(numbers: number[]): number {
		if (numbers.length === 0) return 0;
		return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
	}

	private calculatePercentile(numbers: number[], percentile: number): number {
		if (numbers.length === 0) return 0;
		const sorted = [...numbers].sort((a, b) => a - b);
		const index = Math.ceil(sorted.length * percentile) - 1;
		return sorted[Math.max(0, index)];
	}

	reset(): void {
		this.heuristicLogs = [];
		this.retrievalLogs = [];
		this.storageLogs = [];
	}
}

// Singleton instance
const metricsStore = new MemoryMetricsStore();

/**
 * Log a heuristic decision
 */
export function logHeuristicDecision(
	playerInput: string,
	shouldRetrieve: boolean,
	triggers: string[],
	entities: string[],
	confidence: number,
	sessionId?: number,
): void {
	const entry: HeuristicLogEntry = {
		timestamp: Date.now(),
		playerInput: playerInput.slice(0, 100), // Truncate for privacy/size
		shouldRetrieve,
		triggers,
		entities,
		confidence,
		sessionId,
	};

	metricsStore.logHeuristic(entry);

	// Structured console log
	console.log("[Memory:Heuristic]", {
		shouldRetrieve,
		triggers,
		entities,
		confidence: confidence.toFixed(2),
		input: playerInput.slice(0, 50),
	});
}

/**
 * Log a retrieval operation
 */
export function logRetrievalOperation(
	sessionId: number,
	query: string,
	memoriesFound: number,
	retrievalTimeMs: number,
	similarityScores: number[],
	timeoutOccurred = false,
	errorOccurred = false,
	errorMessage?: string,
): void {
	const topSimilarity =
		similarityScores.length > 0 ? Math.max(...similarityScores) : null;

	const entry: RetrievalLogEntry = {
		timestamp: Date.now(),
		sessionId,
		query: query.slice(0, 100),
		memoriesFound,
		retrievalTimeMs,
		topSimilarity,
		similarityScores,
		timeoutOccurred,
		errorOccurred,
		errorMessage,
	};

	metricsStore.logRetrieval(entry);

	// Structured console log
	if (errorOccurred) {
		console.error("[Memory:Retrieval] Error", {
			sessionId,
			query: query.slice(0, 50),
			retrievalTimeMs,
			error: errorMessage,
		});
	} else if (timeoutOccurred) {
		console.warn("[Memory:Retrieval] Timeout", {
			sessionId,
			query: query.slice(0, 50),
			retrievalTimeMs,
		});
	} else {
		console.log("[Memory:Retrieval] Success", {
			sessionId,
			memoriesFound,
			retrievalTimeMs,
			topSimilarity: topSimilarity?.toFixed(3) ?? "N/A",
			query: query.slice(0, 50),
		});
	}
}

/**
 * Log a storage operation
 */
export function logStorageOperation(
	sessionId: number,
	turnNumber: number,
	type: string,
	summary: string,
	entities: {
		locations?: string[];
		npcs?: string[];
		items?: string[];
	},
	embeddingTokens: number,
	storageTimeMs: number,
	success: boolean,
	errorMessage?: string,
): void {
	const entry: StorageLogEntry = {
		timestamp: Date.now(),
		sessionId,
		turnNumber,
		type,
		summary: summary.slice(0, 100),
		entities,
		embeddingTokens,
		storageTimeMs,
		success,
		errorMessage,
	};

	metricsStore.logStorage(entry);

	// Structured console log
	if (success) {
		console.log("[Memory:Storage] Success", {
			sessionId,
			turnNumber,
			type,
			entities,
			embeddingTokens,
			storageTimeMs,
		});
	} else {
		console.error("[Memory:Storage] Failed", {
			sessionId,
			turnNumber,
			type,
			storageTimeMs,
			error: errorMessage,
		});
	}
}

/**
 * Get current metrics
 */
export function getMemoryMetrics(): MemoryMetrics {
	return metricsStore.getMetrics();
}

/**
 * Get recent logs for debugging
 */
export function getRecentLogs(limit = 10): {
	heuristic: HeuristicLogEntry[];
	retrieval: RetrievalLogEntry[];
	storage: StorageLogEntry[];
} {
	return {
		heuristic: metricsStore.getRecentHeuristicLogs(limit),
		retrieval: metricsStore.getRecentRetrievalLogs(limit),
		storage: metricsStore.getRecentStorageLogs(limit),
	};
}

/**
 * Reset all metrics (useful for testing)
 */
export function resetMetrics(): void {
	metricsStore.reset();
}
