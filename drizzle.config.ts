import { defineConfig } from "drizzle-kit";

export default defineConfig({
	schema: "./server/schema.ts",
	out: "./server/migrations",
	dialect: "sqlite",
	dbCredentials: {
		url: "./data/thesis-lab.sqlite",
	},
});
