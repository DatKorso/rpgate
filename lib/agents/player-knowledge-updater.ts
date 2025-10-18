/**
 * Player Knowledge Updater Agent
 *
 * Tracks what the player character learns from completed game turns.
 * Focuses on PC-learnable knowledge only (direct observation, NPC dialogue, reading).
 */

import { callOpenRouter } from "@/lib/llm/openrouter";
import type { PlayerKnowledgeData, PlayerKnowledgeUpdate } from "./protocol";

export interface PlayerKnowledgeUpdaterOptions {
	timeoutMs?: number;
	model?: string;
}

interface LLMKnowledgeResponse {
	updates: Array<{
		entityName: string;
		entityType: "location" | "npc" | "item" | "faction" | "event";
		awarenessLevel: "heard_of" | "met" | "familiar";
		newFacts: Array<{
			property: string;
			value: unknown;
			source: string;
			confidence?: string;
		}>;
	}>;
}

/**
 * Update player knowledge from a completed game turn
 */
export async function updatePlayerKnowledge(
	sessionId: number,
	turnNumber: number,
	playerMessage: string,
	gmMessage: string,
	options: PlayerKnowledgeUpdaterOptions = {},
): Promise<PlayerKnowledgeUpdate> {
	const startTime = Date.now();
	const timeoutMs = options.timeoutMs ?? 5000;
	const model = options.model ?? "x-ai/grok-4-fast";

	// Validate API key
	if (!process.env.OPENROUTER_API_KEY) {
		throw new Error(
			"[Player Knowledge Updater] OPENROUTER_API_KEY not found in .env",
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
			console.error("[Player Knowledge Updater] Empty response from API:", {
				status: response.status,
				hasChoices: !!data.choices,
				choicesLength: data.choices?.length,
				firstChoice: data.choices?.[0],
				fullResponse: JSON.stringify(data).slice(0, 500),
			});
			throw new Error("Empty response from LLM");
		}

		// Parse JSON response
		const extracted = parseKnowledgeResponse(content);

		const updates: PlayerKnowledgeData[] = extracted.updates.map((u) => ({
			entityName: u.entityName,
			entityType: u.entityType,
			awarenessLevel: u.awarenessLevel,
			newFacts: u.newFacts,
		}));

		const extractionTimeMs = Date.now() - startTime;

		// Log successful extraction with details
		if (updates.length > 0) {
			console.log("[Player Knowledge Updater] Extraction Success", {
				sessionId,
				turnNumber,
				extractionTimeMs,
				updatesCount: updates.length,
				entities: updates.map((u) => ({
					name: u.entityName,
					type: u.entityType,
					awarenessLevel: u.awarenessLevel,
					factsCount: u.newFacts.length,
				})),
			});

			// Log individual knowledge updates for detailed monitoring
			for (const update of updates) {
				console.log("[Player Knowledge] Entity Update", {
					sessionId,
					turnNumber,
					entity: update.entityName,
					type: update.entityType,
					awarenessLevel: update.awarenessLevel,
					factsLearned: update.newFacts.length,
					facts: update.newFacts.map((f) => ({
						property: f.property,
						source: f.source,
						confidence: f.confidence,
					})),
				});
			}

			// Log awareness level distribution
			const awarenessLevels: Record<string, number> = {};
			for (const update of updates) {
				awarenessLevels[update.awarenessLevel] =
					(awarenessLevels[update.awarenessLevel] || 0) + 1;
			}
			console.log("[Player Knowledge] Awareness Levels", {
				sessionId,
				turnNumber,
				distribution: awarenessLevels,
			});

			// Log knowledge source distribution
			const sources: Record<string, number> = {};
			for (const update of updates) {
				for (const fact of update.newFacts) {
					sources[fact.source] = (sources[fact.source] || 0) + 1;
				}
			}
			console.log("[Player Knowledge] Knowledge Sources", {
				sessionId,
				turnNumber,
				distribution: sources,
			});
		} else {
			console.log("[Player Knowledge Updater] No knowledge extracted", {
				sessionId,
				turnNumber,
				extractionTimeMs,
			});
		}

		return {
			updates,
			extractionTimeMs,
		};
	} catch (error) {
		const extractionTimeMs = Date.now() - startTime;

		if (error instanceof Error && error.name === "AbortError") {
			console.error(`[Player Knowledge Updater] Timeout after ${timeoutMs}ms`, {
				sessionId,
				turnNumber,
			});
		} else {
			console.error("[Player Knowledge Updater] Extraction failed:", {
				sessionId,
				turnNumber,
				error: error instanceof Error ? error.message : String(error),
			});
		}

		// Return empty update on error
		return {
			updates: [],
			extractionTimeMs,
		};
	}
}

function buildSystemPrompt(): string {
	return `Ты — агент отслеживания знаний персонажа игрока для RPG игры.
Определи, что ПЕРСОНАЖ ИГРОКА узнал в этом ходе.

КРИТИЧЕСКИ ВАЖНО: Включай только знания, которые ПИ ДЕЙСТВИТЕЛЬНО узнал через:
- Прямое наблюдение (видел своими глазами)
- Диалог с NPC (ему сказали напрямую)
- Чтение (книги, знаки, письма)
- Физическое взаимодействие (трогал, использовал, владеет)

НЕ ВКЛЮЧАЙ:
- Описания GM вне восприятия ПИ
- Мысли или личные действия других персонажей
- Информацию, которую ПИ не мог узнать

Для каждого узнанного факта укажи:
- Имя и тип сущности
- Уровень осведомлённости (heard_of, met, familiar)
- Конкретные узнанные факты
- Источник знания

Уровни осведомлённости:
- heard_of: слышал о сущности, но не встречал лично
- met: встречал лично, имеет базовое знакомство
- familiar: хорошо знаком, имеет детальное знание

Источники знания:
- arrived: прибыл в локацию
- observation: наблюдал напрямую
- heard_from_npc: услышал от NPC
- read_in_book: прочитал в книге/письме/знаке
- met_personally: встретил лично
- owns: владеет предметом
- used: использовал предмет

Отвечай ТОЛЬКО в JSON формате:
{
  "updates": [
    {
      "entityName": "имя сущности",
      "entityType": "location|npc|item|faction|event",
      "awarenessLevel": "heard_of|met|familiar",
      "newFacts": [
        {
          "property": "name|occupation|location|description|...",
          "value": "значение",
          "source": "observation|heard_from_npc|read_in_book|...",
          "confidence": "certain|likely|rumor"
        }
      ]
    }
  ]
}

Если ПИ ничего не узнал в этом ходе, верни пустой массив updates.`;
}

function buildUserPrompt(
	turnNumber: number,
	playerMessage: string,
	gmMessage: string,
): string {
	return `Ход ${turnNumber}:

Действие игрока: "${playerMessage}"

Ответ GM: "${gmMessage}"

Что узнал персонаж игрока? Отвечай в JSON формате.`;
}

function parseKnowledgeResponse(content: string): LLMKnowledgeResponse {
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
		if (!parsed.updates || !Array.isArray(parsed.updates)) {
			console.warn(
				"[Player Knowledge Updater] Invalid response: missing updates array",
			);
			return { updates: [] };
		}

		return parsed as LLMKnowledgeResponse;
	} catch (error) {
		console.error(
			"[Player Knowledge Updater] Failed to parse JSON response:",
			error,
		);
		console.error("[Player Knowledge Updater] Raw content:", content);
		return { updates: [] };
	}
}
