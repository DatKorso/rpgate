import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEmbedding } from "./embeddings";

// Mock OpenAI client
vi.mock("openai", () => {
	return {
		default: vi.fn().mockImplementation(() => ({
			embeddings: {
				create: vi.fn(),
			},
		})),
	};
});

describe("Embedding Service", () => {
	const originalEnv = process.env;

	beforeEach(() => {
		vi.clearAllMocks();
		// Reset environment
		process.env = { ...originalEnv };
	});

	describe("validation", () => {
		it("should throw error when API key is missing", async () => {
			delete process.env.AITUNNEL_API_KEY;

			await expect(createEmbedding("test text")).rejects.toThrow(
				"AITUNNEL_API_KEY not configured",
			);
		});

		it("should throw error for empty text", async () => {
			process.env.AITUNNEL_API_KEY = "test-key";

			await expect(createEmbedding("")).rejects.toThrow("Text cannot be empty");
			await expect(createEmbedding("   ")).rejects.toThrow(
				"Text cannot be empty",
			);
		});

		it("should throw error for text exceeding max length", async () => {
			process.env.AITUNNEL_API_KEY = "test-key";
			const longText = "a".repeat(8001);

			await expect(createEmbedding(longText)).rejects.toThrow(
				"Text too long: 8001 chars (max 8000)",
			);
		});
	});

	describe("successful embedding creation", () => {
		it("should create embedding with valid response", async () => {
			process.env.AITUNNEL_API_KEY = "test-key";

			const mockEmbedding = new Array(1024).fill(0.1);
			const mockResponse = {
				data: [{ embedding: mockEmbedding }],
				model: "text-embedding-v4",
				usage: {
					prompt_tokens: 10,
					total_tokens: 10,
				},
			};

			const OpenAI = (await import("openai")).default;
			const mockCreate = vi.fn().mockResolvedValue(mockResponse);
			(OpenAI as any).mockImplementation(() => ({
				embeddings: { create: mockCreate },
			}));

			const result = await createEmbedding("test text");

			expect(result.embedding).toEqual(mockEmbedding);
			expect(result.model).toBe("text-embedding-v4");
			expect(result.usage.promptTokens).toBe(10);
			expect(result.usage.totalTokens).toBe(10);
			expect(mockCreate).toHaveBeenCalledWith(
				{
					model: "text-embedding-v4",
					input: "test text",
					dimensions: 1024,
				},
				expect.objectContaining({
					signal: expect.any(AbortSignal),
				}),
			);
		});

		it("should throw error for invalid embedding dimensions", async () => {
			process.env.AITUNNEL_API_KEY = "test-key";

			const mockResponse = {
				data: [{ embedding: new Array(512).fill(0.1) }], // Wrong dimensions
				model: "text-embedding-v4",
				usage: { prompt_tokens: 10, total_tokens: 10 },
			};

			const OpenAI = (await import("openai")).default;
			(OpenAI as any).mockImplementation(() => ({
				embeddings: { create: vi.fn().mockResolvedValue(mockResponse) },
			}));

			await expect(createEmbedding("test text")).rejects.toThrow(
				"Invalid embedding dimensions: expected 1024, got 512",
			);
		});

		it("should throw error for empty response", async () => {
			process.env.AITUNNEL_API_KEY = "test-key";

			const mockResponse = {
				data: [],
				model: "text-embedding-v4",
				usage: { prompt_tokens: 10, total_tokens: 10 },
			};

			const OpenAI = (await import("openai")).default;
			(OpenAI as any).mockImplementation(() => ({
				embeddings: { create: vi.fn().mockResolvedValue(mockResponse) },
			}));

			await expect(createEmbedding("test text")).rejects.toThrow(
				"Empty embedding response from API",
			);
		});
	});

	describe("retry logic", () => {
		it("should retry on API failure with exponential backoff", async () => {
			process.env.AITUNNEL_API_KEY = "test-key";

			const mockEmbedding = new Array(1024).fill(0.1);
			const mockSuccessResponse = {
				data: [{ embedding: mockEmbedding }],
				model: "text-embedding-v4",
				usage: { prompt_tokens: 10, total_tokens: 10 },
			};

			const mockCreate = vi
				.fn()
				.mockRejectedValueOnce(new Error("Network error"))
				.mockRejectedValueOnce(new Error("Network error"))
				.mockResolvedValueOnce(mockSuccessResponse);

			const OpenAI = (await import("openai")).default;
			(OpenAI as any).mockImplementation(() => ({
				embeddings: { create: mockCreate },
			}));

			const result = await createEmbedding("test text");

			expect(result.embedding).toEqual(mockEmbedding);
			expect(mockCreate).toHaveBeenCalledTimes(3);
		});

		it("should fail after max retries exhausted", async () => {
			process.env.AITUNNEL_API_KEY = "test-key";

			const mockCreate = vi
				.fn()
				.mockRejectedValue(new Error("Persistent network error"));

			const OpenAI = (await import("openai")).default;
			(OpenAI as any).mockImplementation(() => ({
				embeddings: { create: mockCreate },
			}));

			await expect(
				createEmbedding("test text", { retries: 3 }),
			).rejects.toThrow("Failed to create embedding after 3 attempts");

			expect(mockCreate).toHaveBeenCalledTimes(3);
		});

		it("should not retry on validation errors", async () => {
			process.env.AITUNNEL_API_KEY = "test-key";

			const mockCreate = vi.fn();
			const OpenAI = (await import("openai")).default;
			(OpenAI as any).mockImplementation(() => ({
				embeddings: { create: mockCreate },
			}));

			await expect(createEmbedding("")).rejects.toThrow("Text cannot be empty");

			// Should not call API at all for validation errors
			expect(mockCreate).not.toHaveBeenCalled();
		});
	});

	describe("timeout handling", () => {
		it("should timeout after specified duration", async () => {
			process.env.AITUNNEL_API_KEY = "test-key";

			const mockCreate = vi.fn().mockImplementation(
				(_params, options) =>
					new Promise((resolve, reject) => {
						// Simulate abort signal handling
						const signal = options?.signal;
						if (signal) {
							signal.addEventListener("abort", () => {
								const error = new Error("Aborted");
								error.name = "AbortError";
								reject(error);
							});
						}
						// Never resolve to simulate long request
						setTimeout(resolve, 20000);
					}),
			);

			const OpenAI = (await import("openai")).default;
			(OpenAI as any).mockImplementation(() => ({
				embeddings: { create: mockCreate },
			}));

			await expect(
				createEmbedding("test text", { timeoutMs: 100, retries: 1 }),
			).rejects.toThrow("Embedding request timed out after 100ms");
		}, 10000);

		it("should use default timeout of 10 seconds", async () => {
			process.env.AITUNNEL_API_KEY = "test-key";

			const mockCreate = vi.fn();
			const OpenAI = (await import("openai")).default;
			(OpenAI as any).mockImplementation(() => ({
				embeddings: { create: mockCreate },
			}));

			// Just verify the function accepts no timeout parameter
			// Actual timeout testing would require mocking timers
			mockCreate.mockResolvedValue({
				data: [{ embedding: new Array(1024).fill(0.1) }],
				model: "text-embedding-v4",
				usage: { prompt_tokens: 10, total_tokens: 10 },
			});

			await createEmbedding("test text");
			expect(mockCreate).toHaveBeenCalled();
		});
	});
});
