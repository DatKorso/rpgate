/**
 * Tests for Memory System Logger
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	getMemoryMetrics,
	getRecentLogs,
	logHeuristicDecision,
	logRetrievalOperation,
	logStorageOperation,
	resetMetrics,
} from "./logger";

describe("Memory Logger", () => {
	beforeEach(() => {
		resetMetrics();
		vi.clearAllMocks();
	});

	describe("logHeuristicDecision", () => {
		it("should log heuristic decision and update metrics", () => {
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

			logHeuristicDecision(
				"Помнишь ту таверну?",
				true,
				["explicit_request"],
				[],
				1.0,
				123,
			);

			expect(consoleSpy).toHaveBeenCalledWith(
				"[Memory:Heuristic]",
				expect.objectContaining({
					shouldRetrieve: true,
					triggers: ["explicit_request"],
					confidence: "1.00",
				}),
			);

			const metrics = getMemoryMetrics();
			expect(metrics.totalHeuristicChecks).toBe(1);
			expect(metrics.totalRetrievalTriggered).toBe(1);
			expect(metrics.heuristicHitRate).toBe(1.0);

			consoleSpy.mockRestore();
		});

		it("should track multiple heuristic decisions", () => {
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

			// Trigger retrieval
			logHeuristicDecision("Помнишь?", true, ["explicit_request"], [], 1.0);

			// Don't trigger retrieval
			logHeuristicDecision("Иду налево", false, [], [], 0.0);

			// Trigger retrieval
			logHeuristicDecision(
				"Возвращаюсь в таверну",
				true,
				["location_return"],
				[],
				0.7,
			);

			const metrics = getMemoryMetrics();
			expect(metrics.totalHeuristicChecks).toBe(3);
			expect(metrics.totalRetrievalTriggered).toBe(2);
			expect(metrics.heuristicHitRate).toBeCloseTo(2 / 3);

			consoleSpy.mockRestore();
		});
	});

	describe("logRetrievalOperation", () => {
		it("should log successful retrieval", () => {
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

			logRetrievalOperation(
				123,
				"test query",
				3,
				150,
				[0.9, 0.8, 0.7],
				false,
				false,
			);

			expect(consoleSpy).toHaveBeenCalledWith(
				"[Memory:Retrieval] Success",
				expect.objectContaining({
					sessionId: 123,
					memoriesFound: 3,
					retrievalTimeMs: 150,
					topSimilarity: "0.900",
				}),
			);

			const metrics = getMemoryMetrics();
			expect(metrics.totalRetrievals).toBe(1);
			expect(metrics.averageRetrievalTimeMs).toBe(150);
			expect(metrics.averageSimilarityScore).toBeCloseTo(0.8);

			consoleSpy.mockRestore();
		});

		it("should log timeout", () => {
			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			logRetrievalOperation(123, "test query", 0, 2000, [], true, false);

			expect(consoleSpy).toHaveBeenCalledWith(
				"[Memory:Retrieval] Timeout",
				expect.any(Object),
			);

			const metrics = getMemoryMetrics();
			expect(metrics.totalRetrievalTimeouts).toBe(1);

			consoleSpy.mockRestore();
		});

		it("should log error", () => {
			const consoleSpy = vi
				.spyOn(console, "error")
				.mockImplementation(() => {});

			logRetrievalOperation(
				123,
				"test query",
				0,
				100,
				[],
				false,
				true,
				"API error",
			);

			expect(consoleSpy).toHaveBeenCalledWith(
				"[Memory:Retrieval] Error",
				expect.objectContaining({
					error: "API error",
				}),
			);

			const metrics = getMemoryMetrics();
			expect(metrics.totalRetrievalErrors).toBe(1);

			consoleSpy.mockRestore();
		});

		it("should calculate percentiles correctly", () => {
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

			// Log multiple retrievals with different times
			const times = [50, 100, 150, 200, 250, 300, 350, 400, 450, 500];
			for (const time of times) {
				logRetrievalOperation(123, "query", 1, time, [0.8], false, false);
			}

			const metrics = getMemoryMetrics();
			expect(metrics.p95RetrievalTimeMs).toBe(500); // 95th percentile
			expect(metrics.p99RetrievalTimeMs).toBe(500); // 99th percentile

			consoleSpy.mockRestore();
		});
	});

	describe("logStorageOperation", () => {
		it("should log successful storage", () => {
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

			logStorageOperation(
				123,
				5,
				"location",
				"Test summary",
				{ locations: ["Test City"] },
				100,
				200,
				true,
			);

			expect(consoleSpy).toHaveBeenCalledWith(
				"[Memory:Storage] Success",
				expect.objectContaining({
					sessionId: 123,
					turnNumber: 5,
					type: "location",
					embeddingTokens: 100,
				}),
			);

			const metrics = getMemoryMetrics();
			expect(metrics.totalStorageSuccesses).toBe(1);
			expect(metrics.totalEmbeddingTokens).toBe(100);
			expect(metrics.memoryTypeDistribution.location).toBe(1);

			consoleSpy.mockRestore();
		});

		it("should log failed storage", () => {
			const consoleSpy = vi
				.spyOn(console, "error")
				.mockImplementation(() => {});

			logStorageOperation(
				123,
				5,
				"event",
				"Test summary",
				{},
				0,
				100,
				false,
				"DB error",
			);

			expect(consoleSpy).toHaveBeenCalledWith(
				"[Memory:Storage] Failed",
				expect.objectContaining({
					error: "DB error",
				}),
			);

			const metrics = getMemoryMetrics();
			expect(metrics.totalStorageFailures).toBe(1);

			consoleSpy.mockRestore();
		});

		it("should track memory type distribution", () => {
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

			logStorageOperation(123, 1, "location", "s1", {}, 10, 100, true);
			logStorageOperation(123, 2, "npc", "s2", {}, 10, 100, true);
			logStorageOperation(123, 3, "location", "s3", {}, 10, 100, true);
			logStorageOperation(123, 4, "event", "s4", {}, 10, 100, true);
			logStorageOperation(123, 5, "location", "s5", {}, 10, 100, true);

			const metrics = getMemoryMetrics();
			expect(metrics.memoryTypeDistribution).toEqual({
				location: 3,
				npc: 1,
				event: 1,
			});

			consoleSpy.mockRestore();
		});
	});

	describe("getRecentLogs", () => {
		it("should return recent logs", () => {
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

			logHeuristicDecision("test1", true, [], [], 1.0);
			logHeuristicDecision("test2", false, [], [], 0.0);
			logRetrievalOperation(123, "query", 1, 100, [0.8], false, false);
			logStorageOperation(123, 1, "location", "summary", {}, 10, 100, true);

			const logs = getRecentLogs(10);

			expect(logs.heuristic).toHaveLength(2);
			expect(logs.retrieval).toHaveLength(1);
			expect(logs.storage).toHaveLength(1);

			consoleSpy.mockRestore();
		});

		it("should limit log count", () => {
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

			// Log more than limit
			for (let i = 0; i < 20; i++) {
				logHeuristicDecision(`test${i}`, true, [], [], 1.0);
			}

			const logs = getRecentLogs(5);
			expect(logs.heuristic).toHaveLength(5);

			consoleSpy.mockRestore();
		});
	});

	describe("resetMetrics", () => {
		it("should reset all metrics and logs", () => {
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

			logHeuristicDecision("test", true, [], [], 1.0);
			logRetrievalOperation(123, "query", 1, 100, [0.8], false, false);
			logStorageOperation(123, 1, "location", "summary", {}, 10, 100, true);

			resetMetrics();

			const metrics = getMemoryMetrics();
			expect(metrics.totalHeuristicChecks).toBe(0);
			expect(metrics.totalRetrievals).toBe(0);
			expect(metrics.totalStorageAttempts).toBe(0);

			const logs = getRecentLogs();
			expect(logs.heuristic).toHaveLength(0);
			expect(logs.retrieval).toHaveLength(0);
			expect(logs.storage).toHaveLength(0);

			consoleSpy.mockRestore();
		});
	});
});
