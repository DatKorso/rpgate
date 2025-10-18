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

export interface MemoryAgentLogEntry {
	timestamp: number;
	playerInput: string;
	shouldRetrieve: boolean;
	reason: string;
	queriesCount: number;
	entitiesCount: number;
	confidence: number;
	executionTimeMs: number;
	error: boolean;
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

export interface WorldKnowledgeLogEntry {
	timestamp: number;
	sessionId: number;
	turnNumber: number;
	extractionTimeMs: number;
	entitiesExtracted: number;
	relationshipsExtracted: number;
	entitiesCreated: number;
	entitiesUpdated: number;
	relationshipsCreated: number;
	entityTypes: Record<string, number>;
	success: boolean;
	errors: number;
	errorMessages?: string[];
}

export interface PlayerKnowledgeLogEntry {
	timestamp: number;
	sessionId: number;
	turnNumber: number;
	extractionTimeMs: number;
	updatesExtracted: number;
	knowledgeCreated: number;
	knowledgeUpdated: number;
	factsAdded: number;
	awarenessLevels: Record<string, number>;
	knowledgeSources: Record<string, number>;
	success: boolean;
	errors: number;
	errorMessages?: string[];
}

export interface MemoryMetrics {
	// Heuristic metrics
	heuristicHitRate: number; // % of times retrieval was triggered
	totalHeuristicChecks: number;
	totalRetrievalTriggered: number;

	// Memory Agent metrics
	memoryAgentHitRate: number; // % of times retrieval was triggered
	totalMemoryAgentChecks: number;
	totalMemoryAgentRetrievalTriggered: number;
	averageMemoryAgentTimeMs: number;
	totalMemoryAgentTimeouts: number;
	totalMemoryAgentErrors: number;
	averageMemoryAgentConfidence: number;

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

	// World Knowledge metrics
	totalWorldKnowledgeUpdates: number;
	totalWorldKnowledgeSuccesses: number;
	totalWorldKnowledgeFailures: number;
	averageWorldKnowledgeExtractionTimeMs: number;
	totalEntitiesCreated: number;
	totalEntitiesUpdated: number;
	totalRelationshipsCreated: number;
	averageEntitiesPerTurn: number;
	averageRelationshipsPerTurn: number;
	worldEntityTypeDistribution: Record<string, number>;
	worldKnowledgeSuccessRate: number;

	// Player Knowledge metrics
	totalPlayerKnowledgeUpdates: number;
	totalPlayerKnowledgeSuccesses: number;
	totalPlayerKnowledgeFailures: number;
	averagePlayerKnowledgeExtractionTimeMs: number;
	totalPlayerKnowledgeCreated: number;
	totalPlayerKnowledgeUpdated: number;
	totalFactsAdded: number;
	averageFactsPerTurn: number;
	playerAwarenessLevelDistribution: Record<string, number>;
	playerKnowledgeSourceDistribution: Record<string, number>;
	playerKnowledgeSuccessRate: number;
}

/**
 * In-memory metrics store
 * In production, this should be replaced with a proper metrics backend
 * (e.g., Prometheus, DataDog, CloudWatch)
 */
class MemoryMetricsStore {
	private heuristicLogs: HeuristicLogEntry[] = [];
	private memoryAgentLogs: MemoryAgentLogEntry[] = [];
	private retrievalLogs: RetrievalLogEntry[] = [];
	private storageLogs: StorageLogEntry[] = [];
	private worldKnowledgeLogs: WorldKnowledgeLogEntry[] = [];
	private playerKnowledgeLogs: PlayerKnowledgeLogEntry[] = [];

	// Limits to prevent memory leaks
	private readonly MAX_LOGS = 1000;

	logHeuristic(entry: HeuristicLogEntry): void {
		this.heuristicLogs.push(entry);
		if (this.heuristicLogs.length > this.MAX_LOGS) {
			this.heuristicLogs.shift();
		}
	}

