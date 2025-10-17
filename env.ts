import { z } from "zod";

const envSchema = z.object({
	DATABASE_URL: z.string().url(),
	OPENROUTER_API_KEY: z.string().optional(),
	AITUNNEL_API_KEY: z
		.string()
		.min(1, "AITUNNEL_API_KEY is required for memory system"),
});

export const env = envSchema.parse({
	DATABASE_URL: process.env.DATABASE_URL,
	OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
	AITUNNEL_API_KEY: process.env.AITUNNEL_API_KEY,
});
