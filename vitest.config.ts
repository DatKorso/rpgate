import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		include: ["**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
		exclude: ["node_modules", ".next", "drizzle"],
		env: {
			DATABASE_URL: "postgres://korso:147258369@95.217.104.104:41282/rpgate",
			OPENROUTER_API_KEY: "test_key_optional",
		},
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "."),
		},
	},
});
