-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "MemoryEntry" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"summary" text NOT NULL,
	"full_text" text NOT NULL,
	"embedding" vector(1024),
	"type" varchar(20) NOT NULL,
	"entities" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"turn_id" integer,
	"turn_number" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "MemoryEntry" ADD CONSTRAINT "MemoryEntry_session_id_Session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."Session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "MemoryEntry" ADD CONSTRAINT "MemoryEntry_turn_id_Turn_id_fk" FOREIGN KEY ("turn_id") REFERENCES "public"."Turn"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- HNSW index for fast similarity search
CREATE INDEX "memory_embedding_idx" ON "MemoryEntry" USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
--> statement-breakpoint
-- Index for session queries
CREATE INDEX "memory_session_idx" ON "MemoryEntry" (session_id, turn_number DESC);