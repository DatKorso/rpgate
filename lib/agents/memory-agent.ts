/**
 * Memory Agent - LLM-based memory retrieval decision system
 *
 * Analyzes player input to determine if memory retrieval is needed,
 * generates semantic search queries, and extracts mentioned entities.
 *
 * Replaces rule-based heuristic with LLM-based analysis for more
 * accurate and flexible memory retrieval decisions.
 */

import type {
	ChatHistoryEntry,
	ExtractedEntity,
	MemoryAgentDecision,
	MemoryAgentOptions,
} from "@/lib/agents/protocol";
import { normalizeEntityName } from "@/lib/knowledge/entity-utils";
import { callOpenRouter } from "@/lib/llm/openrouter";
import { MEMORY_AGENT_CONFIG } from "@/lib/memory/config";
import { logMemoryAgentDecision } from "@/lib/memory/logger";

const { DEFAULT_TIMEOUT_MS, DEFAULT_MODEL } = MEMORY_AGENT_CONFIG;

/**
 * Analyzes player input to determine memory retrieval needs
 *
 * Uses LLM to:
 * 1. Decide if memory retrieval is needed
 * 2. Generate 2-4 diverse search queries
 * 3. Extract mentioned entities with types
 *
 * @param playerInput - Current player input text
 * @param recentContext - Recent chat history for context
 * @param options - Configuration options (timeout, model, sessionId)
 * @returns Memory agent decision with queries and entities
 */
export async function analyzeMemoryNeed(
	playerInput: string,
	recentContext: ChatHistoryEntry[],
	options: MemoryAgentOptions = {},
): Promise<MemoryAgentDecision> {
	const startTime = Date.now();
	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const model = options.model ?? DEFAULT_MODEL;
	const sessionId = options.sessionId;

	// Validate API key
	if (!process.env.OPENROUTER_API_KEY) {
		const executionTimeMs = Date.now() - startTime;
		console.error(
			"[Memory Agent] OPENROUTER_API_KEY not found in environment variables",
		);

		const errorDecision: MemoryAgentDecision = {
			shouldRetrieve: false,
			reason: "OPENROUTER_API_KEY not configured",
			queries: [],
			entities: [],
			confidence: 0.0,
		};

		logMemoryAgentDecision(
			playerInput,
			errorDecision,
			executionTimeMs,
			true,
			sessionId,
		);

		throw new Error("OPENROUTER_API_KEY not configured");
	}

	// Empty input fallback
	if (!playerInput || playerInput.trim().length === 0) {
		const decision: MemoryAgentDecision = {
			shouldRetrieve: false,
			reason: "Empty input",
			queries: [],
			entities: [],
			confidence: 0.0,
		};
		logMemoryAgentDecision(
			playerInput,
			decision,
			Date.now() - startTime,
			false,
			sessionId,
		);
		return decision;
	}

	try {
		// Build prompts
		const systemPrompt = buildSystemPrompt();
		const userPrompt = buildUserPrompt(playerInput, recentContext);

		// Call LLM with timeout
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

		const response = await callOpenRouter(
			{
				model,
				messages: [
					{ role: "system", content: systemPrompt },
					{ role: "user", content: userPrompt },
				],
				temperature: 0.3,
				max_tokens: 500,
				response_format: { type: "json_object" },
			},
			{
				apiKey: process.env.OPENROUTER_API_KEY,
				timeoutMs,
				signal: controller.signal,
			},
		);

		clearTimeout(timeoutId);

		if (!response.ok) {
			throw new Error(
				`OpenRouter API error: ${response.status} ${response.statusText}`,
			);
		}

		const data = await response.json();
		const content = data.choices?.[0]?.message?.content;

		if (!content) {
			console.error("[Memory Agent] Empty response from API:", {
				status: response.status,
				hasChoices: !!data.choices,
				choicesLength: data.choices?.length,
				firstChoice: data.choices?.[0],
				fullResponse: JSON.stringify(data).slice(0, 500),
			});
			throw new Error("No content in LLM response");
		}

		// Parse JSON response
		const decision = parseDecisionResponse(content);
		const executionTimeMs = Date.now() - startTime;

		// Log decision with session ID
		logMemoryAgentDecision(
			playerInput,
			decision,
			executionTimeMs,
			false,
			sessionId,
		);

		return decision;
	} catch (err) {
		const executionTimeMs = Date.now() - startTime;
		const errorMessage = err instanceof Error ? err.message : String(err);
		const isTimeout =
			errorMessage.includes("abort") || errorMessage.includes("timeout");

		// Log timeout events explicitly
		if (isTimeout) {
			console.warn("[Memory Agent] Timeout event:", {
				executionTimeMs,
				timeoutMs,
				playerInput: playerInput.slice(0, 50),
				sessionId,
			});
		} else {
			console.error("[Memory Agent] Analysis failed:", {
				error: errorMessage,
				playerInput: playerInput.slice(0, 100),
				executionTimeMs,
				sessionId,
			});
		}

		// Return safe default on error
		const fallbackDecision: MemoryAgentDecision = {
			shouldRetrieve: false,
			reason: isTimeout
				? `Timeout after ${executionTimeMs}ms`
				: `Error: ${errorMessage}`,
			queries: [],
			entities: [],
			confidence: 0.0,
		};

		logMemoryAgentDecision(
			playerInput,
			fallbackDecision,
			executionTimeMs,
			true,
			sessionId,
		);

		throw err;
	}
}

