import type { AppearanceData, BackgroundData } from "@/lib/agents/protocol";
import { sql } from "drizzle-orm";
import {
	customType,
	index,
	integer,
	jsonb,
	pgTable,
	serial,
	text,
	timestamp,
	varchar,
} from "drizzle-orm/pg-core";

// Custom type for pgvector
const vector = customType<{
	data: number[];
	driverData: string;
	config: { dimensions: number };
}>({
	dataType(config) {
		return `vector(${config?.dimensions ?? 1024})`;
	},
	toDriver(value: number[]): string {
		return JSON.stringify(value);
	},
	fromDriver(value: string): number[] {
		return JSON.parse(value);
	},
});

export const sessions = pgTable("Session", {
	id: serial("id").primaryKey(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	title: varchar("title", { length: 200 }).default(""),
	locale: varchar("locale", { length: 10 }).default("ru"),
	setting: varchar("setting", { length: 50 }).default("medieval_fantasy"),
	externalId: varchar("external_id", { length: 64 }).notNull(),
	playerClass: varchar("player_class", { length: 100 }).default(""),
	playerBio: text("player_bio").default(""),
});

export const messages = pgTable("Message", {
	id: serial("id").primaryKey(),
	sessionId: integer("session_id")
		.notNull()
		.references(() => sessions.id, { onDelete: "cascade" }),
	role: varchar("role", { length: 16 }).notNull(), // 'player' | 'gm'
	content: text("content").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const turns = pgTable("Turn", {
	id: serial("id").primaryKey(),
	sessionId: integer("session_id")
		.notNull()
		.references(() => sessions.id, { onDelete: "cascade" }),
	playerMessageId: integer("player_message_id")
		.notNull()
		.references(() => messages.id, { onDelete: "cascade" }),
	gmMessageId: integer("gm_message_id").references(() => messages.id, {
		onDelete: "set null",
	}),
	meta: text("meta").default(""),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const rolls = pgTable("Roll", {
	id: serial("id").primaryKey(),
	sessionId: integer("session_id")
		.notNull()
		.references(() => sessions.id, { onDelete: "cascade" }),
	value: integer("value").notNull(),
	modified: integer("modified").notNull(),
	category: varchar("category", { length: 16 }).notNull(), // 'CRIT_FAIL' | 'FAIL' | 'SUCCESS' | 'CRIT_SUCCESS'
	modifiersJson: text("modifiers_json").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const characters = pgTable(
	"Character",
	{
		id: serial("id").primaryKey(),
		sessionId: integer("session_id")
			.notNull()
			.references(() => sessions.id, { onDelete: "cascade" }),
		className: varchar("class_name", { length: 100 }).default(""),
		bio: text("bio").default(""),
		// Ability modifiers (not raw scores) for simplicity in MVP
		strMod: integer("str_mod").default(0).notNull(),
		dexMod: integer("dex_mod").default(0).notNull(),
		conMod: integer("con_mod").default(0).notNull(),
		intMod: integer("int_mod").default(0).notNull(),
		wisMod: integer("wis_mod").default(0).notNull(),
		chaMod: integer("cha_mod").default(0).notNull(),
		skills: jsonb("skills")
			.$type<Record<string, number>>()
			.default(sql`'{}'::jsonb`)
			.notNull(),
		equipment: jsonb("equipment")
			.$type<Record<string, number>>()
			.default(sql`'{}'::jsonb`)
			.notNull(),
		temporary: jsonb("temporary")
			.$type<Record<string, number>>()
			.default(sql`'{}'::jsonb`)
			.notNull(),
		// Enhanced character data
		appearance: jsonb("appearance")
			.$type<AppearanceData>()
			.default(sql`'{}'::jsonb`)
			.notNull(),
		background: jsonb("background")
			.$type<BackgroundData>()
			.default(sql`'{}'::jsonb`)
			.notNull(),
		abilityPriority: varchar("ability_priority", { length: 20 }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => ({
		// GIN indexes for JSONB columns for efficient querying
		appearanceIdx: index("idx_characters_appearance").using(
			"gin",
			table.appearance,
		),
		backgroundIdx: index("idx_characters_background").using(
			"gin",
			table.background,
		),
		// B-tree index for ability_priority column
		abilityPriorityIdx: index("idx_characters_ability_priority").on(
			table.abilityPriority,
		),
	}),
);

export const memoryEntries = pgTable("MemoryEntry", {
	id: serial("id").primaryKey(),
	sessionId: integer("session_id")
		.notNull()
		.references(() => sessions.id, { onDelete: "cascade" }),

	// Content
	summary: text("summary").notNull(),
	fullText: text("full_text").notNull(),

	// Vector (pgvector extension required)
	embedding: vector("embedding", { dimensions: 1024 }),

	// Metadata
	type: varchar("type", { length: 20 }).notNull(),

	entities: jsonb("entities")
		.$type<{
			locations?: string[];
			npcs?: string[];
			items?: string[];
		}>()
		.default(sql`'{}'::jsonb`)
		.notNull(),

	// References
	turnId: integer("turn_id").references(() => turns.id, {
		onDelete: "set null",
	}),
	turnNumber: integer("turn_number").notNull(),

	createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const worldEntities = pgTable(
	"WorldEntity",
	{
		id: serial("id").primaryKey(),
		sessionId: integer("session_id")
			.notNull()
			.references(() => sessions.id, { onDelete: "cascade" }),
		type: varchar("type", { length: 20 }).notNull(),
		name: varchar("name", { length: 200 }).notNull(),
		properties: jsonb("properties")
			.$type<Record<string, unknown>>()
			.default(sql`'{}'::jsonb`)
			.notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => ({
		uniqueEntity: sql`UNIQUE (${table.sessionId}, ${table.type}, ${table.name})`,
		typeCheck: sql`CHECK (${table.type} IN ('location', 'npc', 'item', 'faction', 'event'))`,
	}),
);

export const worldRelationships = pgTable(
	"WorldRelationship",
	{
		id: serial("id").primaryKey(),
		sessionId: integer("session_id").notNull(),
		sourceEntityId: integer("source_entity_id")
			.notNull()
			.references(() => worldEntities.id, { onDelete: "cascade" }),
		targetEntityId: integer("target_entity_id")
			.notNull()
			.references(() => worldEntities.id, { onDelete: "cascade" }),
		relationshipType: varchar("relationship_type", { length: 50 }).notNull(),
		properties: jsonb("properties")
			.$type<Record<string, unknown>>()
			.default(sql`'{}'::jsonb`),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => ({
		selfRelationshipCheck: sql`CHECK (${table.sourceEntityId} != ${table.targetEntityId})`,
	}),
);

export const playerKnowledge = pgTable(
	"PlayerKnowledge",
	{
		id: serial("id").primaryKey(),
		sessionId: integer("session_id").notNull(),
		entityId: integer("entity_id")
			.notNull()
			.references(() => worldEntities.id, { onDelete: "cascade" }),
		awarenessLevel: varchar("awareness_level", { length: 20 }).notNull(),
		knownFacts: jsonb("known_facts")
			.$type<KnownFact[]>()
			.default(sql`'[]'::jsonb`)
			.notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => ({
		uniquePlayerKnowledge: sql`UNIQUE (${table.sessionId}, ${table.entityId})`,
		awarenessLevelCheck: sql`CHECK (${table.awarenessLevel} IN ('unaware', 'heard_of', 'met', 'familiar'))`,
	}),
);

// TypeScript types for MemoryEntry
export type MemoryType = "location" | "npc" | "event" | "decision" | "item";

export interface MemoryEntryData {
	id: number;
	summary: string;
	fullText: string;
	type: MemoryType;
	entities: {
		locations?: string[];
		npcs?: string[];
		items?: string[];
	};
	turnNumber: number;
	similarity?: number; // cosine similarity (0-1)
}

// TypeScript types for WorldEntity
export type WorldEntityType = "location" | "npc" | "item" | "faction" | "event";

// TypeScript types for PlayerKnowledge
export type AwarenessLevel = "unaware" | "heard_of" | "met" | "familiar";
export type KnowledgeSource =
	| "arrived"
	| "observation"
	| "heard_from_npc"
	| "read_in_book"
	| "met_personally"
	| "owns"
	| "used";

export interface KnownFact {
	property: string;
	value: unknown;
	learnedAt: number;
	source: KnowledgeSource;
	confidence?: "certain" | "likely" | "rumor";
}
