import { describe, expect, it } from "vitest";
import { heuristicDecide } from "./heuristics";
import type { PlayerInput } from "./protocol";

describe("heuristicDecide", () => {
	describe("trivial actions without stakes", () => {
		it("should auto-succeed for simple look action", () => {
			const input: PlayerInput = { content: "Я оглядеться вокруг" };
			const result = heuristicDecide(input);

			expect(result).not.toBeNull();
			expect(result?.requiresCheck).toBe(false);
			expect(result?.type).toBe("none");
			expect(result?.alternative).toBe("auto_success");
		});

		it("should auto-succeed for picking up item", () => {
			const input: PlayerInput = { content: "Поднять меч с земли" };
			const result = heuristicDecide(input);

			expect(result).not.toBeNull();
			expect(result?.requiresCheck).toBe(false);
		});

		it("should auto-succeed for basic movement", () => {
			const input: PlayerInput = { content: "Подойти к двери" };
			const result = heuristicDecide(input);

			expect(result).not.toBeNull();
			expect(result?.requiresCheck).toBe(false);
		});

		it("should auto-succeed for social actions", () => {
			const input: PlayerInput = { content: "Улыбнуться и кивнуть" };
			const result = heuristicDecide(input);

			expect(result).not.toBeNull();
			expect(result?.requiresCheck).toBe(false);
		});
	});

	describe("actions with stakes", () => {
		it("should defer to LLM when danger is present", () => {
			const input: PlayerInput = {
				content: "Осмотреться в темной комнате с ловушками",
			};
			const result = heuristicDecide(input);

			expect(result).toBeNull(); // Defer to LLM
		});

		it("should defer to LLM when guards are mentioned", () => {
			const input: PlayerInput = { content: "Подойти к стражнику" };
			const result = heuristicDecide(input);

			expect(result).toBeNull();
		});

		it("should defer to LLM for dangerous actions", () => {
			const input: PlayerInput = { content: "Взобраться на высокий обрыв" };
			const result = heuristicDecide(input);

			expect(result).toBeNull();
		});

		it("should defer to LLM for stealthy actions", () => {
			const input: PlayerInput = { content: "Тихо пройти мимо врага" };
			const result = heuristicDecide(input);

			expect(result).toBeNull();
		});
	});

	describe("edge cases", () => {
		it("should handle empty input", () => {
			const input: PlayerInput = { content: "" };
			const result = heuristicDecide(input);

			expect(result).toBeNull();
		});

		it("should handle case insensitivity", () => {
			const input: PlayerInput = { content: "ОСМОТРЕТЬСЯ" };
			const result = heuristicDecide(input);

			expect(result).not.toBeNull();
			expect(result?.requiresCheck).toBe(false);
		});

		it("should normalize ё to е", () => {
			const input: PlayerInput = { content: "Посмотрёть вокруг" };
			const result = heuristicDecide(input);

			expect(result).not.toBeNull();
		});
	});
});
