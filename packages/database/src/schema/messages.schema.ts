import { pgTable, uuid, text, timestamp, vector, index } from "drizzle-orm/pg-core";
import { users } from "./users.schema";
import { rooms } from "./rooms.schema";

/**
 * Messages table schema with vector embeddings for AI features
 */
export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomId: uuid("room_id")
    .notNull()
    .references(() => rooms.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  /** Vector embedding for semantic search and AI context */
  embedding: vector("embedding", { dimensions: 1536 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  /** Index for vector similarity search */
  embeddingIndex: index("messages_embedding_idx").using("hnsw", table.embedding.op("vector_cosine_ops")),
}));

export type Message = typeof messages.$inferSelect;
