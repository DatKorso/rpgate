import { describe, expect, it, beforeEach } from "vitest";
import { isDiceChecksEnabled, setSessionFeatureFlags, clearSessionFeatureFlags } from "@/lib/feature-flags";

describe("Dice Checks Feature Flag", () => {
	beforeEach(() => {
		// Clear any session overrides before each test
		clearSessionFeatureFlags(1);
	});

	it("should be enabled by default", () => {
		expect(isDiceChecksEnabled(1)).toBe(true);
	});

	it("should allow disabling dice checks for a session", () => {
		setSessionFeatureFlags(1, { enableDiceChecks: false });
		expect(isDiceChecksEnabled(1)).toBe(false);
	});

	it("should allow re-enabling dice checks for a session", () => {
		// First disable
		setSessionFeatureFlags(1, { enableDiceChecks: false });
		expect(isDiceChecksEnabled(1)).toBe(false);

		// Then re-enable
		setSessionFeatureFlags(1, { enableDiceChecks: true });
		expect(isDiceChecksEnabled(1)).toBe(true);
	});

	it("should isolate settings between sessions", () => {
		setSessionFeatureFlags(1, { enableDiceChecks: false });
		setSessionFeatureFlags(2, { enableDiceChecks: true });

		expect(isDiceChecksEnabled(1)).toBe(false);
		expect(isDiceChecksEnabled(2)).toBe(true);
		expect(isDiceChecksEnabled(3)).toBe(true); // default
	});
});