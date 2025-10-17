/**
 * Unit tests for Memory Storage
 *
 * Tests rule-based extraction, type detection, entity extraction,
 * and storage operations with mocked dependencies.
 */

import * as dbModule from "@/db";
import {
	type MemoryExtractionResult,
	extractMemoryFromTurn,
	storeMemory,
} from "@/lib/agents/memory-storage";
import * as embeddings from "@/lib/memory/embeddings";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("@/lib/memory/embeddings");
vi.mock("@/db");

describe("extractMemoryFromTurn", () => {
	describe("Rule-based extraction logic", () => {
		it("should detect important location arrival", () => {
			const playerMsg = "Я иду в таверну Золотой Дракон";
			const gmMsg =
				"Ты входишь в таверну. Внутри шумно, пахнет элем и жареным мясом.";

			const result = extractMemoryFromTurn(playerMsg, gmMsg, 5);

			expect(result.shouldStore).toBe(true);
			expect(result.type).toBe("location");
			expect(result.summary).toBeDefined();
		});

		it("should detect NPC encounter", () => {
			const playerMsg = "Я подхожу к бармену";
			const gmMsg =
				"Бармен Григорий встречает тебя с улыбкой. Это крепкий мужчина с седой бородой.";

			const result = extractMemoryFromTurn(playerMsg, gmMsg, 10);

			expect(result.shouldStore).toBe(true);
			expect(result.type).toBe("npc");
		});

		it("should detect item acquisition", () => {
			const playerMsg = "Я беру меч со стола";
			const gmMsg =
				"Ты находишь древний меч с рунами. Это артефакт большой силы.";

			const result = extractMemoryFromTurn(playerMsg, gmMsg, 15);

			expect(result.shouldStore).toBe(true);
			expect(result.type).toBe("item");
		});

		it("should detect quest/decision events", () => {
			const playerMsg = "Я соглашаюсь помочь";
			const gmMsg = "Ты получаешь квест: найти пропавшего торговца в лесу.";

			const result = extractMemoryFromTurn(playerMsg, gmMsg, 20);

			expect(result.shouldStore).toBe(true);
			expect(result.type).toBe("decision");
		});

		it("should detect combat victory", () => {
			const playerMsg = "Я атакую орка";
			const gmMsg = "Твой удар точен. Орк побежден и падает на землю.";

			const result = extractMemoryFromTurn(playerMsg, gmMsg, 25);

			expect(result.shouldStore).toBe(true);
			expect(result.type).toBe("event");
		});

		it("should skip mundane actions", () => {
			const playerMsg = "Я иду налево";
			const gmMsg = "Ты идешь по коридору. Ничего особенного.";

			const result = extractMemoryFromTurn(playerMsg, gmMsg, 30);

			expect(result.shouldStore).toBe(false);
		});

		it("should skip empty messages", () => {
			const result = extractMemoryFromTurn("", "", 35);

			expect(result.shouldStore).toBe(false);
		});
	});

	describe("Memory type detection", () => {
		it("should detect location type", () => {
			const gmMsg = "Ты прибываешь в город Нортхейм";
			const result = extractMemoryFromTurn("Иду в город", gmMsg, 1);

			expect(result.type).toBe("location");
		});

		it("should detect NPC type", () => {
			const gmMsg = "Ты встречаешь странника по имени Элрик";
			const result = extractMemoryFromTurn("Кто это?", gmMsg, 1);

			expect(result.type).toBe("npc");
		});

		it("should detect item type", () => {
			const gmMsg = "Ты находишь магический амулет";
			const result = extractMemoryFromTurn("Что в сундуке?", gmMsg, 1);

			expect(result.type).toBe("item");
		});

		it("should detect decision type", () => {
			const gmMsg = "Ты получаешь задание от старосты";
			const result = extractMemoryFromTurn("Я соглашаюсь", gmMsg, 1);

			expect(result.type).toBe("decision");
		});

		it("should detect event type for combat", () => {
			const gmMsg = "Ты побеждаешь дракона в эпической битве";
			const result = extractMemoryFromTurn("Атакую!", gmMsg, 1);

			expect(result.type).toBe("event");
		});
	});

	describe("Entity extraction", () => {
		it("should extract location names", () => {
			const gmMsg = "Ты входишь в таверну Золотой Дракон в городе Нортхейм";
			const result = extractMemoryFromTurn("Иду в таверну", gmMsg, 1);

			expect(result.entities?.locations).toContain("Золотой Дракон");
			expect(result.entities?.locations).toContain("Нортхейм");
		});

		it("should extract NPC names", () => {
			const gmMsg = "Бармен Григорий и торговец Маркус приветствуют тебя";
			const result = extractMemoryFromTurn("Привет", gmMsg, 1);

			expect(result.entities?.npcs).toContain("Григорий");
			expect(result.entities?.npcs).toContain("Маркус");
		});

		it("should extract item names", () => {
			const gmMsg = "Ты находишь Меч Света и Щит Защитника";
			const result = extractMemoryFromTurn("Что здесь?", gmMsg, 1);

			expect(result.entities?.items).toContain("Меч Света");
			expect(result.entities?.items).toContain("Щит Защитника");
		});

		it("should handle messages with no entities", () => {
			const gmMsg = "Ты идешь по дороге";
			const result = extractMemoryFromTurn("Иду вперед", gmMsg, 1);

			if (result.shouldStore) {
				expect(result.entities?.locations || []).toHaveLength(0);
				expect(result.entities?.npcs || []).toHaveLength(0);
				expect(result.entities?.items || []).toHaveLength(0);
			}
		});

		it("should extract entities from both player and GM messages", () => {
			const playerMsg = "Я спрашиваю Элрика о городе Каэр";
			const gmMsg =
				"Элрик рассказывает тебе о древнем городе Каэр. Это место полно магии.";
			const result = extractMemoryFromTurn(playerMsg, gmMsg, 1);

			// This test should store because "древний" triggers importance
			expect(result.shouldStore).toBe(true);
			expect(result.entities?.npcs).toBeDefined();
			expect(result.entities?.npcs).toContain("Элрик");
			expect(result.entities?.locations).toBeDefined();
			expect(result.entities?.locations).toContain("Каэр");
		});
	});
});

