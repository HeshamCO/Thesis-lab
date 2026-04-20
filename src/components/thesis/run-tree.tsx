import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RunDetail } from "#/lib/thesis/schemas";
import type { ArtifactPanelPayload } from "./artifact-panel";
import { AttemptFlow } from "./attempt-flow";
import { AttemptTimeline } from "./attempt-timeline";

type Props = {
	detail: RunDetail;
	onSelect: (payload: ArtifactPanelPayload) => void;
};

export function RunTree({ detail, onSelect }: Props) {
	const attempts = useMemo(
		() => [...detail.attempts].sort((a, b) => a.attemptNumber - b.attemptNumber),
		[detail.attempts],
	);
	const [pinnedId, setPinnedId] = useState<string | null>(null);
	const focusedId =
		pinnedId && attempts.some((attempt) => attempt.id === pinnedId) ? pinnedId : (attempts.at(-1)?.id ?? null);

	const focusAttempt = useCallback((attemptId: string) => {
		setPinnedId(attemptId);
		requestAnimationFrame(() => {
			document.getElementById(attemptCardId(attemptId))?.scrollIntoView({
				behavior: "smooth",
				block: "start",
			});
		});
	}, []);

	const attemptsRef = useRef(attempts);
	const focusedIdRef = useRef(focusedId);
	attemptsRef.current = attempts;
	focusedIdRef.current = focusedId;

	useEffect(() => {
		const handler = (event: KeyboardEvent) => {
			if (event.metaKey || event.ctrlKey || event.altKey) {
				return;
			}
			const target = event.target as HTMLElement | null;
			if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
				return;
			}
			const list = attemptsRef.current;
			if (list.length === 0) {
				return;
			}
			const currentIndex = focusedIdRef.current ? list.findIndex((attempt) => attempt.id === focusedIdRef.current) : -1;
			if (event.key === "j" || event.key === "ArrowDown") {
				event.preventDefault();
				const next = list[Math.min(list.length - 1, currentIndex + 1)];
				if (next) {
					focusAttempt(next.id);
				}
			} else if (event.key === "k" || event.key === "ArrowUp") {
				event.preventDefault();
				const previous = list[Math.max(0, currentIndex - 1)];
				if (previous) {
					focusAttempt(previous.id);
				}
			}
		};
		window.addEventListener("keydown", handler);
		return () => {
			window.removeEventListener("keydown", handler);
		};
	}, [focusAttempt]);

	if (attempts.length === 0) {
		return (
			<div className="rounded-md bg-muted/30 p-6 text-sm text-muted-foreground">
				No attempts yet. The flow fills in as the engine completes each phase.
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			<AttemptTimeline detail={detail} focusedAttemptId={focusedId} onFocus={focusAttempt} />
			<div className="flex flex-col gap-4">
				{attempts.map((attempt) => (
					<AttemptFlow
						key={attempt.id}
						id={attemptCardId(attempt.id)}
						detail={detail}
						attempt={attempt}
						onSelect={onSelect}
						isFocused={attempt.id === focusedId}
					/>
				))}
			</div>
		</div>
	);
}

function attemptCardId(attemptId: string) {
	return `attempt-card-${attemptId}`;
}
