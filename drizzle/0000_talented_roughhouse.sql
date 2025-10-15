CREATE TABLE "Message" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"role" varchar(16) NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Roll" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"value" integer NOT NULL,
	"modified" integer NOT NULL,
	"category" varchar(16) NOT NULL,
	"modifiers_json" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Session" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"title" varchar(200) DEFAULT '',
	"locale" varchar(10) DEFAULT 'ru',
	"setting" varchar(50) DEFAULT 'medieval_fantasy'
);
--> statement-breakpoint
CREATE TABLE "Turn" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"player_message_id" integer NOT NULL,
	"gm_message_id" integer,
	"meta" text DEFAULT '',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Message" ADD CONSTRAINT "Message_session_id_Session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."Session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Roll" ADD CONSTRAINT "Roll_session_id_Session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."Session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Turn" ADD CONSTRAINT "Turn_session_id_Session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."Session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Turn" ADD CONSTRAINT "Turn_player_message_id_Message_id_fk" FOREIGN KEY ("player_message_id") REFERENCES "public"."Message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Turn" ADD CONSTRAINT "Turn_gm_message_id_Message_id_fk" FOREIGN KEY ("gm_message_id") REFERENCES "public"."Message"("id") ON DELETE set null ON UPDATE no action;