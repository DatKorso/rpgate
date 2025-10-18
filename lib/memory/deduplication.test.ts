import type { MemoryEntryData } from "@/db/schema";
import { describe, expect, it } from "vitest";
import {
	combineWeightedMemories,
	deduplicateMemories,
	mergeMemoryResults,
} from "./deduplication";

describe("Memory Deduplication", () => {
	describe("deduplicateMemories", () => {
		it("should remove duplicate memories by ID", () => {
			const memories: MemoryEntryData[] = [
				{
					id: 1,
					summary: "Memory 1",
					fullText: "Full text 1",
					type: "location",
					entities: {},
					turnNumber: 1,
					similarity: 0.8,
				},
				{
					id: 2,
					summary: "Memory 2",
					fullText: "Full text 2",
					type: "npc",
					entities: {},
					turnNumber: 2,
					similarity: 0.9,
				},
				{
					id: 1,
					summary: "Memory 1 duplicate",
					fullText: "Full text 1 duplicate",
					type: "location",
					entities: {},
					turnNumber: 1,
					similarity: 0.7,
				},
			];

			const result = deduplicateMemories(memories);

			expect(result).toHaveLength(2);
			expect(result[0].id).toBe(2);
			expect(result[1].id).toBe(1);
		});

		it("should keep memory with highest similarity score", () => {
			const memories: MemoryEntryData[] = [
				{
					id: 1,
					summary: "Memory 1 low",
					fullText: "Full text 1",
					type: "location",
					entities: {},
					turnNumber: 1,
					similarity: 0.6,
				},
				{
					id: 1,
					summary: "Memory 1 high",
					fullText: "Full text 1",
					type: "location",
					entities: {},
					turnNumber: 1,
					similarity: 0.9,
				},
			];

			const result = deduplicateMemories(memories);

			expect(result).toHaveLength(1);
			expect(result[0].summary).toBe("Memory 1 high");
			expect(result[0].similarity).toBe(0.9);
		});

		it("should sort by similarity descending", () => {
			const memories: MemoryEntryData[] = [
				{
					id: 1,
					summary: "Memory 1",
					fullText: "Full text 1",
					type: "location",
					entities: {},
					turnNumber: 1,
					similarity: 0.5,
				},
				{
					id: 2,
					summary: "Memory 2",
					fullText: "Full text 2",
					type: "npc",
					entities: {},
					turnNumber: 2,
					similarity: 0.9,
				},
				{
					id: 3,
					summary: "Memory 3",
					fullText: "Full text 3",
					type: "event",
					entities: {},
					turnNumber: 3,
					similarity: 0.7,
				},
			];

			const result = deduplicateMemories(memories);

			expect(result).toHaveLength(3);
			expect(result[0].similarity).toBe(0.9);
			expect(result[1].similarity).toBe(0.7);
			expect(result[2].similarity).toBe(0.5);
		});

		it("should handle memories without similarity scores", () => {
			const memories: MemoryEntryData[] = [
				{
					id: 1,
					summary: "Memory 1",
					fullText: "Full text 1",
					type: "location",
					entities: {},
					turnNumber: 1,
				},
				{
					id: 2,
					summary: "Memory 2",
					fullText: "Full text 2",
					type: "npc",
					entities: {},
					turnNumber: 2,
					similarity: 0.8,
				},
			];

			const result = deduplicateMemories(memories);

			expect(result).toHaveLength(2);
			expect(result[0].id).toBe(2);
			expect(result[1].id).toBe(1);
		});

		it("should handle empty array", () => {
			const result = deduplicateMemories([]);
			expect(result).toHaveLength(0);
		});
	});

	describe("mergeMemoryResults", () => {
		it("should merge multiple result sets and deduplicate", () => {
			const resultSet1: MemoryEntryData[] = [
				{
					id: 1,
					summary: "Memory 1",
					fullText: "Full text 1",
					type: "location",
					entities: {},
					turnNumber: 1,
					similarity: 0.8,
				},
				{
					id: 2,
					summary: "Memory 2",
					fullText: "Full text 2",
					type: "npc",
					entities: {},
					turnNumber: 2,
					similarity: 0.7,
				},
			];

			const resultSet2: MemoryEntryData[] = [
				{
					id: 1,
					summary: "Memory 1 duplicate",
					fullText: "Full text 1",
					type: "location",
					entities: {},
					turnNumber: 1,
					similarity: 0.6,
				},
				{
					id: 3,
					summary: "Memory 3",
					fullText: "Full text 3",
					type: "event",
					entities: {},
					turnNumber: 3,
					similarity: 0.9,
				},
			];

			const result = mergeMemoryResults([resultSet1, resultSet2]);

			expect(result).toHaveLength(3);
			expect(result[0].id).toBe(3);
			expect(result[1].id).toBe(1);
			expect(result[2].id).toBe(2);
		});

		it("should limit total results", () => {
			const resultSet1: MemoryEntryData[] = Array.from(
				{ length: 8 },
				(_, i) => ({
					id: i + 1,
					summary: `Memory ${i + 1}`,
					fullText: `Full text ${i + 1}`,
					type: "location" as const,
					entities: {},
					turnNumber: i + 1,
					similarity: 0.9 - i * 0.1,
				}),
			);

			const resultSet2: MemoryEntryData[] = Array.from(
				{ length: 5 },
				(_, i) => ({
					id: i + 9,
					summary: `Memory ${i + 9}`,
					fullText: `Full text ${i + 9}`,
					type: "npc" as const,
					entities: {},
					turnNumber: i + 9,
					similarity: 0.5 - i * 0.05,
				}),
			);

			const result = mergeMemoryResults([resultSet1, resultSet2], 10);

			expect(result).toHaveLength(10);
			expect(result[0].similarity).toBeGreaterThanOrEqual(
				result[9].similarity ?? 0,
			);
		});

		it("should handle empty result sets", () => {
			const result = mergeMemoryResults([[], []]);
			expect(result).toHaveLength(0);
		});
	});

	describe("combineWeightedMemories", () => {
		it("should apply weights to similarity scores", () => {
			const highPriorityMemories: MemoryEntryData[] = [
				{
					id: 1,
					summary: "High priority",
					fullText: "Full text 1",
					type: "location",
					entities: {},
					turnNumber: 1,
					similarity: 0.6,
				},
			];

			const lowPriorityMemories: MemoryEntryData[] = [
				{
					id: 2,
					summary: "Low priority",
					fullText: "Full text 2",
					type: "npc",
					entities: {},
					turnNumber: 2,
					similarity: 0.8,
				},
			];

			const result = combineWeightedMemories([
				{ memories: highPriorityMemories, weight: 2.0 },
				{ memories: lowPriorityMemories, weight: 0.5 },
			]);

			expect(result).toHaveLength(2);
			// High priority (0.6 * 2.0 = 1.2) should rank higher than low priority (0.8 * 0.5 = 0.4)
			expect(result[0].id).toBe(1);
			expect(result[1].id).toBe(2);
		});

		it("should deduplicate across weighted sources", () => {
			const source1: MemoryEntryData[] = [
				{
					id: 1,
					summary: "Memory 1 from source 1",
					fullText: "Full text 1",
					type: "location",
					entities: {},
					turnNumber: 1,
					similarity: 0.7,
				},
			];

			const source2: MemoryEntryData[] = [
				{
					id: 1,
					summary: "Memory 1 from source 2",
					fullText: "Full text 1",
					type: "location",
					entities: {},
					turnNumber: 1,
					similarity: 0.6,
				},
			];

			const result = combineWeightedMemories([
				{ memories: source1, weight: 1.0 },
				{ memories: source2, weight: 2.0 },
			]);

			expect(result).toHaveLength(1);
			// Should keep the one with higher weighted similarity (0.6 * 2.0 = 1.2 > 0.7 * 1.0 = 0.7)
			expect(result[0].summary).toBe("Memory 1 from source 2");
		});

		it("should limit total results", () => {
			const memories: MemoryEntryData[] = Array.from(
				{ length: 20 },
				(_, i) => ({
					id: i + 1,
					summary: `Memory ${i + 1}`,
					fullText: `Full text ${i + 1}`,
					type: "location" as const,
					entities: {},
					turnNumber: i + 1,
					similarity: 0.9 - i * 0.01,
				}),
			);

			const result = combineWeightedMemories([{ memories, weight: 1.0 }], 5);

			expect(result).toHaveLength(5);
		});
	});
});
