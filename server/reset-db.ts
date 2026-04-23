import { existsSync, rmSync } from "node:fs";
import { DEFAULT_DB_PATH, ThesisDb } from "./db";

const databaseFiles = [DEFAULT_DB_PATH, `${DEFAULT_DB_PATH}-shm`, `${DEFAULT_DB_PATH}-wal`];

for (const filePath of databaseFiles) {
	if (existsSync(filePath)) {
		rmSync(filePath, { force: true });
	}
}

const db = new ThesisDb();
db.close();

console.log(`Reset experiment database at ${DEFAULT_DB_PATH}.`);
console.log("Fresh database created with default model and defense seeds.");
console.log("Run `bun run seed:scenarios` if you also want to repopulate seeded scenarios.");
