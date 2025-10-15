import { sql } from "drizzle-orm";
import {
	integer,
	jsonb,
	pgTable,
	serial,
	text,
	timestamp,
	varchar,
} from "drizzle-orm/pg-core";

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
