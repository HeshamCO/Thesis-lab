import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { io } from "socket.io-client";
import type { AttemptRecord, RunDetail, RunLogRecord, StepResultRecord } from "#/lib/thesis/schemas";
import { queryKeys } from "#/lib/thesis/query";

export function useRunSocket(runId: string) {
	const queryClient = useQueryClient();

	useEffect(() => {
		const socket = io("/", {
			path: "/socket.io",
		});
		socket.emit("join-run", runId);

		socket.on("run:update", (run: RunDetail) => {
			queryClient.setQueryData(queryKeys.run(runId), run);
			queryClient.invalidateQueries({ queryKey: queryKeys.runs });
			queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
		});

		socket.on("attempt:update", (attempt: AttemptRecord) => {
			queryClient.setQueryData<RunDetail>(queryKeys.run(runId), (current) => {
				if (!current) {
					return current;
				}
				const attempts = current.attempts.some((item) => item.id === attempt.id)
					? current.attempts.map((item) => (item.id === attempt.id ? attempt : item))
					: [...current.attempts, attempt];
				return { ...current, attempts };
			});
		});

		socket.on("step:update", (step: StepResultRecord) => {
			queryClient.setQueryData<RunDetail>(queryKeys.run(runId), (current) => {
				if (!current) {
					return current;
				}
				const stepResults = current.stepResults.some((item) => item.id === step.id)
					? current.stepResults.map((item) => (item.id === step.id ? step : item))
					: [...current.stepResults, step];
				return { ...current, stepResults };
			});
		});

		socket.on("log:append", (log: RunLogRecord) => {
			queryClient.setQueryData<RunDetail>(queryKeys.run(runId), (current) => {
				if (!current || current.logs.some((item) => item.id === log.id)) {
					return current;
				}
				return { ...current, logs: [...current.logs, log] };
			});
		});

		socket.on("run:complete", () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.run(runId) });
			queryClient.invalidateQueries({ queryKey: queryKeys.runs });
			queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
		});

		return () => {
			socket.emit("leave-run", runId);
			socket.disconnect();
		};
	}, [queryClient, runId]);
}
