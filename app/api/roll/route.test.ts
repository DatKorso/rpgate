import { describe, expect, it } from "vitest";
import { POST } from "./route";

describe("POST /api/roll", () => {
	it("should return valid dice result with explicit modifiers", async () => {
		const request = new Request("http://localhost/api/roll", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				sessionId: "test-session",
				modifiers: {
					ability: 2,
					skill: 1,
					equipment: 0,
					temporary: 0,
				},
			}),
		});

		const response = await POST(request);
		const data = await response.json();

		expect(data.roll).toBeGreaterThanOrEqual(1);
		expect(data.roll).toBeLessThanOrEqual(20);
		expect(data.modified).toBe(data.roll + 3); // 2 + 1 + 0 + 0
		expect(data.category).toMatch(/CRIT_FAIL|FAIL|SUCCESS|CRIT_SUCCESS/);
		expect(data.modifierBreakdown).toBeDefined();
		expect(data.modifierBreakdown.total).toBe(3);
	});

	it("should handle zero modifiers", async () => {
		const request = new Request("http://localhost/api/roll", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				sessionId: "test-session",
				modifiers: {
					ability: 0,
					skill: 0,
					equipment: 0,
					temporary: 0,
				},
			}),
		});

		const response = await POST(request);
		const data = await response.json();

		expect(data.roll).toBe(data.modified);
		expect(data.modifierBreakdown.total).toBe(0);
	});

	it("should handle negative modifiers", async () => {
		const request = new Request("http://localhost/api/roll", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				sessionId: "test-session",
				modifiers: {
					ability: -2,
					skill: 1,
					equipment: 0,
					temporary: -1,
				},
			}),
		});

		const response = await POST(request);
		const data = await response.json();

		expect(data.modified).toBe(data.roll - 2); // -2 + 1 + 0 - 1 = -2
		expect(data.modifierBreakdown.total).toBe(-2);
	});

	it("should return 400 for invalid payload", async () => {
		const request = new Request("http://localhost/api/roll", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				modifiers: {
					ability: "invalid", // Should be number
				},
			}),
		});

		const response = await POST(request);
		expect(response.status).toBe(400);

		const data = await response.json();
		expect(data.error).toBe("Invalid payload");
	});

	it("should handle empty body gracefully", async () => {
		const request = new Request("http://localhost/api/roll", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ sessionId: "test-session" }),
		});

		const response = await POST(request);
		const data = await response.json();

		// Should use default zero modifiers
		expect(data.roll).toBeGreaterThanOrEqual(1);
		expect(data.roll).toBeLessThanOrEqual(20);
		expect(data.modifierBreakdown.total).toBe(0);
	});
});
