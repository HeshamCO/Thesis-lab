import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import {
	ACTIVE_RUN_STATUSES,
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
		activeRun: runs.find((run) => ACTIVE_RUN_STATUSES.includes(run.status)),
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
	console.log("input ==> ",input);
	
	const scenario = thesisDb.getScenario(input.scenarioId);
	const defense = thesisDb.getDefense(input.defenseConfigId);
	const attackerModel = thesisDb.getModel(input.attackerModelId);
	const benignModel = thesisDb.getModel(input.benignModelId);
	const judgeModel = input.judgeModelId
		? thesisDb.getModel(input.judgeModelId)
		: null;

	if (!scenario || !defense || !attackerModel || !benignModel) {
		response.status(400).json({ error: "Selected scenario, model, or defense was not found." });
		return;
	}

	if (input.judgeModelId && !judgeModel) {
		response.status(400).json({ error: "Selected judge model was not found." });
		return;
	}

	const run = thesisDb.createRun({
		scenario,
		defense,
		attackerModel,
		benignModel,
		judgeModel,
		maxAttempts: input.maxAttempts,
		retrievalSettings: input.retrievalSettings,
		attackerPromptVersion: input.attackerPromptVersion,
		benignPromptVersion: input.benignPromptVersion,
		judgePromptVersion: input.judgePromptVersion,
		benignTaskHasSafetyClause: input.benignTaskHasSafetyClause,
		labelRetrievedDocuments: input.labelRetrievedDocuments,
	});
	engine.start(run.id);
	response.status(201).json(run);
});

app.get("/api/runs/:id", (request, response) => {
	response.json(thesisDb.getRun(request.params.id));
});

app.get("/api/runs/:id/attempts/:attemptId", (request, response) => {
	const run = thesisDb.getRun(request.params.id);
	const attempt = run.attempts.find((item) => item.id === request.params.attemptId);
	if (!attempt) {
		response.status(404).json({ error: "Attempt not found." });
		return;
	}
	const stepResults = run.stepResults.filter(
		(result) => result.attemptId === attempt.id,
	);
	const artifacts = run.attackerArtifacts.filter(
		(artifact) => artifact.attemptId === attempt.id,
	);
	const toolCalls = run.toolCalls.filter((call) => call.attemptId === attempt.id);
	const logs = run.logs.filter(
		(log) => (log.payload as { attemptNumber?: number })?.attemptNumber === attempt.attemptNumber,
	);
	response.json({ attempt, stepResults, artifacts, toolCalls, logs });
});

app.get(
	"/api/runs/:id/attempts/:attemptId/artifacts/:artifactId",
	(request, response) => {
		const artifact = thesisDb.getAttackerArtifact(request.params.artifactId);
		if (
			!artifact ||
			artifact.runId !== request.params.id ||
			artifact.attemptId !== request.params.attemptId
		) {
			response.status(404).json({ error: "Artifact not found." });
			return;
		}
		response.json(artifact);
	},
);

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
			"scenarioName",
			"defenseName",
			"defenseMode",
			"attemptNumber",
			"attemptStatus",
			"attemptSuccess",
			"utilityScore",
			"attackDurationMs",
			"benignDurationMs",
			"totalDurationMs",
			"defenseFilteredCount",
			"toolCallsCount",
			"rawAttackerParseOk",
			"stepOrder",
			"stepName",
			"stepRequired",
			"stepPassed",
			"stepScore",
			"evaluatorType",
			"evaluatorOutput",
			"rawJudgeParseOk",
		],
	];
	for (const attempt of run.attempts) {
		const attemptSteps = run.stepResults.filter(
			(result) => result.attemptId === attempt.id,
		);
		const baseRow = [
			run.id,
			run.scenarioName,
			run.defenseName,
			run.defenseSnapshot.mode,
			String(attempt.attemptNumber),
			attempt.status,
			String(attempt.success),
			String(attempt.utilityScore),
			String(attempt.attackDurationMs),
			String(attempt.benignDurationMs),
			String(attempt.totalDurationMs),
			String(attempt.defenseFilteredCount),
			String(attempt.toolCallsCount),
			String(attempt.rawAttackerParseOk),
		];
		if (attemptSteps.length === 0) {
			rows.push([...baseRow, "", "", "", "", "", "", "", ""]);
		}
		for (const step of attemptSteps) {
			rows.push([
				...baseRow,
				String(step.orderIndex),
				step.stepSnapshot.name,
				String(step.stepSnapshot.required),
				String(step.passed),
				String(step.score),
				step.stepSnapshot.evaluatorType,
				step.evaluatorOutput,
				String(step.rawJudgeParseOk),
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

app.get("/api/runs/:id/export.tool-calls.csv", (request, response) => {
	const run = thesisDb.getRun(request.params.id);
	const attemptByIdNumber = new Map(run.attempts.map((attempt) => [attempt.id, attempt.attemptNumber]));
	const rows = [
		[
			"runId",
			"scenarioName",
			"defenseName",
			"defenseMode",
			"attemptNumber",
			"turn",
			"toolName",
			"status",
			"durationMs",
			"argumentsJson",
			"resultJson",
			"error",
			"createdAt",
		],
	];
	for (const call of run.toolCalls) {
		rows.push([
			run.id,
			run.scenarioName,
			run.defenseName,
			run.defenseSnapshot.mode,
			String(attemptByIdNumber.get(call.attemptId) ?? ""),
			String(call.turn),
			call.toolName,
			call.status,
			String(call.durationMs),
			JSON.stringify(call.arguments),
			JSON.stringify(call.result ?? null),
			call.error,
			call.createdAt,
		]);
	}
	response.setHeader("Content-Type", "text/csv");
	response.setHeader(
		"Content-Disposition",
		`attachment; filename="run-${run.id}-tool-calls.csv"`,
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
