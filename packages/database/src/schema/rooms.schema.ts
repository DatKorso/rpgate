import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { users } from "./users.schema";

/**
 * Rooms (chat rooms) table schema
 */
export const rooms = pgTable("rooms", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  isPrivate: boolean("is_private").notNull().default(false),
  // New fields for room management features
  inviteToken: varchar("invite_token", { length: 255 }),
  inviteExpiresAt: timestamp("invite_expires_at", { withTimezone: true }),
  settings: jsonb("settings").notNull().default({}),
  lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Room = typeof rooms.$inferSelect;
export type NewRoom = typeof rooms.$inferInsert;
