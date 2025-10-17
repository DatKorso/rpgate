import type { MemoryEntryData } from "@/db/schema";

// Re-export MemoryEntryData for convenience
export type { MemoryEntryData };

export type CheckType = "none" | "skill" | "contest" | "save";

export interface PlayerProfile {
	name?: string;
	className?: string; // свободная строка
	bio?: string;
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
