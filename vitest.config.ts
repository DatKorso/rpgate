import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		include: ["**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
		exclude: ["node_modules", ".next", "drizzle"],
		env: {
			DATABASE_URL: "postgresql://test:test@localhost:5432/rpgate_test",
			OPENROUTER_API_KEY: "test_key_optional",
		},
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "."),
		},
	},
});