	logMemoryAgent(entry: MemoryAgentLogEntry): void {
		this.memoryAgentLogs.push(entry);
		if (this.memoryAgentLogs.length > this.MAX_LOGS) {
			this.memoryAgentLogs.shift();
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

	logWorldKnowledge(entry: WorldKnowledgeLogEntry): void {
		this.worldKnowledgeLogs.push(entry);
		if (this.worldKnowledgeLogs.length > this.MAX_LOGS) {
			this.worldKnowledgeLogs.shift();
		}
	}

	logPlayerKnowledge(entry: PlayerKnowledgeLogEntry): void {
		this.playerKnowledgeLogs.push(entry);
		if (this.playerKnowledgeLogs.length > this.MAX_LOGS) {
			this.playerKnowledgeLogs.shift();
		}
	}

	getMetrics(): MemoryMetrics {
		const totalHeuristicChecks = this.heuristicLogs.length;
		const totalRetrievalTriggered = this.heuristicLogs.filter(
			(log) => log.shouldRetrieve,
		).length;

		const totalMemoryAgentChecks = this.memoryAgentLogs.length;
		const totalMemoryAgentRetrievalTriggered = this.memoryAgentLogs.filter(
			(log) => log.shouldRetrieve,
		).length;
		const memoryAgentTimes = this.memoryAgentLogs.map(
			(log) => log.executionTimeMs,
		);
		const memoryAgentConfidences = this.memoryAgentLogs
			.filter((log) => !log.error)
			.map((log) => log.confidence);

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

		// World Knowledge metrics
		const worldKnowledgeExtractionTimes = this.worldKnowledgeLogs.map(
			(log) => log.extractionTimeMs,
		);
		const totalWorldKnowledgeSuccesses = this.worldKnowledgeLogs.filter(
			(log) => log.success,
		).length;
		const totalWorldKnowledgeFailures = this.worldKnowledgeLogs.filter(
			(log) => !log.success,
		).length;
		const totalEntitiesCreated = this.worldKnowledgeLogs.reduce(
			(sum, log) => sum + log.entitiesCreated,
			0,
		);
		const totalEntitiesUpdated = this.worldKnowledgeLogs.reduce(
			(sum, log) => sum + log.entitiesUpdated,
			0,
		);
		const totalRelationshipsCreated = this.worldKnowledgeLogs.reduce(
			(sum, log) => sum + log.relationshipsCreated,
			0,
		);
		const totalEntitiesExtracted = this.worldKnowledgeLogs.reduce(
			(sum, log) => sum + log.entitiesExtracted,
			0,
		);
		const totalRelationshipsExtracted = this.worldKnowledgeLogs.reduce(
			(sum, log) => sum + log.relationshipsExtracted,
			0,
		);

		// World entity type distribution
		const worldEntityTypeDistribution: Record<string, number> = {};
		for (const log of this.worldKnowledgeLogs) {
			if (log.success) {
				for (const [type, count] of Object.entries(log.entityTypes)) {
					worldEntityTypeDistribution[type] =
						(worldEntityTypeDistribution[type] || 0) + count;
				}
			}
		}

		// Player Knowledge metrics
		const playerKnowledgeExtractionTimes = this.playerKnowledgeLogs.map(
			(log) => log.extractionTimeMs,
		);
		const totalPlayerKnowledgeSuccesses = this.playerKnowledgeLogs.filter(
			(log) => log.success,
		).length;
		const totalPlayerKnowledgeFailures = this.playerKnowledgeLogs.filter(
			(log) => !log.success,
		).length;
		const totalPlayerKnowledgeCreated = this.playerKnowledgeLogs.reduce(
			(sum, log) => sum + log.knowledgeCreated,
			0,
		);
		const totalPlayerKnowledgeUpdated = this.playerKnowledgeLogs.reduce(
			(sum, log) => sum + log.knowledgeUpdated,
			0,
		);
		const totalFactsAdded = this.playerKnowledgeLogs.reduce(
			(sum, log) => sum + log.factsAdded,
			0,
		);
		const totalUpdatesExtracted = this.playerKnowledgeLogs.reduce(
			(sum, log) => sum + log.updatesExtracted,
			0,
		);

		// Player awareness level distribution
		const playerAwarenessLevelDistribution: Record<string, number> = {};
		for (const log of this.playerKnowledgeLogs) {
			if (log.success) {
				for (const [level, count] of Object.entries(log.awarenessLevels)) {
					playerAwarenessLevelDistribution[level] =
						(playerAwarenessLevelDistribution[level] || 0) + count;
				}
			}
		}

		// Player knowledge source distribution
		const playerKnowledgeSourceDistribution: Record<string, number> = {};
		for (const log of this.playerKnowledgeLogs) {
			if (log.success) {
				for (const [source, count] of Object.entries(log.knowledgeSources)) {
					playerKnowledgeSourceDistribution[source] =
						(playerKnowledgeSourceDistribution[source] || 0) + count;
				}
			}
		}

		return {
			heuristicHitRate:
				totalHeuristicChecks > 0
					? totalRetrievalTriggered / totalHeuristicChecks
					: 0,
			totalHeuristicChecks,
			totalRetrievalTriggered,

			memoryAgentHitRate:
				totalMemoryAgentChecks > 0
					? totalMemoryAgentRetrievalTriggered / totalMemoryAgentChecks
					: 0,
			totalMemoryAgentChecks,
			totalMemoryAgentRetrievalTriggered,
			averageMemoryAgentTimeMs: this.average(memoryAgentTimes),
			totalMemoryAgentTimeouts: this.memoryAgentLogs.filter(
				(log) => log.executionTimeMs >= 3000,
			).length,
			totalMemoryAgentErrors: this.memoryAgentLogs.filter((log) => log.error)
				.length,
			averageMemoryAgentConfidence: this.average(memoryAgentConfidences),

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

			totalWorldKnowledgeUpdates: this.worldKnowledgeLogs.length,
			totalWorldKnowledgeSuccesses,
			totalWorldKnowledgeFailures,
			averageWorldKnowledgeExtractionTimeMs: this.average(
				worldKnowledgeExtractionTimes,
			),
			totalEntitiesCreated,
			totalEntitiesUpdated,
			totalRelationshipsCreated,
			averageEntitiesPerTurn:
				this.worldKnowledgeLogs.length > 0
					? totalEntitiesExtracted / this.worldKnowledgeLogs.length
					: 0,
			averageRelationshipsPerTurn:
				this.worldKnowledgeLogs.length > 0
					? totalRelationshipsExtracted / this.worldKnowledgeLogs.length
					: 0,
			worldEntityTypeDistribution,
			worldKnowledgeSuccessRate:
				this.worldKnowledgeLogs.length > 0
					? totalWorldKnowledgeSuccesses / this.worldKnowledgeLogs.length
					: 0,

			totalPlayerKnowledgeUpdates: this.playerKnowledgeLogs.length,
			totalPlayerKnowledgeSuccesses,
			totalPlayerKnowledgeFailures,
			averagePlayerKnowledgeExtractionTimeMs: this.average(
				playerKnowledgeExtractionTimes,
			),
			totalPlayerKnowledgeCreated,
			totalPlayerKnowledgeUpdated,
			totalFactsAdded,
			averageFactsPerTurn:
				this.playerKnowledgeLogs.length > 0
					? totalUpdatesExtracted / this.playerKnowledgeLogs.length
					: 0,
			playerAwarenessLevelDistribution,
			playerKnowledgeSourceDistribution,
			playerKnowledgeSuccessRate:
				this.playerKnowledgeLogs.length > 0
					? totalPlayerKnowledgeSuccesses / this.playerKnowledgeLogs.length
					: 0,
		};
	}

	getRecentHeuristicLogs(limit = 10): HeuristicLogEntry[] {
		return this.heuristicLogs.slice(-limit);
	}

	getRecentMemoryAgentLogs(limit = 10): MemoryAgentLogEntry[] {
		return this.memoryAgentLogs.slice(-limit);
	}

	getRecentRetrievalLogs(limit = 10): RetrievalLogEntry[] {
		return this.retrievalLogs.slice(-limit);
	}

	getRecentStorageLogs(limit = 10): StorageLogEntry[] {
		return this.storageLogs.slice(-limit);
	}

	getRecentWorldKnowledgeLogs(limit = 10): WorldKnowledgeLogEntry[] {
		return this.worldKnowledgeLogs.slice(-limit);
	}

	getRecentPlayerKnowledgeLogs(limit = 10): PlayerKnowledgeLogEntry[] {
		return this.playerKnowledgeLogs.slice(-limit);
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
		this.memoryAgentLogs = [];
		this.retrievalLogs = [];
		this.storageLogs = [];
		this.worldKnowledgeLogs = [];
		this.playerKnowledgeLogs = [];
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
 * Log a Memory Agent decision
 */
export function logMemoryAgentDecision(
	playerInput: string,
	decision: {
		shouldRetrieve: boolean;
		reason: string;
		queries: string[];
		entities: unknown[];
		confidence: number;
	},
	executionTimeMs: number,
	error = false,
	sessionId?: number,
): void {
	const entry: MemoryAgentLogEntry = {
		timestamp: Date.now(),
		playerInput: playerInput.slice(0, 100),
		shouldRetrieve: decision.shouldRetrieve,
		reason: decision.reason,
		queriesCount: decision.queries.length,
		entitiesCount: decision.entities.length,
		confidence: decision.confidence,
		executionTimeMs,
		error,
		sessionId,
	};

	metricsStore.logMemoryAgent(entry);

	// Structured console log
	if (error) {
		console.error("[Memory:Agent] Error", {
			executionTimeMs,
			reason: decision.reason,
			input: playerInput.slice(0, 50),
		});
	} else {
		console.log("[Memory:Agent] Decision", {
			shouldRetrieve: decision.shouldRetrieve,
			queriesCount: decision.queries.length,
			entitiesCount: decision.entities.length,
			confidence: decision.confidence.toFixed(2),
			executionTimeMs,
			input: playerInput.slice(0, 50),
		});
	}
}

/**
 * Log a World Knowledge update operation
 */
export function logWorldKnowledgeUpdate(
	sessionId: number,
	turnNumber: number,
	extractionTimeMs: number,
	entitiesExtracted: number,
	relationshipsExtracted: number,
	entitiesCreated: number,
	entitiesUpdated: number,
	relationshipsCreated: number,
	entityTypes: Record<string, number>,
	success: boolean,
	errors: number,
	errorMessages?: string[],
): void {
	const entry: WorldKnowledgeLogEntry = {
		timestamp: Date.now(),
		sessionId,
		turnNumber,
		extractionTimeMs,
		entitiesExtracted,
		relationshipsExtracted,
		entitiesCreated,
		entitiesUpdated,
		relationshipsCreated,
		entityTypes,
		success,
		errors,
		errorMessages,
	};

	metricsStore.logWorldKnowledge(entry);

	// Structured console log
	if (success) {
		console.log("[World Knowledge] Update Success", {
			sessionId,
			turnNumber,
			extractionTimeMs,
			entitiesExtracted,
			relationshipsExtracted,
			entitiesCreated,
			entitiesUpdated,
			relationshipsCreated,
			entityTypes,
		});
	} else {
		console.error("[World Knowledge] Update Failed", {
			sessionId,
			turnNumber,
			extractionTimeMs,
			errors,
			errorMessages: errorMessages?.slice(0, 3), // Limit error messages in console
		});
	}
}

/**
 * Get recent logs for debugging
 */
export function getRecentLogs(limit = 10): {
	heuristic: HeuristicLogEntry[];
	memoryAgent: MemoryAgentLogEntry[];
	retrieval: RetrievalLogEntry[];
	storage: StorageLogEntry[];
	worldKnowledge: WorldKnowledgeLogEntry[];
	playerKnowledge: PlayerKnowledgeLogEntry[];
} {
	return {
		heuristic: metricsStore.getRecentHeuristicLogs(limit),
		memoryAgent: metricsStore.getRecentMemoryAgentLogs(limit),
		retrieval: metricsStore.getRecentRetrievalLogs(limit),
		storage: metricsStore.getRecentStorageLogs(limit),
		worldKnowledge: metricsStore.getRecentWorldKnowledgeLogs(limit),
		playerKnowledge: metricsStore.getRecentPlayerKnowledgeLogs(limit),
	};
}

/**
 * Reset all metrics (useful for testing)
 */
export function resetMetrics(): void {
	metricsStore.reset();
}

/**
 * Log Memory Agent metrics summary
 * Useful for periodic monitoring and debugging
 */
export function logMemoryAgentMetrics(): void {
	const metrics = metricsStore.getMetrics();

	console.log("[Memory Agent] Metrics Summary:", {
		totalChecks: metrics.totalMemoryAgentChecks,
		hitRate: `${(metrics.memoryAgentHitRate * 100).toFixed(1)}%`,
		avgConfidence: metrics.averageMemoryAgentConfidence.toFixed(2),
		avgTimeMs: Math.round(metrics.averageMemoryAgentTimeMs),
		timeouts: metrics.totalMemoryAgentTimeouts,
		timeoutRate:
			metrics.totalMemoryAgentChecks > 0
				? `${((metrics.totalMemoryAgentTimeouts / metrics.totalMemoryAgentChecks) * 100).toFixed(1)}%`
				: "0%",
		errors: metrics.totalMemoryAgentErrors,
		errorRate:
			metrics.totalMemoryAgentChecks > 0
				? `${((metrics.totalMemoryAgentErrors / metrics.totalMemoryAgentChecks) * 100).toFixed(1)}%`
				: "0%",
	});
}

/**
 * Log World Knowledge metrics summary
 * Useful for periodic monitoring and debugging
 */
export function logWorldKnowledgeMetrics(): void {
	const metrics = metricsStore.getMetrics();

	console.log("[World Knowledge] Metrics Summary:", {
		totalUpdates: metrics.totalWorldKnowledgeUpdates,
		successRate: `${(metrics.worldKnowledgeSuccessRate * 100).toFixed(1)}%`,
		avgExtractionTimeMs: Math.round(
			metrics.averageWorldKnowledgeExtractionTimeMs,
		),
		totalEntitiesCreated: metrics.totalEntitiesCreated,
		totalEntitiesUpdated: metrics.totalEntitiesUpdated,
		totalRelationshipsCreated: metrics.totalRelationshipsCreated,
		avgEntitiesPerTurn: metrics.averageEntitiesPerTurn.toFixed(1),
		avgRelationshipsPerTurn: metrics.averageRelationshipsPerTurn.toFixed(1),
		entityTypeDistribution: metrics.worldEntityTypeDistribution,
		failures: metrics.totalWorldKnowledgeFailures,
	});
}

/**
 * Log a Player Knowledge update operation
 */
export function logPlayerKnowledgeUpdate(
	sessionId: number,
	turnNumber: number,
	extractionTimeMs: number,
	updatesExtracted: number,
	knowledgeCreated: number,
	knowledgeUpdated: number,
	factsAdded: number,
	awarenessLevels: Record<string, number>,
	knowledgeSources: Record<string, number>,
	success: boolean,
	errors: number,
	errorMessages?: string[],
): void {
	const entry: PlayerKnowledgeLogEntry = {
		timestamp: Date.now(),
		sessionId,
		turnNumber,
		extractionTimeMs,
		updatesExtracted,
		knowledgeCreated,
		knowledgeUpdated,
		factsAdded,
		awarenessLevels,
		knowledgeSources,
		success,
		errors,
		errorMessages,
	};

	metricsStore.logPlayerKnowledge(entry);

	// Structured console log
	if (success) {
		console.log("[Player Knowledge] Update Success", {
			sessionId,
			turnNumber,
			extractionTimeMs,
			updatesExtracted,
			knowledgeCreated,
			knowledgeUpdated,
			factsAdded,
			awarenessLevels,
			knowledgeSources,
		});
	} else {
		console.error("[Player Knowledge] Update Failed", {
			sessionId,
			turnNumber,
			extractionTimeMs,
			errors,
			errorMessages: errorMessages?.slice(0, 3), // Limit error messages in console
		});
	}
}

/**
 * Log Player Knowledge metrics summary
 * Useful for periodic monitoring and debugging
 */
export function logPlayerKnowledgeMetrics(): void {
	const metrics = metricsStore.getMetrics();

	console.log("[Player Knowledge] Metrics Summary:", {
		totalUpdates: metrics.totalPlayerKnowledgeUpdates,
		successRate: `${(metrics.playerKnowledgeSuccessRate * 100).toFixed(1)}%`,
		avgExtractionTimeMs: Math.round(
			metrics.averagePlayerKnowledgeExtractionTimeMs,
		),
		totalKnowledgeCreated: metrics.totalPlayerKnowledgeCreated,
		totalKnowledgeUpdated: metrics.totalPlayerKnowledgeUpdated,
		totalFactsAdded: metrics.totalFactsAdded,
		avgFactsPerTurn: metrics.averageFactsPerTurn.toFixed(1),
		awarenessLevelDistribution: metrics.playerAwarenessLevelDistribution,
		sourceDistribution: metrics.playerKnowledgeSourceDistribution,
		failures: metrics.totalPlayerKnowledgeFailures,
	});
}
