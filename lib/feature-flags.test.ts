import { beforeEach, describe, expect, it } from "vitest";
import {
	clearSessionFeatureFlags,
	getAllSessionOverrides,
	getFeatureFlags,
	getGlobalFeatureFlags,
	isDiceChecksEnabled,
	isMemoryAgentEnabled,
	isPlayerKnowledgeEnabled,
	isWorldKnowledgeEnabled,
	setGlobalFeatureFlags,
	setSessionFeatureFlags,
} from "./feature-flags";

describe("Feature Flags", () => {
	beforeEach(() => {
		// Reset to defaults before each test
		setGlobalFeatureFlags({
			enableMemoryAgent: true,
			enableWorldKnowledge: true,
			enablePlayerKnowledge: true,
			enableDiceChecks: true,
		});
		// Clear all session overrides
		const overrides = getAllSessionOverrides();
		for (const override of overrides) {
			clearSessionFeatureFlags(override.sessionId);
		}
	});

	describe("Global Feature Flags", () => {
		it("should return default flags", () => {
			const flags = getGlobalFeatureFlags();
			expect(flags.enableMemoryAgent).toBe(true);
			expect(flags.enableWorldKnowledge).toBe(true);
			expect(flags.enablePlayerKnowledge).toBe(true);
			expect(flags.enableDiceChecks).toBe(true);
		});

		it("should update global flags", () => {
			setGlobalFeatureFlags({ enableMemoryAgent: false });
			const flags = getGlobalFeatureFlags();
			expect(flags.enableMemoryAgent).toBe(false);
			expect(flags.enableWorldKnowledge).toBe(true);
			expect(flags.enablePlayerKnowledge).toBe(true);
		});

		it("should partially update global flags", () => {
			setGlobalFeatureFlags({
				enableMemoryAgent: false,
				enableWorldKnowledge: false,
			});
			const flags = getGlobalFeatureFlags();
			expect(flags.enableMemoryAgent).toBe(false);
			expect(flags.enableWorldKnowledge).toBe(false);
			expect(flags.enablePlayerKnowledge).toBe(true);
		});
	});

	describe("Session Feature Flags", () => {
		it("should return global defaults for session without overrides", () => {
			const flags = getFeatureFlags(1);
			expect(flags.enableMemoryAgent).toBe(true);
			expect(flags.enableWorldKnowledge).toBe(true);
			expect(flags.enablePlayerKnowledge).toBe(true);
		});

		it("should set session-specific overrides", () => {
			setSessionFeatureFlags(1, { enableMemoryAgent: false });
			const flags = getFeatureFlags(1);
			expect(flags.enableMemoryAgent).toBe(false);
			expect(flags.enableWorldKnowledge).toBe(true);
			expect(flags.enablePlayerKnowledge).toBe(true);
		});

		it("should merge session overrides with global defaults", () => {
			setGlobalFeatureFlags({ enableWorldKnowledge: false });
			setSessionFeatureFlags(1, { enableMemoryAgent: false });

			const flags = getFeatureFlags(1);
			expect(flags.enableMemoryAgent).toBe(false); // session override
			expect(flags.enableWorldKnowledge).toBe(false); // global default
			expect(flags.enablePlayerKnowledge).toBe(true); // global default
		});

		it("should clear session overrides", () => {
			setSessionFeatureFlags(1, { enableMemoryAgent: false });
			clearSessionFeatureFlags(1);

			const flags = getFeatureFlags(1);
			expect(flags.enableMemoryAgent).toBe(true); // back to global default
		});

		it("should track multiple session overrides", () => {
			setSessionFeatureFlags(1, { enableMemoryAgent: false });
			setSessionFeatureFlags(2, { enableWorldKnowledge: false });
			setSessionFeatureFlags(3, { enablePlayerKnowledge: false });

			const overrides = getAllSessionOverrides();
			expect(overrides).toHaveLength(3);
			expect(overrides.find((o) => o.sessionId === 1)?.flags).toEqual({
				enableMemoryAgent: false,
			});
			expect(overrides.find((o) => o.sessionId === 2)?.flags).toEqual({
				enableWorldKnowledge: false,
			});
			expect(overrides.find((o) => o.sessionId === 3)?.flags).toEqual({
				enablePlayerKnowledge: false,
			});
		});
	});

	describe("Helper Functions", () => {
		it("should check if Memory Agent is enabled", () => {
			expect(isMemoryAgentEnabled(1)).toBe(true);

			setSessionFeatureFlags(1, { enableMemoryAgent: false });
			expect(isMemoryAgentEnabled(1)).toBe(false);
		});

		it("should check if World Knowledge is enabled", () => {
			expect(isWorldKnowledgeEnabled(1)).toBe(true);

			setSessionFeatureFlags(1, { enableWorldKnowledge: false });
			expect(isWorldKnowledgeEnabled(1)).toBe(false);
		});

		it("should check if Player Knowledge is enabled", () => {
			expect(isPlayerKnowledgeEnabled(1)).toBe(true);

			setSessionFeatureFlags(1, { enablePlayerKnowledge: false });
			expect(isPlayerKnowledgeEnabled(1)).toBe(false);
		});

		it("should check if Dice Checks are enabled", () => {
			expect(isDiceChecksEnabled(1)).toBe(true);

			setSessionFeatureFlags(1, { enableDiceChecks: false });
			expect(isDiceChecksEnabled(1)).toBe(false);
		});
	});

	describe("Backward Compatibility", () => {
		it("should allow disabling all features for a session", () => {
			setSessionFeatureFlags(1, {
				enableMemoryAgent: false,
				enableWorldKnowledge: false,
				enablePlayerKnowledge: false,
				enableDiceChecks: false,
			});

			expect(isMemoryAgentEnabled(1)).toBe(false);
			expect(isWorldKnowledgeEnabled(1)).toBe(false);
			expect(isPlayerKnowledgeEnabled(1)).toBe(false);
			expect(isDiceChecksEnabled(1)).toBe(false);
		});

		it("should allow gradual rollout by enabling features one at a time", () => {
			// Start with all disabled
			setGlobalFeatureFlags({
				enableMemoryAgent: false,
				enableWorldKnowledge: false,
				enablePlayerKnowledge: false,
				enableDiceChecks: false,
			});

			// Enable Memory Agent for session 1
			setSessionFeatureFlags(1, { enableMemoryAgent: true });
			expect(isMemoryAgentEnabled(1)).toBe(true);
			expect(isWorldKnowledgeEnabled(1)).toBe(false);
			expect(isPlayerKnowledgeEnabled(1)).toBe(false);

			// Enable World Knowledge for session 1
			setSessionFeatureFlags(1, {
				enableMemoryAgent: true,
				enableWorldKnowledge: true,
			});
			expect(isMemoryAgentEnabled(1)).toBe(true);
			expect(isWorldKnowledgeEnabled(1)).toBe(true);
			expect(isPlayerKnowledgeEnabled(1)).toBe(false);

			// Enable all features for session 1
			setSessionFeatureFlags(1, {
				enableMemoryAgent: true,
				enableWorldKnowledge: true,
				enablePlayerKnowledge: true,
			});
			expect(isMemoryAgentEnabled(1)).toBe(true);
			expect(isWorldKnowledgeEnabled(1)).toBe(true);
			expect(isPlayerKnowledgeEnabled(1)).toBe(true);
		});
	});
});
