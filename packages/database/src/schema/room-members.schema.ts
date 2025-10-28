import { pgTable, uuid, timestamp, primaryKey, varchar } from "drizzle-orm/pg-core";
import { users } from "./users.schema";
import { rooms } from "./rooms.schema";

/**
 * Room members (many-to-many relationship) table schema
 */
export const roomMembers = pgTable(
  "room_members",
  {
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    // New fields for room management features
    role: varchar("role", { length: 20 }).notNull().default("member"), // 'owner' or 'member'
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.roomId, table.userId] }),
  }),
);

export type RoomMember = typeof roomMembers.$inferSelect;
export type NewRoomMember = typeof roomMembers.$inferInsert;
