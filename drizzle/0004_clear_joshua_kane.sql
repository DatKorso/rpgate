CREATE TABLE "WorldEntity" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"type" varchar(20) NOT NULL,
	"name" varchar(200) NOT NULL,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	UNIQUE ("session_id", "type", "name"),
	CHECK ("type" IN ('location', 'npc', 'item', 'faction', 'event'))
);
--> statement-breakpoint
CREATE TABLE "WorldRelationship" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"source_entity_id" integer NOT NULL,
	"target_entity_id" integer NOT NULL,
	"relationship_type" varchar(50) NOT NULL,
	"properties" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CHECK ("source_entity_id" != "target_entity_id")
);
--> statement-breakpoint
CREATE INDEX "world_entity_session_type_idx" ON "WorldEntity" ("session_id", "type");--> statement-breakpoint
CREATE INDEX "world_entity_name_idx" ON "WorldEntity" ("name");--> statement-breakpoint
CREATE INDEX "world_entity_properties_idx" ON "WorldEntity" USING gin ("properties");--> statement-breakpoint
CREATE INDEX "world_rel_source_idx" ON "WorldRelationship" ("source_entity_id");--> statement-breakpoint
CREATE INDEX "world_rel_target_idx" ON "WorldRelationship" ("target_entity_id");--> statement-breakpoint
CREATE INDEX "world_rel_type_idx" ON "WorldRelationship" ("relationship_type");--> statement-breakpoint
ALTER TABLE "WorldEntity" ADD CONSTRAINT "WorldEntity_session_id_Session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."Session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "WorldRelationship" ADD CONSTRAINT "WorldRelationship_source_entity_id_WorldEntity_id_fk" FOREIGN KEY ("source_entity_id") REFERENCES "public"."WorldEntity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "WorldRelationship" ADD CONSTRAINT "WorldRelationship_target_entity_id_WorldEntity_id_fk" FOREIGN KEY ("target_entity_id") REFERENCES "public"."WorldEntity"("id") ON DELETE cascade ON UPDATE no action;