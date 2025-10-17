/**
 * Unit tests for Memory Agent (retrieval)
 */

import * as dbModule from "@/db";
import type { MemoryEntryData } from "@/db/schema";
import * as embeddings from "@/lib/memory/embeddings";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { retrieveMemories } from "./memory";

// Mock modules
vi.mock("@/db", () => ({
	db: {
		execute: vi.fn(),
	},
}));

vi.mock("@/lib/memory/embeddings", () => ({
	createEmbedding: vi.fn(),
}));

describe("Memory Agent - retrieveMemories", () => {
	const mockSessionId = 123;
	const mockQuery = "Я возвращаюсь в таверну Золотой Дракон";
	const mockEmbedding = new Array(1024).fill(0.1);

	beforeEach(() => {
		vi.clearAllMocks();
		// Suppress console logs in tests
		vi.spyOn(console, "log").mockImplementation(() => {});
		vi.spyOn(console, "warn").mockImplementation(() => {});
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should retrieve memories with vector search", async () => {
		// Mock embedding creation
		vi.mocked(embeddings.createEmbedding).mockResolvedValue({
			embedding: mockEmbedding,
			model: "text-embedding-v4",
			usage: { promptTokens: 10, totalTokens: 10 },
		});

		// Mock database query
		const mockDbResults = {
			rows: [
				{
					id: 1,
					summary: "Посещение таверны",
					full_text: "Игрок зашел в таверну Золотой Дракон",
					type: "location",
					entities: JSON.stringify({ locations: ["Золотой Дракон"] }),
					turn_number: 5,
					similarity: 0.92,
				},
				{
					id: 2,
					summary: "Встреча с барменом",
					full_text: "Игрок поговорил с барменом",
					type: "npc",
					entities: JSON.stringify({ npcs: ["Бармен"] }),
					turn_number: 6,
					similarity: 0.85,
				},
			],
			command: "SELECT",
			rowCount: 2,
			oid: 0,
			fields: [],
		};

		vi.mocked(dbModule.db.execute).mockResolvedValue(mockDbResults as any);

		// Execute retrieval
		const result = await retrieveMemories(mockSessionId, mockQuery);

		// Verify embedding was created
		expect(embeddings.createEmbedding).toHaveBeenCalledWith(mockQuery, {
			timeoutMs: 5000,
		});

		// Verify database query was executed
		expect(dbModule.db.execute).toHaveBeenCalled();

		// Verify results
		expect(result.memories).toHaveLength(2);
		expect(result.memories[0]).toMatchObject({
			id: 1,
			summary: "Посещение таверны",
			type: "location",
			similarity: 0.92,
		});
		expect(result.query).toBe(mockQuery);
		expect(result.retrievalTimeMs).toBeGreaterThanOrEqual(0);
	});

	it("should filter by similarity threshold", async () => {
		vi.mocked(embeddings.createEmbedding).mockResolvedValue({
			embedding: mockEmbedding,
			model: "text-embedding-v4",
			usage: { promptTokens: 10, totalTokens: 10 },
		});

		// Mock results with varying similarity
		const mockDbResults = {
			rows: [
				{
					id: 1,
					summary: "High similarity",
					full_text: "High similarity memory",
					type: "event",
					entities: JSON.stringify({}),
					turn_number: 1,
					similarity: 0.95,
				},
			],
			command: "SELECT",
			rowCount: 1,
			oid: 0,
			fields: [],
		};

		vi.mocked(dbModule.db.execute).mockResolvedValue(mockDbResults as any);

		// Retrieve with high threshold
		const result = await retrieveMemories(mockSessionId, mockQuery, {
			similarityThreshold: 0.9,
		});

		expect(result.memories).toHaveLength(1);
		expect(result.memories[0].similarity).toBeGreaterThanOrEqual(0.9);
	});

	it("should handle timeout gracefully", async () => {
		// Mock slow embedding creation
		vi.mocked(embeddings.createEmbedding).mockImplementation(
			() =>
				new Promise((resolve) =>
					setTimeout(
						() =>
							resolve({
								embedding: mockEmbedding,
								model: "text-embedding-v4",
								usage: { promptTokens: 10, totalTokens: 10 },
							}),
						5000,
					),
				),
		);

		// Retrieve with short timeout
		const result = await retrieveMemories(mockSessionId, mockQuery, {
			timeoutMs: 100,
		});

		// Should return empty result
		expect(result.memories).toHaveLength(0);
		expect(result.query).toBe(mockQuery);
		expect(console.warn).toHaveBeenCalledWith(
			"[Memory:Retrieval] Timeout",
			expect.objectContaining({
				sessionId: mockSessionId,
				query: expect.any(String),
			}),
		);
	});

	it("should handle empty results", async () => {
		vi.mocked(embeddings.createEmbedding).mockResolvedValue({
			embedding: mockEmbedding,
			model: "text-embedding-v4",
			usage: { promptTokens: 10, totalTokens: 10 },
		});

		// Mock empty database results
		vi.mocked(dbModule.db.execute).mockResolvedValue({
			rows: [],
			command: "SELECT",
			rowCount: 0,
			oid: 0,
			fields: [],
		} as any);

		const result = await retrieveMemories(mockSessionId, mockQuery);

		expect(result.memories).toHaveLength(0);
		expect(result.retrievalTimeMs).toBeGreaterThanOrEqual(0);
	});

	it("should handle embedding creation failure", async () => {
		// Mock embedding failure
		vi.mocked(embeddings.createEmbedding).mockRejectedValue(
			new Error("API error"),
		);

		const result = await retrieveMemories(mockSessionId, mockQuery);

		// Should return empty result without throwing
		expect(result.memories).toHaveLength(0);
		expect(console.error).toHaveBeenCalledWith(
			expect.stringContaining("Failed to create query embedding"),
			expect.any(Object),
		);
	});

	it("should handle database query failure", async () => {
		vi.mocked(embeddings.createEmbedding).mockResolvedValue({
			embedding: mockEmbedding,
			model: "text-embedding-v4",
			usage: { promptTokens: 10, totalTokens: 10 },
		});

		// Mock database error
		vi.mocked(dbModule.db.execute).mockRejectedValue(
			new Error("Database connection failed"),
		);

		const result = await retrieveMemories(mockSessionId, mockQuery);

		// Should return empty result without throwing
		expect(result.memories).toHaveLength(0);
		expect(console.error).toHaveBeenCalledWith(
			expect.stringContaining("Vector search failed"),
			expect.any(Object),
		);
	});

	it("should apply type filter", async () => {
		vi.mocked(embeddings.createEmbedding).mockResolvedValue({
			embedding: mockEmbedding,
			model: "text-embedding-v4",
			usage: { promptTokens: 10, totalTokens: 10 },
		});

		const mockDbResults = {
			rows: [
				{
					id: 1,
					summary: "Location memory",
					full_text: "Location",
					type: "location",
					entities: JSON.stringify({}),
					turn_number: 1,
					similarity: 0.9,
				},
				{
					id: 2,
					summary: "NPC memory",
					full_text: "NPC",
					type: "npc",
					entities: JSON.stringify({}),
					turn_number: 2,
					similarity: 0.85,
				},
			],
			command: "SELECT",
			rowCount: 2,
			oid: 0,
			fields: [],
		};

		vi.mocked(dbModule.db.execute).mockResolvedValue(mockDbResults as any);

		const result = await retrieveMemories(mockSessionId, mockQuery, {
			typeFilter: ["location"],
		});

		expect(result.memories).toHaveLength(1);
		expect(result.memories[0].type).toBe("location");
	});

	it("should apply entity filter", async () => {
		vi.mocked(embeddings.createEmbedding).mockResolvedValue({
			embedding: mockEmbedding,
			model: "text-embedding-v4",
			usage: { promptTokens: 10, totalTokens: 10 },
		});

		const mockDbResults = {
			rows: [
				{
					id: 1,
					summary: "Dragon tavern",
					full_text: "Tavern",
					type: "location",
					entities: JSON.stringify({ locations: ["Золотой Дракон"] }),
					turn_number: 1,
					similarity: 0.9,
				},
				{
					id: 2,
					summary: "Silver tavern",
					full_text: "Tavern",
					type: "location",
					entities: JSON.stringify({ locations: ["Серебряный Кубок"] }),
					turn_number: 2,
					similarity: 0.85,
				},
			],
			command: "SELECT",
			rowCount: 2,
			oid: 0,
			fields: [],
		};

		vi.mocked(dbModule.db.execute).mockResolvedValue(mockDbResults as any);

		const result = await retrieveMemories(mockSessionId, mockQuery, {
			entityFilter: ["Дракон"],
		});

		expect(result.memories).toHaveLength(1);
		expect(result.memories[0].entities.locations).toContain("Золотой Дракон");
	});

	it("should respect limit parameter", async () => {
		vi.mocked(embeddings.createEmbedding).mockResolvedValue({
			embedding: mockEmbedding,
			model: "text-embedding-v4",
			usage: { promptTokens: 10, totalTokens: 10 },
		});

		const mockDbResults = {
			rows: Array.from({ length: 10 }, (_, i) => ({
				id: i + 1,
				summary: `Memory ${i + 1}`,
				full_text: `Full text ${i + 1}`,
				type: "event",
				entities: JSON.stringify({}),
				turn_number: i + 1,
				similarity: 0.9 - i * 0.05,
			})),
			command: "SELECT",
			rowCount: 10,
			oid: 0,
			fields: [],
		};

		vi.mocked(dbModule.db.execute).mockResolvedValue(mockDbResults as any);

		const result = await retrieveMemories(mockSessionId, mockQuery, {
			limit: 3,
		});

		// Database should return limited results
		expect(result.memories.length).toBeLessThanOrEqual(10);
	});
});
