import type { AppearanceData, BackgroundData } from "@/lib/agents/protocol";
import { z } from "zod";

/**
 * Validation schemas and functions for enhanced character data
 * Requirements: 1.5, 2.5
 */

// Age validation constants
const MIN_AGE = 16;
const MAX_AGE = 80;

// Text field length limits
const MAX_DISTINGUISHING_MARKS_LENGTH = 500;
const MAX_MOTIVATION_LENGTH = 1000;

/**
 * Sanitizes free-text input by trimming whitespace and removing potentially harmful characters
 */
export function sanitizeText(text: string | undefined): string | undefined {
	if (!text) return undefined;

	// Trim whitespace and remove HTML tags and other potentially harmful characters
	const sanitized = text.trim().replace(/[<>]/g, ""); // Remove angle brackets to prevent HTML injection

	return sanitized || undefined;
}

/**
 * Zod schema for appearance data validation
 */
export const appearanceValidationSchema = z.object({
	age: z
		.number()
		.int("Возраст должен быть целым числом")
		.min(MIN_AGE, `Возраст должен быть не менее ${MIN_AGE} лет`)
		.max(MAX_AGE, `Возраст должен быть не более ${MAX_AGE} лет`)
		.optional(),
	height: z
		.enum(["низкий", "средний", "высокий"], {
			errorMap: () => ({
				message: "Рост должен быть одним из: низкий, средний, высокий",
			}),
		})
		.optional(),
	build: z
		.enum(["худощавый", "крепкий", "полный"], {
			errorMap: () => ({
				message:
					"Телосложение должно быть одним из: худощавый, крепкий, полный",
			}),
		})
		.optional(),
	hair: z
		.enum(["темные", "светлые", "рыжие", "седые"], {
			errorMap: () => ({
				message:
					"Цвет волос должен быть одним из: темные, светлые, рыжие, седые",
			}),
		})
		.optional(),
	eyes: z
		.enum(["карие", "голубые", "зеленые", "серые"], {
			errorMap: () => ({
				message:
					"Цвет глаз должен быть одним из: карие, голубые, зеленые, серые",
			}),
		})
		.optional(),
	distinguishingMarks: z
		.string()
		.max(
			MAX_DISTINGUISHING_MARKS_LENGTH,
			`Особые приметы не должны превышать ${MAX_DISTINGUISHING_MARKS_LENGTH} символов`,
		)
		.optional()
		.transform(sanitizeText),
});

/**
 * Zod schema for background data validation
 */
export const backgroundValidationSchema = z.object({
	origin: z
		.enum(["деревня", "город", "дворянство", "кочевники"], {
			errorMap: () => ({
				message:
					"Происхождение должно быть одним из: деревня, город, дворянство, кочевники",
			}),
		})
		.optional(),
	profession: z
		.enum(["ремесленник", "торговец", "солдат", "ученый"], {
			errorMap: () => ({
				message:
					"Профессия должна быть одной из: ремесленник, торговец, солдат, ученый",
			}),
		})
		.optional(),
	motivation: z
		.string()
		.max(
			MAX_MOTIVATION_LENGTH,
			`Мотивация не должна превышать ${MAX_MOTIVATION_LENGTH} символов`,
		)
		.optional()
		.transform(sanitizeText),
});

/**
 * Validation result interface
 */
export interface ValidationResult<T> {
	success: boolean;
	data?: T;
	errors?: string[];
}

/**
 * Validates appearance data with enum and range checks
 * Requirements: 1.5
 */
export function validateAppearanceData(
	data: unknown,
): ValidationResult<AppearanceData> {
	try {
		const result = appearanceValidationSchema.safeParse(data);

		if (result.success) {
			return {
				success: true,
				data: result.data,
			};
		}

		const errors = result.error.errors.map((err) =>
			err.path.length > 0
				? `${err.path.join(".")}: ${err.message}`
				: err.message,
		);

		return {
			success: false,
			errors,
		};
	} catch (error) {
		return {
			success: false,
			errors: ["Неожиданная ошибка при валидации данных внешности"],
		};
	}
}

/**
 * Validates background data with enum validation
 * Requirements: 2.5
 */
export function validateBackgroundData(
	data: unknown,
): ValidationResult<BackgroundData> {
	try {
		const result = backgroundValidationSchema.safeParse(data);

		if (result.success) {
			return {
				success: true,
				data: result.data,
			};
		}

		const errors = result.error.errors.map((err) =>
			err.path.length > 0
				? `${err.path.join(".")}: ${err.message}`
				: err.message,
		);

		return {
			success: false,
			errors,
		};
	} catch (error) {
		return {
			success: false,
			errors: ["Неожиданная ошибка при валидации данных предыстории"],
		};
	}
}

/**
 * Validates ability priority selection
 */
export function validateAbilityPriority(
	priority: unknown,
): ValidationResult<"physical" | "mental" | "social"> {
	const schema = z.enum(["physical", "mental", "social"], {
		errorMap: () => ({
			message:
				"Приоритет способностей должен быть одним из: physical, mental, social",
		}),
	});

	try {
		const result = schema.safeParse(priority);

		if (result.success) {
			return {
				success: true,
				data: result.data,
			};
		}

		return {
			success: false,
			errors: [
				result.error.errors[0]?.message || "Неверный приоритет способностей",
			],
		};
	} catch (error) {
		return {
			success: false,
			errors: ["Неожиданная ошибка при валидации приоритета способностей"],
		};
	}
}

/**
 * Validates complete enhanced character data
 */
export function validateEnhancedCharacterData(data: {
	appearance?: unknown;
	background?: unknown;
	abilityPriority?: unknown;
}): ValidationResult<{
	appearance?: AppearanceData;
	background?: BackgroundData;
	abilityPriority?: "physical" | "mental" | "social";
}> {
	const errors: string[] = [];
	const validatedData: {
		appearance?: AppearanceData;
		background?: BackgroundData;
		abilityPriority?: "physical" | "mental" | "social";
	} = {};

	// Validate appearance if provided
	if (data.appearance !== undefined) {
		const appearanceResult = validateAppearanceData(data.appearance);
		if (appearanceResult.success) {
			validatedData.appearance = appearanceResult.data;
		} else {
			errors.push(...(appearanceResult.errors || []));
		}
	}

	// Validate background if provided
	if (data.background !== undefined) {
		const backgroundResult = validateBackgroundData(data.background);
		if (backgroundResult.success) {
			validatedData.background = backgroundResult.data;
		} else {
			errors.push(...(backgroundResult.errors || []));
		}
	}

	// Validate ability priority if provided
	if (data.abilityPriority !== undefined) {
		const priorityResult = validateAbilityPriority(data.abilityPriority);
		if (priorityResult.success) {
			validatedData.abilityPriority = priorityResult.data;
		} else {
			errors.push(...(priorityResult.errors || []));
		}
	}

	if (errors.length > 0) {
		return {
			success: false,
			errors,
		};
	}

	return {
		success: true,
		data: validatedData,
	};
}
