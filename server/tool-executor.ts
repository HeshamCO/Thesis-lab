import type { ToolDefinitionInput, ToolExecutor } from "../src/lib/thesis/schemas";

export type ToolExecutionResult = {
	status: "ok" | "error";
	result: unknown;
	durationMs: number;
	error: string;
};

/**
 * Run a tool. Mock executors return their literal `returnValue` deterministically.
 * HTTP executors fetch the configured URL with a timeout and surface network / non-2xx errors
 * back as `{ status: "error", result: { error: ... } }` so the model can see them as a tool message.
 */
export async function executeTool(
	tool: ToolDefinitionInput,
	args: Record<string, unknown>,
): Promise<ToolExecutionResult> {
	const startedAt = Date.now();
	try {
		if (tool.executor.kind === "mock") {
			return {
				status: "ok",
				result: tool.executor.returnValue,
				durationMs: Date.now() - startedAt,
				error: "",
			};
		}
		return await executeHttp(tool.executor, args, startedAt);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Tool executor crashed.";
		return {
			status: "error",
			result: { error: message },
			durationMs: Date.now() - startedAt,
			error: message,
		};
	}
}

async function executeHttp(
	executor: Extract<ToolExecutor, { kind: "http" }>,
	args: Record<string, unknown>,
	startedAt: number,
): Promise<ToolExecutionResult> {
	const headers: Record<string, string> = {
		"content-type": "application/json",
		...resolveHeaders(executor.headers ?? {}),
	};
	const url = executor.method === "GET" ? appendQueryString(executor.url, args) : executor.url;
	const init: RequestInit = {
		method: executor.method,
		headers,
		signal: AbortSignal.timeout(executor.timeoutMs),
	};
	if (executor.method !== "GET") {
		init.body = JSON.stringify(args);
	}

	let response: Response;
	try {
		response = await fetch(url, init);
	} catch (error) {
		const message =
			error instanceof Error
				? error.name === "TimeoutError"
					? `Tool HTTP request timed out after ${executor.timeoutMs}ms.`
					: error.message
				: "Tool HTTP request failed.";
		return {
			status: "error",
			result: { error: message },
			durationMs: Date.now() - startedAt,
			error: message,
		};
	}

	const text = await response.text();
	const result = parseMaybeJson(text);
	if (!response.ok) {
		const message = `Tool HTTP responded ${response.status} ${response.statusText}.`;
		return {
			status: "error",
			result: { error: message, body: result },
			durationMs: Date.now() - startedAt,
			error: message,
		};
	}
	return {
		status: "ok",
		result,
		durationMs: Date.now() - startedAt,
		error: "",
	};
}

/**
 * Resolve `${env:VAR_NAME}` placeholders in HTTP header values. Missing env vars produce
 * an empty header value rather than throwing — keeps the mock dev loop running.
 */
function resolveHeaders(input: Record<string, string>): Record<string, string> {
	const out: Record<string, string> = {};
	for (const [key, value] of Object.entries(input)) {
		out[key] = value.replace(/\$\{env:([A-Z_][A-Z0-9_]*)\}/gi, (_, envName: string) => {
			return process.env[envName] ?? "";
		});
	}
	return out;
}

function appendQueryString(url: string, args: Record<string, unknown>) {
	const usp = new URLSearchParams();
	for (const [key, value] of Object.entries(args)) {
		usp.set(key, typeof value === "string" ? value : JSON.stringify(value));
	}
	const query = usp.toString();
	if (!query) {
		return url;
	}
	return `${url}${url.includes("?") ? "&" : "?"}${query}`;
}

function parseMaybeJson(text: string): unknown {
	if (!text) {
		return null;
	}
	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
}
