DROP INDEX "messages_embedding_idx";--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "max_members" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "invite_token" varchar(255);--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "invite_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "settings" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "last_activity_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "room_members" ADD COLUMN "role" varchar(20) DEFAULT 'member' NOT NULL;--> statement-breakpoint
ALTER TABLE "room_members" ADD COLUMN "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" DROP COLUMN "embedding";