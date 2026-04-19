import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import "./env";
import {
	defenseConfigInputSchema,
	modelConfigInputSchema,
	scenarioInputSchema,
	startRunInputSchema,
} from "../src/lib/thesis/schemas";
import { thesisDb } from "./db";
import { ExperimentEngine } from "./engine";
import { testModelConnection } from "./model-health";

const PORT = Number(process.env.API_PORT ?? 3334);
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
	cors: {
		origin: ["http://localhost:3333", "http://127.0.0.1:3333"],
	},
});
const engine = new ExperimentEngine(thesisDb, io);

thesisDb.recoverInterruptedRuns();

app.use(cors());
app.use(express.json({ limit: "5mb" }));

io.on("connection", (socket) => {
	socket.on("join-run", (runId: string) => {
		socket.join(`run:${runId}`);
	});
	socket.on("leave-run", (runId: string) => {
		socket.leave(`run:${runId}`);
	});
});

app.get("/api/health", (_request, response) => {
	response.json({ ok: true });
});

app.get("/api/dashboard", (_request, response) => {
	const runs = thesisDb.listRuns();
	response.json({
		activeRun: runs.find((run) =>
			["queued", "running", "pausing", "paused"].includes(run.status),
		),
		recentRuns: runs.slice(0, 8),
		scenarioCount: thesisDb.listScenarios().length,
		modelCount: thesisDb.listModels().length,
		defenseCount: thesisDb.listDefenses().length,
		runCount: runs.length,
	});
});

app.get("/api/scenarios", (_request, response) => {
	response.json(thesisDb.listScenarios());
});

app.post("/api/scenarios", (request, response) => {
	const input = scenarioInputSchema.parse(request.body);
	response.status(201).json(thesisDb.createScenario(input));
});

app.get("/api/scenarios/:id", (request, response) => {
	const scenario = thesisDb.getScenario(request.params.id);
	if (!scenario) {
		response.status(404).json({ error: "Scenario not found." });
		return;
	}
	response.json(scenario);
});

app.put("/api/scenarios/:id", (request, response) => {
	const input = scenarioInputSchema.parse(request.body);
	response.json(thesisDb.updateScenario(request.params.id, input));
});

app.delete("/api/scenarios/:id", (request, response) => {
	thesisDb.deleteScenario(request.params.id);
	response.status(204).end();
});

app.get("/api/models", (_request, response) => {
	response.json(thesisDb.listModels());
});

app.post("/api/models", (request, response) => {
	const input = modelConfigInputSchema.parse(request.body);
	response.status(201).json(thesisDb.createModel(input));
});

app.put("/api/models/:id", (request, response) => {
	const input = modelConfigInputSchema.parse(request.body);
	response.json(thesisDb.updateModel(request.params.id, input));
});

app.delete("/api/models/:id", (request, response) => {
	thesisDb.deleteModel(request.params.id);
	response.status(204).end();
});

app.post("/api/models/:id/test", async (request, response) => {
	const model = thesisDb.getModel(request.params.id);
	if (!model) {
		response.status(404).json({ error: "Model not found." });
		return;
	}

	const result = await testModelConnection(model);
	response.json(result);
});

app.get("/api/defenses", (_request, response) => {
	response.json(thesisDb.listDefenses());
});

app.post("/api/defenses", (request, response) => {
	const input = defenseConfigInputSchema.parse(request.body);
	response.status(201).json(thesisDb.createDefense(input));
});

app.put("/api/defenses/:id", (request, response) => {
	const input = defenseConfigInputSchema.parse(request.body);
	response.json(thesisDb.updateDefense(request.params.id, input));
});

app.delete("/api/defenses/:id", (request, response) => {
	thesisDb.deleteDefense(request.params.id);
	response.status(204).end();
});

app.get("/api/runs", (_request, response) => {
	response.json(thesisDb.listRuns());
});

app.post("/api/runs", (request, response) => {
	const input = startRunInputSchema.parse(request.body);
	const scenario = thesisDb.getScenario(input.scenarioId);
	const defense = thesisDb.getDefense(input.defenseConfigId);
	const attackerModel = thesisDb.getModel(input.attackerModelId);
	const benignModel = thesisDb.getModel(input.benignModelId);

	if (!scenario || !defense || !attackerModel || !benignModel) {
		response.status(400).json({ error: "Selected scenario, model, or defense was not found." });
		return;
	}

	const run = thesisDb.createRun({
		scenario,
		defense,
		attackerModel,
		benignModel,
		maxAttempts: input.maxAttempts,
		retrievalSettings: input.retrievalSettings,
	});
	engine.start(run.id);
	response.status(201).json(run);
});

app.get("/api/runs/:id", (request, response) => {
	response.json(thesisDb.getRun(request.params.id));
});

app.post("/api/runs/:id/pause", (request, response) => {
	thesisDb.requestPause(request.params.id);
	response.json(thesisDb.getRun(request.params.id));
});

app.post("/api/runs/:id/resume", (request, response) => {
	engine.resume(request.params.id);
	response.json(thesisDb.getRun(request.params.id));
});

app.get("/api/runs/:id/export.json", (request, response) => {
	response.setHeader("Content-Type", "application/json");
	response.setHeader(
		"Content-Disposition",
		`attachment; filename="run-${request.params.id}.json"`,
	);
	response.send(JSON.stringify(thesisDb.getRun(request.params.id), null, 2));
});

app.get("/api/runs/:id/export.csv", (request, response) => {
	const run = thesisDb.getRun(request.params.id);
	const rows = [
		[
			"runId",
			"attemptNumber",
			"attemptSuccess",
			"utilityScore",
			"stepOrder",
			"stepName",
			"stepPassed",
			"stepScore",
			"evaluatorOutput",
		],
	];
	for (const attempt of run.attempts) {
		const attemptSteps = run.stepResults.filter(
			(result) => result.attemptId === attempt.id,
		);
		if (attemptSteps.length === 0) {
			rows.push([
				run.id,
				String(attempt.attemptNumber),
				String(attempt.success),
				String(attempt.utilityScore),
				"",
				"",
				"",
				"",
				"",
			]);
		}
		for (const step of attemptSteps) {
			rows.push([
				run.id,
				String(attempt.attemptNumber),
				String(attempt.success),
				String(attempt.utilityScore),
				String(step.orderIndex),
				step.stepSnapshot.name,
				String(step.passed),
				String(step.score),
				step.evaluatorOutput,
			]);
		}
	}
	response.setHeader("Content-Type", "text/csv");
	response.setHeader(
		"Content-Disposition",
		`attachment; filename="run-${run.id}.csv"`,
	);
	response.send(rows.map((row) => row.map(csvCell).join(",")).join("\n"));
});

app.use(
	(
		error: unknown,
		_request: express.Request,
		response: express.Response,
		_next: express.NextFunction,
	) => {
		const message = error instanceof Error ? error.message : "Unknown API error.";
		response.status(400).json({ error: message });
	},
);

httpServer.listen(PORT, () => {
	console.log(`Thesis API listening on http://localhost:${PORT}`);
});

function csvCell(value: string) {
	if (!/[",\n]/.test(value)) {
		return value;
	}
	return `"${value.replaceAll('"', '""')}"`;
}