/**
 * Builds system prompt for Memory Agent
 */
function buildSystemPrompt(): string {
	return `You are a Memory Agent for an RPG game.
Analyze player input to determine if memory retrieval is needed.

Your tasks:
1. Decide if the player is referencing past events, locations, NPCs, or items
2. Generate 2-4 diverse search queries (semantic variations, not literal text)
3. Extract mentioned entities with types

Entity types: location, npc, item, faction, event

Respond in JSON format:
{
  "shouldRetrieve": boolean,
  "reason": "brief explanation",
  "queries": ["query1", "query2", ...],
  "entities": [{"name": "...", "type": "location|npc|item|faction|event", "context": "..."}],
  "confidence": 0.0-1.0
}

Examples:

Input: "Я возвращаюсь в таверну Золотой Дракон"
Output: {
  "shouldRetrieve": true,
  "reason": "Player returning to previously visited location",
  "queries": [
    "таверна Золотой Дракон",
    "что происходило в таверне",
    "события в Золотом Драконе"
  ],
  "entities": [
    {"name": "Золотой Дракон", "type": "location", "context": "таверна"}
  ],
  "confidence": 0.9
}

Input: "Кто такой Иван?"
Output: {
  "shouldRetrieve": true,
  "reason": "Player asking about NPC",
  "queries": [
    "Иван",
    "встреча с Иваном",
    "информация об Иване"
  ],
  "entities": [
    {"name": "Иван", "type": "npc"}
  ],
  "confidence": 1.0
}

Input: "Я атакую орка"
Output: {
  "shouldRetrieve": false,
  "reason": "Current action, no reference to past events",
  "queries": [],
  "entities": [],
  "confidence": 0.0
}`;
}

/**
 * Builds user prompt with player input and context
 */
function buildUserPrompt(
	playerInput: string,
	recentContext: ChatHistoryEntry[],
): string {
	let prompt = "";

	// Add recent context if available
	if (recentContext.length > 0) {
		const contextLines = recentContext
			.slice(-5) // Last 5 messages
			.map(
				(entry) =>
					`${entry.role === "player" ? "Игрок" : "GM"}: ${entry.content}`,
			)
			.join("\n");

		prompt += `Recent context:\n${contextLines}\n\n`;
	}

	prompt += `Player input: "${playerInput}"\n\nAnalyze and respond in JSON.`;

	return prompt;
}

/**
 * Parses LLM response into MemoryAgentDecision
 */
function parseDecisionResponse(content: string): MemoryAgentDecision {
	try {
		// Try to extract JSON from response
		const jsonMatch = content.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			throw new Error("No JSON found in response");
		}

		const parsed = JSON.parse(jsonMatch[0]);

		// Validate required fields
		if (typeof parsed.shouldRetrieve !== "boolean") {
			throw new Error("Missing or invalid shouldRetrieve field");
		}

		// Normalize and validate
		const decision: MemoryAgentDecision = {
			shouldRetrieve: parsed.shouldRetrieve,
			reason: String(parsed.reason ?? "No reason provided"),
			queries: Array.isArray(parsed.queries)
				? parsed.queries.map((q: unknown) => String(q))
				: [],
			entities: Array.isArray(parsed.entities)
				? parsed.entities
						.map((e: unknown) => normalizeEntity(e))
						.filter(
							(e: ExtractedEntity | null): e is ExtractedEntity => e !== null,
						)
				: [],
			confidence: normalizeConfidence(parsed.confidence),
		};

		return decision;
	} catch (err) {
		console.error("[Memory Agent] Failed to parse LLM response:", {
			error: err instanceof Error ? err.message : String(err),
			content: content.slice(0, 200),
		});

		// Return safe default
		return {
			shouldRetrieve: false,
			reason: "Failed to parse LLM response",
			queries: [],
			entities: [],
			confidence: 0.0,
		};
	}
}

/**
 * Normalizes entity object from LLM response
 */
function normalizeEntity(entity: unknown): ExtractedEntity | null {
	if (typeof entity !== "object" || entity === null) {
		return null;
	}

	const e: Record<string, unknown> = entity as Record<string, unknown>;

	// Validate required fields
	if (typeof e.name !== "string" || !e.name.trim()) {
		return null;
	}

	if (typeof e.type !== "string") {
		return null;
	}

	// Validate entity type
	const validTypes = ["location", "npc", "item", "faction", "event"];
	const type = e.type.toLowerCase();
	if (!validTypes.includes(type)) {
		return null;
	}

	return {
		name: normalizeEntityName(e.name),
		type: type as ExtractedEntity["type"],
		context: typeof e.context === "string" ? e.context.trim() : undefined,
	};
}

/**
 * Normalizes confidence score to 0-1 range
 */
function normalizeConfidence(value: unknown): number {
	if (typeof value === "number") {
		return Math.max(0, Math.min(1, value));
	}
	return 0.0;
}
