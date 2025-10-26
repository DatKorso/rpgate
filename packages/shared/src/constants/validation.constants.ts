/**
 * Validation constraints
 */

export const VALIDATION = {
  USERNAME: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 32,
  },
  PASSWORD: {
    MIN_LENGTH: 8,
    MAX_LENGTH: 128,
  },
  ROOM_NAME: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 100,
  },
  ROOM_DESCRIPTION: {
    MAX_LENGTH: 500,
  },
  MESSAGE_CONTENT: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 4000,
  },
} as const;
