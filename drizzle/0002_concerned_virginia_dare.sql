CREATE TABLE "Character" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"class_name" varchar(100) DEFAULT '',
	"bio" text DEFAULT '',
	"str_mod" integer DEFAULT 0 NOT NULL,
	"dex_mod" integer DEFAULT 0 NOT NULL,
	"con_mod" integer DEFAULT 0 NOT NULL,
	"int_mod" integer DEFAULT 0 NOT NULL,
	"wis_mod" integer DEFAULT 0 NOT NULL,
	"cha_mod" integer DEFAULT 0 NOT NULL,
	"skills" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"equipment" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"temporary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Character" ADD CONSTRAINT "Character_session_id_Session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."Session"("id") ON DELETE cascade ON UPDATE no action;