/**
 * Tests for Memory System Logger
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	getMemoryMetrics,
	getRecentLogs,
	logHeuristicDecision,
	logMemoryAgentDecision,
	logMemoryAgentMetrics,
	logRetrievalOperation,
	logStorageOperation,
	logWorldKnowledgeMetrics,
	logWorldKnowledgeUpdate,
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

	describe("logMemoryAgentDecision", () => {
		it("should log successful Memory Agent decision", () => {
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

			logMemoryAgentDecision(
				"Помнишь ту таверну?",
				{
					shouldRetrieve: true,
					reason: "Player asking about past location",
					queries: ["таверна", "что было в таверне"],
					entities: [{ name: "Таверна", type: "location" }],
					confidence: 0.9,
				},
				250,
				false,
				123,
			);

			expect(consoleSpy).toHaveBeenCalledWith(
				"[Memory:Agent] Decision",
				expect.objectContaining({
					shouldRetrieve: true,
					queriesCount: 2,
					entitiesCount: 1,
					confidence: "0.90",
					executionTimeMs: 250,
				}),
			);

			const metrics = getMemoryMetrics();
			expect(metrics.totalMemoryAgentChecks).toBe(1);
			expect(metrics.totalMemoryAgentRetrievalTriggered).toBe(1);
			expect(metrics.memoryAgentHitRate).toBe(1.0);
			expect(metrics.averageMemoryAgentTimeMs).toBe(250);
			expect(metrics.averageMemoryAgentConfidence).toBe(0.9);

			consoleSpy.mockRestore();
		});

		it("should log Memory Agent error", () => {
			const consoleSpy = vi
				.spyOn(console, "error")
				.mockImplementation(() => {});

			logMemoryAgentDecision(
				"test input",
				{
					shouldRetrieve: false,
					reason: "Error: API timeout",
					queries: [],
					entities: [],
					confidence: 0.0,
				},
				3000,
				true,
				123,
			);

			expect(consoleSpy).toHaveBeenCalledWith(
				"[Memory:Agent] Error",
				expect.objectContaining({
					executionTimeMs: 3000,
					reason: "Error: API timeout",
				}),
			);

			const metrics = getMemoryMetrics();
			expect(metrics.totalMemoryAgentErrors).toBe(1);

			consoleSpy.mockRestore();
		});

		it("should track timeout rate", () => {
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

			// Successful call
			logMemoryAgentDecision(
				"test1",
				{
					shouldRetrieve: true,
					reason: "test",
					queries: ["q1"],
					entities: [],
					confidence: 0.8,
				},
				500,
				false,
			);

			// Timeout (execution time >= 3000ms)
			logMemoryAgentDecision(
				"test2",
				{
					shouldRetrieve: false,
					reason: "Timeout",
					queries: [],
					entities: [],
					confidence: 0.0,
				},
				3000,
				true,
			);

			// Another timeout
			logMemoryAgentDecision(
				"test3",
				{
					shouldRetrieve: false,
					reason: "Timeout",
					queries: [],
					entities: [],
					confidence: 0.0,
				},
				3500,
				true,
			);

			const metrics = getMemoryMetrics();
			expect(metrics.totalMemoryAgentChecks).toBe(3);
			expect(metrics.totalMemoryAgentTimeouts).toBe(2);
			expect(metrics.totalMemoryAgentErrors).toBe(2);

			consoleSpy.mockRestore();
		});

		it("should calculate average confidence excluding errors", () => {
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

			// Successful decisions
			logMemoryAgentDecision(
				"test1",
				{
					shouldRetrieve: true,
					reason: "test",
					queries: ["q1"],
					entities: [],
					confidence: 0.9,
				},
				200,
				false,
			);

			logMemoryAgentDecision(
				"test2",
				{
					shouldRetrieve: true,
					reason: "test",
					queries: ["q2"],
					entities: [],
					confidence: 0.7,
				},
				300,
				false,
			);

			// Error (should not affect confidence average)
			logMemoryAgentDecision(
				"test3",
				{
					shouldRetrieve: false,
					reason: "Error",
					queries: [],
					entities: [],
					confidence: 0.0,
				},
				3000,
				true,
			);

			const metrics = getMemoryMetrics();
			expect(metrics.averageMemoryAgentConfidence).toBeCloseTo(0.8); // (0.9 + 0.7) / 2

			consoleSpy.mockRestore();
		});

		it("should track Memory Agent logs separately from heuristic", () => {
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

			// Memory Agent decision
			logMemoryAgentDecision(
				"test1",
				{
					shouldRetrieve: true,
					reason: "test",
					queries: ["q1"],
					entities: [],
					confidence: 0.9,
				},
				200,
				false,
			);

			// Heuristic decision
			logHeuristicDecision("test2", true, ["trigger"], [], 0.8);

			const logs = getRecentLogs(10);
			expect(logs.memoryAgent).toHaveLength(1);
			expect(logs.heuristic).toHaveLength(1);

			const metrics = getMemoryMetrics();
			expect(metrics.totalMemoryAgentChecks).toBe(1);
			expect(metrics.totalHeuristicChecks).toBe(1);

			consoleSpy.mockRestore();
		});
	});

	describe("logMemoryAgentMetrics", () => {
		it("should log metrics summary", () => {
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

			// Add some test data
			logMemoryAgentDecision(
				"test1",
				{
					shouldRetrieve: true,
					reason: "test",
					queries: ["q1"],
					entities: [],
					confidence: 0.9,
				},
				200,
				false,
			);

			logMemoryAgentDecision(
				"test2",
				{
					shouldRetrieve: false,
					reason: "test",
					queries: [],
					entities: [],
					confidence: 0.3,
				},
				150,
				false,
			);

			logMemoryAgentDecision(
				"test3",
				{
					shouldRetrieve: false,
					reason: "Timeout",
					queries: [],
					entities: [],
					confidence: 0.0,
				},
				3000,
				true,
			);

			logMemoryAgentMetrics();

			expect(consoleSpy).toHaveBeenCalledWith(
				"[Memory Agent] Metrics Summary:",
				expect.objectContaining({
					totalChecks: 3,
					hitRate: "33.3%",
					timeouts: 1,
					timeoutRate: "33.3%",
					errors: 1,
					errorRate: "33.3%",
				}),
			);

			consoleSpy.mockRestore();
		});
	});

	describe("logWorldKnowledgeUpdate", () => {
		it("should log successful world knowledge update", () => {
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

			logWorldKnowledgeUpdate(
				123,
				5,
				250,
				3,
				2,
				2,
				1,
				2,
				{ location: 1, npc: 2 },
				true,
				0,
			);

			expect(consoleSpy).toHaveBeenCalledWith(
				"[World Knowledge] Update Success",
				expect.objectContaining({
					sessionId: 123,
					turnNumber: 5,
					extractionTimeMs: 250,
					entitiesExtracted: 3,
					relationshipsExtracted: 2,
					entitiesCreated: 2,
					entitiesUpdated: 1,
					relationshipsCreated: 2,
					entityTypes: { location: 1, npc: 2 },
				}),
			);

			const metrics = getMemoryMetrics();
			expect(metrics.totalWorldKnowledgeUpdates).toBe(1);
			expect(metrics.totalWorldKnowledgeSuccesses).toBe(1);
			expect(metrics.totalEntitiesCreated).toBe(2);
			expect(metrics.totalEntitiesUpdated).toBe(1);
			expect(metrics.totalRelationshipsCreated).toBe(2);
			expect(metrics.averageEntitiesPerTurn).toBe(3);
			expect(metrics.averageRelationshipsPerTurn).toBe(2);
			expect(metrics.worldKnowledgeSuccessRate).toBe(1.0);

			consoleSpy.mockRestore();
		});

		it("should log failed world knowledge update", () => {
			const consoleSpy = vi
				.spyOn(console, "error")
				.mockImplementation(() => {});

			logWorldKnowledgeUpdate(123, 5, 100, 0, 0, 0, 0, 0, {}, false, 2, [
				"Error 1",
				"Error 2",
			]);

			expect(consoleSpy).toHaveBeenCalledWith(
				"[World Knowledge] Update Failed",
				expect.objectContaining({
					sessionId: 123,
					turnNumber: 5,
					errors: 2,
					errorMessages: ["Error 1", "Error 2"],
				}),
			);

			const metrics = getMemoryMetrics();
			expect(metrics.totalWorldKnowledgeFailures).toBe(1);

			consoleSpy.mockRestore();
		});

		it("should track entity type distribution", () => {
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

			logWorldKnowledgeUpdate(
				123,
				1,
				200,
				2,
				0,
				2,
				0,
				0,
				{ location: 2 },
				true,
				0,
			);
			logWorldKnowledgeUpdate(
				123,
				2,
				250,
				3,
				1,
				3,
				0,
				1,
				{ npc: 2, item: 1 },
				true,
				0,
			);
			logWorldKnowledgeUpdate(
				123,
				3,
				180,
				1,
				0,
				1,
				0,
				0,
				{ location: 1 },
				true,
				0,
			);

			const metrics = getMemoryMetrics();
			expect(metrics.worldEntityTypeDistribution).toEqual({
				location: 3,
				npc: 2,
				item: 1,
			});

			consoleSpy.mockRestore();
		});

		it("should calculate average extraction time", () => {
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

			logWorldKnowledgeUpdate(123, 1, 200, 2, 1, 2, 0, 1, {}, true, 0);
			logWorldKnowledgeUpdate(123, 2, 300, 1, 0, 1, 0, 0, {}, true, 0);
			logWorldKnowledgeUpdate(123, 3, 250, 3, 2, 3, 0, 2, {}, true, 0);

			const metrics = getMemoryMetrics();
			expect(metrics.averageWorldKnowledgeExtractionTimeMs).toBeCloseTo(250);

			consoleSpy.mockRestore();
		});

		it("should track success rate", () => {
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

			// 3 successful updates
			logWorldKnowledgeUpdate(123, 1, 200, 2, 1, 2, 0, 1, {}, true, 0);
			logWorldKnowledgeUpdate(123, 2, 250, 1, 0, 1, 0, 0, {}, true, 0);
			logWorldKnowledgeUpdate(123, 3, 180, 3, 2, 3, 0, 2, {}, true, 0);

			// 1 failed update
			const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
			logWorldKnowledgeUpdate(123, 4, 100, 0, 0, 0, 0, 0, {}, false, 1, [
				"Error",
			]);

			const metrics = getMemoryMetrics();
			expect(metrics.totalWorldKnowledgeUpdates).toBe(4);
			expect(metrics.totalWorldKnowledgeSuccesses).toBe(3);
			expect(metrics.totalWorldKnowledgeFailures).toBe(1);
			expect(metrics.worldKnowledgeSuccessRate).toBe(0.75);

			consoleSpy.mockRestore();
			errorSpy.mockRestore();
		});

		it("should include world knowledge logs in recent logs", () => {
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

			logWorldKnowledgeUpdate(123, 1, 200, 2, 1, 2, 0, 1, {}, true, 0);
			logWorldKnowledgeUpdate(123, 2, 250, 1, 0, 1, 0, 0, {}, true, 0);

			const logs = getRecentLogs(10);
			expect(logs.worldKnowledge).toHaveLength(2);
			expect(logs.worldKnowledge[0]).toMatchObject({
				sessionId: 123,
				turnNumber: 1,
				extractionTimeMs: 200,
				entitiesExtracted: 2,
				relationshipsExtracted: 1,
			});

			consoleSpy.mockRestore();
		});
	});

	describe("logWorldKnowledgeMetrics", () => {
		it("should log world knowledge metrics summary", () => {
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

			// Add some test data
			logWorldKnowledgeUpdate(
				123,
				1,
				200,
				2,
				1,
				2,
				0,
				1,
				{ location: 1, npc: 1 },
				true,
				0,
			);
			logWorldKnowledgeUpdate(
				123,
				2,
				300,
				3,
				2,
				2,
				1,
				2,
				{ npc: 2, item: 1 },
				true,
				0,
			);

			const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
			logWorldKnowledgeUpdate(123, 3, 100, 0, 0, 0, 0, 0, {}, false, 1, [
				"Error",
			]);

			logWorldKnowledgeMetrics();

			expect(consoleSpy).toHaveBeenCalledWith(
				"[World Knowledge] Metrics Summary:",
				expect.objectContaining({
					totalUpdates: 3,
					successRate: "66.7%",
					totalEntitiesCreated: 4,
					totalEntitiesUpdated: 1,
					totalRelationshipsCreated: 3,
					avgEntitiesPerTurn: "1.7",
					avgRelationshipsPerTurn: "1.0",
					entityTypeDistribution: { location: 1, npc: 3, item: 1 },
					failures: 1,
				}),
			);

			consoleSpy.mockRestore();
			errorSpy.mockRestore();
		});
	});

	describe("resetMetrics", () => {
		it("should reset all metrics and logs", () => {
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

			logHeuristicDecision("test", true, [], [], 1.0);
			logMemoryAgentDecision(
				"test",
				{
					shouldRetrieve: true,
					reason: "test",
					queries: ["q1"],
					entities: [],
					confidence: 0.9,
				},
				200,
				false,
			);
			logRetrievalOperation(123, "query", 1, 100, [0.8], false, false);
			logStorageOperation(123, 1, "location", "summary", {}, 10, 100, true);
			logWorldKnowledgeUpdate(123, 1, 200, 2, 1, 2, 0, 1, {}, true, 0);

			resetMetrics();

			const metrics = getMemoryMetrics();
			expect(metrics.totalHeuristicChecks).toBe(0);
			expect(metrics.totalMemoryAgentChecks).toBe(0);
			expect(metrics.totalRetrievals).toBe(0);
			expect(metrics.totalStorageAttempts).toBe(0);
			expect(metrics.totalWorldKnowledgeUpdates).toBe(0);

			const logs = getRecentLogs();
			expect(logs.heuristic).toHaveLength(0);
			expect(logs.memoryAgent).toHaveLength(0);
			expect(logs.retrieval).toHaveLength(0);
			expect(logs.storage).toHaveLength(0);
			expect(logs.worldKnowledge).toHaveLength(0);

			consoleSpy.mockRestore();
		});
	});
});
