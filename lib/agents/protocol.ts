import type { MemoryEntryData } from "@/db/schema";

// Re-export MemoryEntryData for convenience
export type { MemoryEntryData };

export type CheckType = "none" | "skill" | "contest" | "save";

export interface AppearanceData {
	age?: number;
	height?: "низкий" | "средний" | "высокий";
	build?: "худощавый" | "крепкий" | "полный";
	hair?: "темные" | "светлые" | "рыжие" | "седые";
	eyes?: "карие" | "голубые" | "зеленые" | "серые";
	distinguishingMarks?: string;
}

export interface BackgroundData {
	origin?: "деревня" | "город" | "дворянство" | "кочевники";
	profession?: "ремесленник" | "торговец" | "солдат" | "ученый";
	motivation?: string;
}

export interface PlayerProfile {
	name?: string;
	className?: string; // свободная строка
	bio?: string;
	appearance?: AppearanceData;
	background?: BackgroundData;
	abilityPriority?: "physical" | "mental" | "social";
}

export interface EnhancedCharacterProfile {
	// Core identity
	name?: string;
	className: string;
	bio: string;

	// Physical appearance
	appearance: AppearanceData;

	// Background story
	background: BackgroundData;

	// Game mechanics
	abilityPriority?: "physical" | "mental" | "social";
	abilities: {
		str: number;
		dex: number;
		con: number;
		int: number;
		wis: number;
		cha: number;
	};
}

export interface PlayerInput {
	sessionId: string; // external identifier from client
	content: string;
	profile?: PlayerProfile;
}

export type ChatHistoryRole = "player" | "gm";

export interface ChatHistoryEntry {
	role: ChatHistoryRole;
	content: string;
}

export interface MemoryContext {
	memories: MemoryEntryData[];
	retrievalTimeMs: number;
	wasRetrieved: boolean;
}

export interface DecideContext {
	history?: ChatHistoryEntry[];
	memories?: MemoryContext;
}

export interface RulesOutput {
	requiresCheck: boolean;
	type: CheckType;
	skill?: string;
	dc?: number;
	opposedBy?: string;
	rationale?: string;
	alternative?: "auto_success" | "auto_fail" | "success_with_cost";
}

export interface CharacterOutput {
	modifiers: {
		ability: number;
		skill: number;
		equipment: number;
		temporary: number;
		total: number;
	};
}

export interface CheckOutcome {
	success: boolean;
	critical: boolean; // roll == 1 или 20
	margin: number; // modified - dc
}

export interface NarrativeOutput {
	text: string;
}

export interface GMOutput {
	text: string;
	summary?: string;
}

/**
 * Memory Agent Types
 */

export type EntityType = "location" | "npc" | "item" | "faction" | "event";

export interface ExtractedEntity {
	name: string;
	type: EntityType;
	context?: string;
}

export interface MemoryAgentDecision {
	shouldRetrieve: boolean;
	reason: string;
	queries: string[];
	entities: ExtractedEntity[];
	confidence: number;
}

export interface MemoryAgentOptions {
	timeoutMs?: number;
	model?: string;
	sessionId?: number;
}

/**
 * World Knowledge Updater Types
 */

export interface WorldEntityData {
	type: EntityType;
	name: string;
	properties: Record<string, unknown>;
	isNew: boolean;
}

export interface WorldRelationshipData {
	sourceEntityName: string;
	targetEntityName: string;
	relationshipType: string;
	properties?: Record<string, unknown>;
}

export interface WorldKnowledgeUpdate {
	entities: WorldEntityData[];
	relationships: WorldRelationshipData[];
	extractionTimeMs: number;
}

/**
 * Player Knowledge Updater Types
 */

export interface PlayerKnowledgeData {
	entityName: string;
	entityType: EntityType;
	awarenessLevel: "unaware" | "heard_of" | "met" | "familiar";
	newFacts: Array<{
		property: string;
		value: unknown;
		source: string;
		confidence?: string;
	}>;
}

export interface PlayerKnowledgeUpdate {
	updates: PlayerKnowledgeData[];
	extractionTimeMs: number;
}
