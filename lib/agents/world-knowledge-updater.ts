/**
 * World Knowledge Updater Agent
 *
 * Extracts objective world information from completed game turns.
 * Identifies entities (locations, NPCs, items, factions, events) and
 * relationships between them.
 */

import { callOpenRouter } from "@/lib/llm/openrouter";
import type {
	WorldEntityData,
	WorldKnowledgeUpdate,
	WorldRelationshipData,
} from "./protocol";

export interface WorldKnowledgeUpdaterOptions {
	timeoutMs?: number;
	model?: string;
}

interface LLMExtractionResponse {
	entities: Array<{
		type: "location" | "npc" | "item" | "faction" | "event";
		name: string;
		properties: Record<string, unknown>;
	}>;
	relationships: Array<{
		sourceEntityName: string;
		targetEntityName: string;
		relationshipType: string;
		properties?: Record<string, unknown>;
	}>;
}

/**
 * Extract world knowledge from a completed game turn
 */
export async function updateWorldKnowledge(
	sessionId: number,
	turnNumber: number,
	playerMessage: string,
	gmMessage: string,
	options: WorldKnowledgeUpdaterOptions = {},
): Promise<WorldKnowledgeUpdate> {
	const startTime = Date.now();
	const timeoutMs = options.timeoutMs ?? 5000;
	const model = options.model ?? "x-ai/grok-4-fast";

	// Validate API key
	if (!process.env.OPENROUTER_API_KEY) {
		throw new Error(
			"[World Knowledge Updater] OPENROUTER_API_KEY not found in .env",
		);
	}

	const systemPrompt = buildSystemPrompt();
	const userPrompt = buildUserPrompt(turnNumber, playerMessage, gmMessage);

	try {
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
				max_tokens: 1000,
				response_format: { type: "json_object" },
			},
			{
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
			console.error("[World Knowledge Updater] Empty response from API:", {
				status: response.status,
				hasChoices: !!data.choices,
				choicesLength: data.choices?.length,
				firstChoice: data.choices?.[0],
				fullResponse: JSON.stringify(data).slice(0, 500),
			});
			throw new Error("Empty response from LLM");
		}

		// Parse JSON response
		const extracted = parseExtractionResponse(content);

		const entities: WorldEntityData[] = extracted.entities.map((e) => ({
			type: e.type,
			name: e.name,
			properties: e.properties,
			isNew: true, // Will be determined during persistence
		}));

		const relationships: WorldRelationshipData[] = extracted.relationships;

		const extractionTimeMs = Date.now() - startTime;

		return {
			entities,
			relationships,
			extractionTimeMs,
		};
	} catch (error) {
		const extractionTimeMs = Date.now() - startTime;

		if (error instanceof Error && error.name === "AbortError") {
			console.error(`[World Knowledge Updater] Timeout after ${timeoutMs}ms`, {
				sessionId,
				turnNumber,
			});
		} else {
			console.error("[World Knowledge Updater] Extraction failed:", {
				sessionId,
				turnNumber,
				error: error instanceof Error ? error.message : String(error),
			});
		}

		// Return empty update on error
		return {
			entities: [],
			relationships: [],
			extractionTimeMs,
		};
	}
}

function buildSystemPrompt(): string {
	return `Ты — агент извлечения знаний о мире для RPG игры.
Извлекай объективные факты о игровом мире из хода игры.

Извлекай:
1. Сущности (locations, NPCs, items, factions, events)
2. Свойства сущностей (описания, атрибуты, состояния)
3. Связи между сущностями

Фокусируйся на ОБЪЕКТИВНЫХ фактах, которые существуют в мире, а не на мнениях игрока или временных состояниях.

Типы сущностей:
- location: места (города, здания, комнаты, регионы)
- npc: неигровые персонажи
- item: предметы (оружие, инструменты, артефакты)
- faction: организации, группы, фракции
- event: важные события (битвы, церемонии, происшествия)

Типы связей (примеры):
- is_mayor_of, is_king_of, rules, governs
- located_in, part_of, contains
- owns, possesses, carries
- member_of, belongs_to, allied_with
- happened_in, occurred_at
- caused_by, resulted_in

Отвечай ТОЛЬКО в JSON формате:
{
  "entities": [
    {
      "type": "location|npc|item|faction|event",
      "name": "каноническое имя",
      "properties": { "ключ": "значение", ... }
    }
  ],
  "relationships": [
    {
      "sourceEntityName": "Сущность А",
      "targetEntityName": "Сущность Б",
      "relationshipType": "тип_связи",
      "properties": {}
    }
  ]
}

Если в ходе нет новой информации о мире, верни пустые массивы.`;
}

function buildUserPrompt(
	turnNumber: number,
	playerMessage: string,
	gmMessage: string,
): string {
	return `Ход ${turnNumber}:

Игрок: "${playerMessage}"

GM: "${gmMessage}"

Извлеки знания о мире в JSON формате.`;
}

function parseExtractionResponse(content: string): LLMExtractionResponse {
	// Try to extract JSON from response
	// LLM might wrap JSON in markdown code blocks
	let jsonStr = content.trim();

	// Remove markdown code blocks if present
	const codeBlockMatch = jsonStr.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
	if (codeBlockMatch) {
		jsonStr = codeBlockMatch[1];
	}

	// Find JSON object in text
	const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
	if (jsonMatch) {
		jsonStr = jsonMatch[0];
	}

	try {
		const parsed = JSON.parse(jsonStr);

		// Validate structure
		if (!parsed.entities || !Array.isArray(parsed.entities)) {
			console.warn(
				"[World Knowledge Updater] Invalid response: missing entities array",
			);
			return { entities: [], relationships: [] };
		}

		if (!parsed.relationships || !Array.isArray(parsed.relationships)) {
			console.warn(
				"[World Knowledge Updater] Invalid response: missing relationships array",
			);
			parsed.relationships = [];
		}

		return parsed as LLMExtractionResponse;
	} catch (error) {
		console.error(
			"[World Knowledge Updater] Failed to parse JSON response:",
			error,
		);
		console.error("[World Knowledge Updater] Raw content:", content);
		return { entities: [], relationships: [] };
	}
}
