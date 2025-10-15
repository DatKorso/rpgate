ALTER TABLE "Session" ADD COLUMN "external_id" varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE "Session" ADD COLUMN "player_class" varchar(100) DEFAULT '';--> statement-breakpoint
ALTER TABLE "Session" ADD COLUMN "player_bio" text DEFAULT '';