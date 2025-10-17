/**
 * Embedding Service for AITunnel API integration
 *
 * Creates vector embeddings for text using OpenAI-compatible AITunnel API.
 * Includes retry logic, timeout handling, and validation.
 */

import OpenAI from "openai";
import { EMBEDDING_CONFIG } from "./config";

const {
	MODEL,
	DIMENSIONS,
	TIMEOUT_MS,
	MAX_RETRIES,
	MAX_TEXT_LENGTH,
	BASE_URL,
} = EMBEDDING_CONFIG;

export interface EmbeddingResult {
	embedding: number[];
	model: string;
	usage: {
		promptTokens: number;
		totalTokens: number;
	};
}

export interface EmbeddingOptions {
	timeoutMs?: number;
	retries?: number;
}

/**
 * Create embedding for text using AITunnel API
 *
 * @param text - Text to embed (max 8000 chars)
 * @param options - Timeout and retry configuration
 * @returns Embedding result with vector and usage stats
 * @throws Error if API key missing, text too long, or all retries fail
 */
export async function createEmbedding(
	text: string,
	options: EmbeddingOptions = {},
): Promise<EmbeddingResult> {
	const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
	const maxRetries = options.retries ?? MAX_RETRIES;

	// Validation
	const apiKey = process.env.AITUNNEL_API_KEY;
	if (!apiKey) {
		throw new Error("AITUNNEL_API_KEY not configured");
	}

	if (!text || text.trim().length === 0) {
		throw new Error("Text cannot be empty");
	}

	if (text.length > MAX_TEXT_LENGTH) {
		throw new Error(
			`Text too long: ${text.length} chars (max ${MAX_TEXT_LENGTH})`,
		);
	}

	// Initialize client
	const client = new OpenAI({
		apiKey,
		baseURL: BASE_URL,
	});

	// Retry loop with exponential backoff
	let lastError: Error | null = null;
	for (let attempt = 0; attempt < maxRetries; attempt++) {
		try {
			const result = await createEmbeddingWithTimeout(client, text, timeoutMs);
			return result;
		} catch (err) {
			lastError = err instanceof Error ? err : new Error(String(err));

			// Log retry attempt
			console.warn(
				`[Embeddings] Attempt ${attempt + 1}/${maxRetries} failed:`,
				lastError.message,
			);

			// Don't retry on validation errors
			if (
				lastError.message.includes("not configured") ||
				lastError.message.includes("too long") ||
				lastError.message.includes("empty")
			) {
				throw lastError;
			}

			// Exponential backoff: 1s, 2s, 4s
			if (attempt < maxRetries - 1) {
				const delayMs = 1000 * 2 ** attempt;
				await sleep(delayMs);
			}
		}
	}

	// All retries exhausted
	console.error(
		`[Embeddings] All ${maxRetries} attempts failed for text: "${text.slice(0, 100)}..."`,
	);
	throw new Error(
		`Failed to create embedding after ${maxRetries} attempts: ${lastError?.message}`,
	);
}

/**
 * Create embedding with timeout
 */
async function createEmbeddingWithTimeout(
	client: OpenAI,
	text: string,
	timeoutMs: number,
): Promise<EmbeddingResult> {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const response = await client.embeddings.create(
			{
				model: MODEL,
				input: text,
				dimensions: DIMENSIONS,
			},
			{
				signal: controller.signal,
			},
		);

		clearTimeout(timeoutId);

		// Validate response
		if (!response.data || response.data.length === 0) {
			throw new Error("Empty embedding response from API");
		}

		const embedding = response.data[0].embedding;
		if (!embedding || embedding.length !== DIMENSIONS) {
			throw new Error(
				`Invalid embedding dimensions: expected ${DIMENSIONS}, got ${embedding?.length ?? 0}`,
			);
		}

		return {
			embedding,
			model: response.model,
			usage: {
				promptTokens: response.usage.prompt_tokens,
				totalTokens: response.usage.total_tokens,
			},
		};
	} catch (err) {
		clearTimeout(timeoutId);

		// Handle timeout
		if (err instanceof Error && err.name === "AbortError") {
			throw new Error(`Embedding request timed out after ${timeoutMs}ms`);
		}

		throw err;
	}
}

/**
 * Sleep utility for retry backoff
 */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
