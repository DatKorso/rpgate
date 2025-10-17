import { sql } from "drizzle-orm";
import {
	customType,
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

export const characters = pgTable("Character", {
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
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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
