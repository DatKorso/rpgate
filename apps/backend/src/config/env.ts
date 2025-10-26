import { z } from "zod";
import { config } from "dotenv";
import { resolve } from "path";

// Load .env file from project root
config({ path: resolve(process.cwd(), "../../.env") });

/**
 * Environment configuration schema
 */
const envSchema = z.object({
  // App
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),

  // Server
  BACKEND_PORT: z.coerce.number().default(3001),
  BACKEND_HOST: z.string().default("0.0.0.0"),
  SESSION_SECRET: z.string().min(32),

  // Database
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_URL: z.string().url(),
  REDIS_PASSWORD: z.string().optional(),

  // AI
  OPENROUTER_API_KEY: z.string().min(1),
  AI_MODEL: z.string().default("anthropic/claude-3.5-sonnet"),
  AI_MAX_TOKENS: z.coerce.number().default(4096),
  AI_RATE_LIMIT_PER_USER: z.coerce.number().default(10),
  AI_RATE_LIMIT_WINDOW: z.coerce.number().default(60000),

  // CORS
  CORS_ORIGIN: z.string().default("http://localhost:3000"),

  // Security
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW: z.coerce.number().default(60000),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Parse and validate environment variables
 */
export function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("❌ Invalid environment variables:");
    console.error(result.error.flatten().fieldErrors);
    throw new Error("Invalid environment variables");
  }

  return result.data;
}

export const env = loadEnv();
