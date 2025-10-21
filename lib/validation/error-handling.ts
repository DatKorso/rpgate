/**
 * Error handling utilities for enhanced character creation
 * Requirements: 1.5, 2.5
 */

export interface CharacterCreationError {
	code: string;
	message: string;
	field?: string;
	details?: string[];
}

export interface CharacterCreationResult<T> {
	success: boolean;
	data?: T;
	errors?: CharacterCreationError[];
	fallbackUsed?: boolean;
}

/**
 * Error codes for character creation failures
 */
export const ERROR_CODES = {
	VALIDATION_FAILED: "VALIDATION_FAILED",
	APPEARANCE_INVALID: "APPEARANCE_INVALID",
	BACKGROUND_INVALID: "BACKGROUND_INVALID",
	ABILITY_PRIORITY_INVALID: "ABILITY_PRIORITY_INVALID",
	DATABASE_ERROR: "DATABASE_ERROR",
	UNEXPECTED_ERROR: "UNEXPECTED_ERROR",
} as const;

/**
 * Creates a standardized error object
 */
export function createCharacterError(
	code: keyof typeof ERROR_CODES,
	message: string,
	field?: string,
	details?: string[],
): CharacterCreationError {
	return {
		code: ERROR_CODES[code],
		message,
		field,
		details,
	};
}

/**
 * Logs character creation errors for monitoring
 */
export function logCharacterError(
	error: CharacterCreationError,
	context: {
		sessionId?: string;
		userId?: string;
		timestamp?: Date;
		requestData?: unknown;
	},
): void {
	const logEntry = {
		level: "error",
		message: "Character creation validation failed",
		error: {
			code: error.code,
			message: error.message,
			field: error.field,
			details: error.details,
		},
		context: {
			...context,
			timestamp: context.timestamp || new Date(),
		},
	};

	// In production, this would integrate with your logging service
	// For now, we'll use console.error with structured logging
	console.error(JSON.stringify(logEntry, null, 2));
}

/**
 * Creates a user-friendly error message from validation errors
 */
export function formatValidationErrors(errors: string[]): string {
	if (errors.length === 0) {
		return "Произошла неизвестная ошибка валидации";
	}

	if (errors.length === 1) {
		return errors[0];
	}

	return `Обнаружены следующие ошибки:\n${errors.map((err) => `• ${err}`).join("\n")}`;
}

/**
 * Determines if an error should trigger fallback to basic character creation
 */
export function shouldUseFallback(error: CharacterCreationError): boolean {
	// Use fallback for validation errors but not for database errors
	const fallbackCodes = [
		ERROR_CODES.VALIDATION_FAILED,
		ERROR_CODES.APPEARANCE_INVALID,
		ERROR_CODES.BACKGROUND_INVALID,
		ERROR_CODES.ABILITY_PRIORITY_INVALID,
	];
	return fallbackCodes.includes(error.code as any);
}

/**
 * Creates a fallback character profile with only basic data
 */
export function createFallbackProfile(originalData: Record<string, unknown>): {
	className?: string;
	bio?: string;
	name?: string;
} {
	return {
		className:
			typeof originalData.className === "string"
				? originalData.className
				: undefined,
		bio: typeof originalData.bio === "string" ? originalData.bio : undefined,
		name: typeof originalData.name === "string" ? originalData.name : undefined,
	};
}

/**
 * Handles character creation with graceful fallback
 */
export async function handleCharacterCreationWithFallback<T, R>(
	validationResult: { success: boolean; errors?: string[] },
	originalData: T,
	onSuccess: (data: T) => Promise<R>,
	onFallback: (fallbackData: {
		className?: string;
		bio?: string;
		name?: string;
	}) => Promise<R>,
): Promise<CharacterCreationResult<R>> {
	try {
		if (validationResult.success) {
			const result = await onSuccess(originalData);
			return {
				success: true,
				data: result,
				fallbackUsed: false,
			};
		}

		// Validation failed - create error and determine if fallback should be used
		const error = createCharacterError(
			"VALIDATION_FAILED",
			formatValidationErrors(validationResult.errors || []),
			undefined,
			validationResult.errors,
		);

		// Log the error for monitoring
		logCharacterError(error, {
			requestData: originalData,
			timestamp: new Date(),
		});

		if (shouldUseFallback(error)) {
			// Use fallback to basic character creation
			const fallbackData = createFallbackProfile(
				originalData as Record<string, unknown>,
			);

			try {
				const fallbackResult = await onFallback(fallbackData);
				return {
					success: true,
					data: fallbackResult,
					errors: [error],
					fallbackUsed: true,
				};
			} catch (fallbackError) {
				// Even fallback failed
				const fallbackErr = createCharacterError(
					"UNEXPECTED_ERROR",
					"Не удалось создать персонажа даже с базовыми данными",
					undefined,
					[String(fallbackError)],
				);

				logCharacterError(fallbackErr, {
					requestData: fallbackData,
					timestamp: new Date(),
				});

				return {
					success: false,
					errors: [error, fallbackErr],
					fallbackUsed: true,
				};
			}
		}

		// Don't use fallback for this type of error
		return {
			success: false,
			errors: [error],
			fallbackUsed: false,
		};
	} catch (unexpectedError) {
		const error = createCharacterError(
			"UNEXPECTED_ERROR",
			"Произошла неожиданная ошибка при создании персонажа",
			undefined,
			[String(unexpectedError)],
		);

		logCharacterError(error, {
			requestData: originalData,
			timestamp: new Date(),
		});

		return {
			success: false,
			errors: [error],
			fallbackUsed: false,
		};
	}
}

/**
 * Wraps database operations with error handling
 */
export async function withDatabaseErrorHandling<T>(
	operation: () => Promise<T>,
	context: string,
): Promise<CharacterCreationResult<T>> {
	try {
		const result = await operation();
		return {
			success: true,
			data: result,
		};
	} catch (error) {
		const dbError = createCharacterError(
			"DATABASE_ERROR",
			`Ошибка базы данных при ${context}`,
			undefined,
			[String(error)],
		);

		logCharacterError(dbError, {
			timestamp: new Date(),
		});

		return {
			success: false,
			errors: [dbError],
		};
	}
}
