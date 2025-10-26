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
  try {
    const result = envSchema.safeParse(process.env);

    if (!result.success) {
      console.error("❌ Environment variable validation failed:");
      
      // Format validation errors for better readability
      const errors = result.error.flatten().fieldErrors;
      Object.entries(errors).forEach(([field, messages]) => {
        console.error(`  ${field}: ${messages?.join(", ")}`);
      });

      // Show current values for debugging (excluding sensitive data)
      console.error("\n📋 Current environment values:");
      const safeEnvVars = {
        NODE_ENV: process.env.NODE_ENV,
        LOG_LEVEL: process.env.LOG_LEVEL,
        BACKEND_PORT: process.env.BACKEND_PORT,
        BACKEND_HOST: process.env.BACKEND_HOST,
        CORS_ORIGIN: process.env.CORS_ORIGIN,
        RATE_LIMIT_MAX: process.env.RATE_LIMIT_MAX,
        RATE_LIMIT_WINDOW: process.env.RATE_LIMIT_WINDOW,
        AI_MODEL: process.env.AI_MODEL,
        AI_MAX_TOKENS: process.env.AI_MAX_TOKENS,
        // Sensitive values are masked
        SESSION_SECRET: process.env.SESSION_SECRET ? "[SET]" : "[NOT SET]",
        DATABASE_URL: process.env.DATABASE_URL ? "[SET]" : "[NOT SET]",
        REDIS_URL: process.env.REDIS_URL ? "[SET]" : "[NOT SET]",
        OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ? "[SET]" : "[NOT SET]",
      };
      
      Object.entries(safeEnvVars).forEach(([key, value]) => {
        console.error(`  ${key}: ${value}`);
      });

      throw new Error("Invalid environment variables - check configuration above");
    }

    // Log successful environment loading (excluding sensitive data)
    console.log("✅ Environment variables loaded successfully");
    console.log(`   Environment: ${result.data.NODE_ENV}`);
    console.log(`   Log Level: ${result.data.LOG_LEVEL}`);
    console.log(`   Server: ${result.data.BACKEND_HOST}:${result.data.BACKEND_PORT}`);

    return result.data;
  } catch (error) {
    console.error("💥 Failed to load environment configuration:", error);
    throw error;
  }
}

export const env = loadEnv();
