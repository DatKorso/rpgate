/**
 * OpenRouter API client with prompt caching support
 *
 * NOTE: Currently using Llama 4 Maverick (free) which does NOT support:
 * - Prompt caching
 * - response_format (JSON mode)
 *
 * This module is prepared for future use with Claude or when Grok adds caching.
 *
 * Caching is supported by:
 * - Anthropic Claude models (claude-3-5-sonnet, claude-3-haiku, etc.)
 * - Google Gemini models (gemini-1.5-pro, gemini-1.5-flash)
 *
 * Cached tokens cost ~10% of regular input tokens.
 *
 * @see https://openrouter.ai/docs/prompt-caching
 * @see https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
 */

/**
 * Default LLM model for all agents
 *
 * Options:
 * - "x-ai/grok-4-fast" - Free, fast, but no JSON mode
 * - "x-ai/grok-4-fast" - Fast, good quality, no caching
 * - "anthropic/claude-3-haiku" - Cheap, supports caching
 * - "anthropic/claude-3-5-sonnet" - Best quality, supports caching
 */
export const DEFAULT_MODEL = "x-ai/grok-4-fast";

export interface Message {
	role: "system" | "user" | "assistant";
	content: string | ContentBlock[];
}

export interface ContentBlock {
	type: "text" | "image";
	text?: string;
	source?: {
		type: "base64";
		media_type: string;
		data: string;
	};
	cache_control?: {
		type: "ephemeral";
	};
}

export interface OpenRouterRequest {
	model: string;
	messages: Message[];
	temperature?: number;
	max_tokens?: number;
	stream?: boolean;
	// Note: Not all models support response_format (e.g., free Llama models)
	response_format?: { type: "json_object" };
}

export interface OpenRouterResponse {
	id: string;
	model: string;
	choices: Array<{
		message?: {
			role: string;
			content: string;
		};
		delta?: {
			content?: string;
		};
		finish_reason?: string;
	}>;
	usage?: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
		// Anthropic caching fields
		cache_creation_input_tokens?: number;
		cache_read_input_tokens?: number;
	};
}

/**
 * Mark content block for caching (Anthropic models only)
 *
 * Cache breakpoints should be placed at:
 * - End of system prompt
 * - End of few-shot examples
 * - End of long context (e.g., conversation history)
 *
 * Minimum cacheable length: ~1024 tokens (~800 words)
 * Cache TTL: 5 minutes
 */
export function markForCache(content: string): ContentBlock[] {
	return [
		{
			type: "text",
			text: content,
			cache_control: { type: "ephemeral" },
		},
	];
}

/**
 * Call OpenRouter API with optional caching
 */
export async function callOpenRouter(
	request: OpenRouterRequest,
	options: {
		apiKey?: string;
		timeoutMs?: number;
		signal?: AbortSignal;
	} = {},
): Promise<Response> {
	const apiKey = options.apiKey ?? process.env.OPENROUTER_API_KEY;
	if (!apiKey) {
		throw new Error("OPENROUTER_API_KEY not configured");
	}

	const controller = new AbortController();
	const timeoutId = options.timeoutMs
		? setTimeout(() => controller.abort(), options.timeoutMs)
		: null;

	const signal = options.signal ?? controller.signal;

	try {
		const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
				// Optional: track usage per app
				// "HTTP-Referer": "https://rpgate.example.com",
				// "X-Title": "RPGate",
			},
			body: JSON.stringify(request),
			signal,
		});

		if (timeoutId) clearTimeout(timeoutId);
		return resp;
	} catch (err) {
		if (timeoutId) clearTimeout(timeoutId);
		throw err;
	}
}

/**
 * Stream response from OpenRouter
 */
export async function* streamOpenRouter(
	request: OpenRouterRequest,
	options: {
		apiKey?: string;
		timeoutMs?: number;
	} = {},
): AsyncGenerator<string, void, void> {
	const resp = await callOpenRouter({ ...request, stream: true }, options);

	if (!resp.ok || !resp.body) {
		throw new Error(`OpenRouter API error: ${resp.status} ${resp.statusText}`);
	}

	const reader = resp.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";

	while (true) {
		const { value, done } = await reader.read();
		if (done) break;

		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split(/\n/);
		buffer = lines.pop() ?? "";

		for (const raw of lines) {
			const line = raw.trim();
			if (!line.startsWith("data:")) continue;

			const payload = line.slice(5).trim();
			if (!payload || payload === "[DONE]") continue;

			try {
				const json = JSON.parse(payload) as OpenRouterResponse;
				const content = json?.choices?.[0]?.delta?.content ?? "";
				if (content) {
					yield content;
				}
			} catch {
				// Ignore malformed chunks
			}
		}
	}
}
