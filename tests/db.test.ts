import { db } from "@/db";
import { characters, messages, sessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("Database Integration", () => {
	let testSessionId: number;

	beforeEach(async () => {
		// Create test session
		const [session] = await db
			.insert(sessions)
			.values({
				externalId: `test-${Date.now()}`,
				locale: "ru",
				setting: "medieval_fantasy",
			})
			.returning();
		testSessionId = session.id;
	});

	afterEach(async () => {
		// Cleanup: cascade delete will handle related records
		if (testSessionId) {
			await db.delete(sessions).where(eq(sessions.id, testSessionId));
		}
	});

	it("should create and retrieve session", async () => {
		const result = await db
			.select()
			.from(sessions)
			.where(eq(sessions.id, testSessionId))
			.limit(1);

		expect(result).toHaveLength(1);
		expect(result[0].locale).toBe("ru");
		expect(result[0].setting).toBe("medieval_fantasy");
	});

	it("should create messages linked to session", async () => {
		await db.insert(messages).values([
			{
				sessionId: testSessionId,
				role: "player",
				content: "Я осматриваюсь",
			},
			{
				sessionId: testSessionId,
				role: "gm",
				content: "Ты видишь тёмный лес",
			},
		]);

		const result = await db
			.select()
			.from(messages)
			.where(eq(messages.sessionId, testSessionId));

		expect(result).toHaveLength(2);
		expect(result[0].role).toBe("player");
		expect(result[1].role).toBe("gm");
	});

	it("should create character with default modifiers", async () => {
		const [char] = await db
			.insert(characters)
			.values({
				sessionId: testSessionId,
				className: "Воин",
				bio: "Храбрый воин",
			})
			.returning();

		expect(char.className).toBe("Воин");
		expect(char.strMod).toBe(0);
		expect(char.skills).toEqual({});
	});

	it("should cascade delete messages when session is deleted", async () => {
		await db.insert(messages).values({
			sessionId: testSessionId,
			role: "player",
			content: "Test message",
		});

		await db.delete(sessions).where(eq(sessions.id, testSessionId));

		const result = await db
			.select()
			.from(messages)
			.where(eq(messages.sessionId, testSessionId));

		expect(result).toHaveLength(0);
		testSessionId = 0; // Prevent double cleanup
	});
});
