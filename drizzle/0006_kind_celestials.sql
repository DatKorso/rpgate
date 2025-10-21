ALTER TABLE "Character" ADD COLUMN "appearance" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "Character" ADD COLUMN "background" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "Character" ADD COLUMN "ability_priority" varchar(20);