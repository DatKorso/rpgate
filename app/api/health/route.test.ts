import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/health", () => {
	it("should return ok status", async () => {
		const response = await GET();
		const data = await response.json();

		expect(data.ok).toBe(true);
		expect(data.ts).toBeTypeOf("number");
		expect(data.ts).toBeGreaterThan(0);
	});

	it("should return current timestamp", async () => {
		const before = Date.now();
		const response = await GET();
		const data = await response.json();
		const after = Date.now();

		expect(data.ts).toBeGreaterThanOrEqual(before);
		expect(data.ts).toBeLessThanOrEqual(after);
	});
});