describe("storeMemory", () => {
	const mockReturning = vi.fn();
	const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
	const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(dbModule.db).insert = mockInsert;
	});

	it("should store memory with embedding", async () => {
		const mockEmbedding = new Array(1024).fill(0.1);
		vi.mocked(embeddings.createEmbedding).mockResolvedValue({
			embedding: mockEmbedding,
			model: "text-embedding-v4",
			usage: { promptTokens: 10, totalTokens: 10 },
		});

		mockReturning.mockResolvedValue([{ id: 123 }]);

		const extraction: MemoryExtractionResult = {
			shouldStore: true,
			type: "location",
			summary: "Прибытие в таверну",
			fullText: "Игрок прибыл в таверну Золотой Дракон",
			entities: {
				locations: ["Золотой Дракон"],
			},
		};

		await storeMemory(1, 10, 5, extraction);

		expect(embeddings.createEmbedding).toHaveBeenCalledWith(
			expect.stringContaining("Прибытие в таверну"),
			expect.any(Object),
		);
		expect(mockInsert).toHaveBeenCalled();
		expect(mockValues).toHaveBeenCalledWith(
			expect.objectContaining({
				sessionId: 1,
				turnId: 10,
				turnNumber: 5,
				type: "location",
				summary: "Прибытие в таверну",
				embedding: mockEmbedding,
			}),
		);
	});

	it("should handle embedding creation failure gracefully", async () => {
		vi.mocked(embeddings.createEmbedding).mockRejectedValue(
			new Error("API error"),
		);

		const extraction: MemoryExtractionResult = {
			shouldStore: true,
			type: "event",
			summary: "Test event",
			fullText: "Test full text",
			entities: {},
		};

		// Should not throw
		await expect(storeMemory(1, 10, 5, extraction)).resolves.toBeUndefined();

		// Should not attempt DB insert
		expect(mockInsert).not.toHaveBeenCalled();
	});

	it("should retry DB insert once on failure", async () => {
		const mockEmbedding = new Array(1024).fill(0.1);
		vi.mocked(embeddings.createEmbedding).mockResolvedValue({
			embedding: mockEmbedding,
			model: "text-embedding-v4",
			usage: { promptTokens: 10, totalTokens: 10 },
		});

		// First call fails, second succeeds
		mockReturning
			.mockRejectedValueOnce(new Error("DB error"))
			.mockResolvedValueOnce([{ id: 123 }]);

		const extraction: MemoryExtractionResult = {
			shouldStore: true,
			type: "npc",
			summary: "Met NPC",
			fullText: "Met an NPC",
			entities: { npcs: ["Test"] },
		};

		await storeMemory(1, 10, 5, extraction);

		// Should have been called twice (initial + retry)
		expect(mockInsert).toHaveBeenCalledTimes(2);
	});

	it("should handle DB insert failure after retry", async () => {
		const mockEmbedding = new Array(1024).fill(0.1);
		vi.mocked(embeddings.createEmbedding).mockResolvedValue({
			embedding: mockEmbedding,
			model: "text-embedding-v4",
			usage: { promptTokens: 10, totalTokens: 10 },
		});

		// Both attempts fail
		mockReturning.mockRejectedValue(new Error("DB error"));

		const extraction: MemoryExtractionResult = {
			shouldStore: true,
			type: "item",
			summary: "Found item",
			fullText: "Found an item",
			entities: { items: ["Sword"] },
		};

		// Should not throw
		await expect(storeMemory(1, 10, 5, extraction)).resolves.toBeUndefined();

		// Should have tried twice
		expect(mockInsert).toHaveBeenCalledTimes(2);
	});
});
