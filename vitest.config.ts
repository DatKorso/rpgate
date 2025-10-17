import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), "");

	return {
		test: {
			globals: true,
			environment: "node",
			include: ["**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
			exclude: ["node_modules", ".next", "drizzle"],
			env: {
				DATABASE_URL: env.DATABASE_URL || "",
				OPENROUTER_API_KEY: env.OPENROUTER_API_KEY || "",
				AITUNNEL_API_KEY: env.AITUNNEL_API_KEY || "test_aitunnel_key",
			},
		},
		resolve: {
			alias: {
				"@": path.resolve(__dirname, "."),
			},
		},
	};
});
