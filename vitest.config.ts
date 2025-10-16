import path from "node:path";
import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";

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
			},
		},
		resolve: {
			alias: {
				"@": path.resolve(__dirname, "."),
			},
		},
	};
});
