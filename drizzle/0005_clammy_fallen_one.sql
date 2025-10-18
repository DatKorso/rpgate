CREATE TABLE "PlayerKnowledge" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"entity_id" integer NOT NULL,
	"awareness_level" varchar(20) NOT NULL,
	"known_facts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "PlayerKnowledge_session_id_entity_id_unique" UNIQUE("session_id", "entity_id"),
	CONSTRAINT "PlayerKnowledge_awareness_level_check" CHECK ("awareness_level" IN ('unaware', 'heard_of', 'met', 'familiar'))
);
--> statement-breakpoint
ALTER TABLE "PlayerKnowledge" ADD CONSTRAINT "PlayerKnowledge_entity_id_WorldEntity_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."WorldEntity"("id") ON DELETE cascade ON UPDATE no action;