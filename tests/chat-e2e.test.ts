import { db } from "@/db";
import { characters, messages, sessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("E2E: /api/chat SSE Flow", () => {
	let testSessionId: number;
	let testExternalId: string;

	beforeEach(async () => {
		// Create test session
		testExternalId = `e2e-test-${Date.now()}`;
		const [session] = await db
			.insert(sessions)
			.values({
				externalId: testExternalId,
				locale: "ru",
				setting: "medieval_fantasy",
			})
			.returning();
		testSessionId = session.id;

		// Create test character
		await db.insert(characters).values({
			sessionId: testSessionId,
			className: "Воин",
			bio: "Храбрый воин",
			strMod: 2,
			dexMod: 1,
			conMod: 1,
			intMod: 0,
			wisMod: 0,
			chaMod: -1,
			skills: { Athletics: 2, Perception: 1 },
		});
	});

	afterEach(async () => {
		// Cleanup
		if (testSessionId) {
			await db.delete(sessions).where(eq(sessions.id, testSessionId));
		}
	});

	it("should stream complete SSE response for simple action", async () => {
		const response = await fetch("http://localhost:3000/api/chat", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				sessionId: testExternalId,
				content: "Я осматриваюсь вокруг",
			}),
		});

		expect(response.ok).toBe(true);
		expect(response.headers.get("content-type")).toContain(
			"text/event-stream",
		);

		const reader = response.body?.getReader();
		expect(reader).toBeDefined();
		if (!reader) return;

		const decoder = new TextDecoder();
		let buffer = "";
		const events: Array<{ type: string; payload: unknown }> = [];

		// Read all SSE events
		while (true) {
			const { value, done } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split("\n\n");
			buffer = lines.pop() || "";

			for (const chunk of lines) {
				const dataLine = chunk.split("\n").find((l) => l.startsWith("data: "));
				if (!dataLine) continue;

				try {
					const event = JSON.parse(dataLine.slice(6));
					events.push(event);
				} catch {
					// Ignore parse errors
				}
			}
		}

		// Verify event sequence
		const eventTypes = events.map((e) => e.type);
		expect(eventTypes).toContain("rules");
		expect(eventTypes).toContain("final");

		// Check rules event
		const rulesEvent = events.find((e) => e.type === "rules");
		expect(rulesEvent).toBeDefined();
		expect(rulesEvent?.payload).toHaveProperty("requiresCheck");

		// Check final event
		const finalEvent = events.find((e) => e.type === "final");
		expect(finalEvent).toBeDefined();
		expect(finalEvent?.payload).toHaveProperty("text");

		// Verify messages were persisted
		const persistedMessages = await db
			.select()
			.from(messages)
			.where(eq(messages.sessionId, testSessionId));

		expect(persistedMessages.length).toBeGreaterThanOrEqual(2);
		expect(persistedMessages.some((m) => m.role === "player")).toBe(true);
		expect(persistedMessages.some((m) => m.role === "gm")).toBe(true);
	}, 30000); // 30s timeout for LLM

	it("should handle action requiring skill check", async () => {
		const response = await fetch("http://localhost:3000/api/chat", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				sessionId: testExternalId,
				content: "Я пытаюсь взобраться на высокую стену",
			}),
		});

		expect(response.ok).toBe(true);

		const reader = response.body?.getReader();
		if (!reader) return;

		const decoder = new TextDecoder();
		let buffer = "";
		const events: Array<{ type: string; payload: unknown }> = [];

		while (true) {
			const { value, done } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split("\n\n");
			buffer = lines.pop() || "";

			for (const chunk of lines) {
				const dataLine = chunk.split("\n").find((l) => l.startsWith("data: "));
				if (!dataLine) continue;

				try {
					const event = JSON.parse(dataLine.slice(6));
					events.push(event);
				} catch {
					// Ignore
				}
			}
		}

		const eventTypes = events.map((e) => e.type);

		// Should have rules decision
		expect(eventTypes).toContain("rules");
		const rulesEvent = events.find((e) => e.type === "rules");
		expect(rulesEvent?.payload).toHaveProperty("requiresCheck");

		// If check is required, should have roll and outcome
		if ((rulesEvent?.payload as { requiresCheck: boolean }).requiresCheck) {
			expect(eventTypes).toContain("roll");
			expect(eventTypes).toContain("outcome");

			const rollEvent = events.find((e) => e.type === "roll");
			expect(rollEvent?.payload).toHaveProperty("roll");
			expect(rollEvent?.payload).toHaveProperty("modified");
			expect(rollEvent?.payload).toHaveProperty("category");

			const outcomeEvent = events.find((e) => e.type === "outcome");
			expect(outcomeEvent?.payload).toHaveProperty("success");
			expect(outcomeEvent?.payload).toHaveProperty("critical");
			expect(outcomeEvent?.payload).toHaveProperty("margin");
		}

		// Should have narrative
		const narrativeEvents = events.filter((e) => e.type === "narrative");
		expect(narrativeEvents.length).toBeGreaterThan(0);

		// Should have final
		expect(eventTypes).toContain("final");
	}, 30000);

	it("should handle invalid input gracefully", async () => {
		const response = await fetch("http://localhost:3000/api/chat", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				sessionId: testExternalId,
				content: "", // Empty content
			}),
		});

		expect(response.ok).toBe(false);
		expect(response.status).toBe(400);
	});

	it("should respect rate limiting", async () => {
		// Make 21 rapid requests (limit is 20/min)
		const requests = Array.from({ length: 21 }, (_, i) =>
			fetch("http://localhost:3000/api/chat", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					sessionId: testExternalId,
					content: `Test message ${i}`,
				}),
			}),
		);

		const responses = await Promise.all(requests);
		const statuses = responses.map((r) => r.status);

		// At least one should be rate limited
		expect(statuses).toContain(429);

		// Check rate limit headers on 429 response
		const rateLimited = responses.find((r) => r.status === 429);
		if (rateLimited) {
			expect(rateLimited.headers.get("X-RateLimit-Limit")).toBeDefined();
			expect(rateLimited.headers.get("X-RateLimit-Remaining")).toBeDefined();
			expect(rateLimited.headers.get("X-RateLimit-Reset")).toBeDefined();
		}
	}, 30000);

	it("should create session if not exists", async () => {
		const newExternalId = `e2e-new-${Date.now()}`;

		const response = await fetch("http://localhost:3000/api/chat", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				sessionId: newExternalId,
				content: "Привет, мир!",
			}),
		});

		expect(response.ok).toBe(true);

		// Verify session was created
		const newSession = await db
			.select()
			.from(sessions)
			.where(eq(sessions.externalId, newExternalId))
			.limit(1);

		expect(newSession).toHaveLength(1);
		expect(newSession[0].externalId).toBe(newExternalId);

		// Cleanup
		await db.delete(sessions).where(eq(sessions.id, newSession[0].id));
	}, 30000);
});
