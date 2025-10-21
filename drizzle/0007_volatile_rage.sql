CREATE INDEX "idx_characters_appearance" ON "Character" USING gin ("appearance");--> statement-breakpoint
CREATE INDEX "idx_characters_background" ON "Character" USING gin ("background");--> statement-breakpoint
CREATE INDEX "idx_characters_ability_priority" ON "Character" USING btree ("ability_priority");