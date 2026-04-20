import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "#/components/ui/collapsible";
import { cn } from "#/lib/utils";
import { type TreeNode, type TreeNodeKind, buildAttemptTree, whyAttemptFailed } from "#/lib/thesis/run-tree";
import type { RunDetail } from "#/lib/thesis/schemas";
import type { ArtifactPanelPayload } from "./artifact-panel";

type Props = {
	detail: RunDetail;
	onSelect: (payload: ArtifactPanelPayload) => void;
};

export function RunTree({ detail, onSelect }: Props) {
	const trees = useMemo(
		() =>
			[...detail.attempts]
				.sort((a, b) => a.attemptNumber - b.attemptNumber)
				.map((attempt) => ({
					attempt,
					tree: buildAttemptTree(detail, attempt),
					whyFailed: whyAttemptFailed(detail, attempt),
				})),
		[detail],
	);

	if (trees.length === 0) {
		return (
			<div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
				No attempts yet. The tree fills in as the engine runs each phase.
			</div>
		);
	}

	return (
		<div className="flex flex-col">
			{trees.map(({ tree, whyFailed }, index) => (
				<div key={tree.id} className="relative">
					{index > 0 ? (
						<span aria-hidden className="absolute left-3 top-0 h-4 w-px -translate-y-full bg-border" />
					) : null}
					<TreeBranch node={tree} depth={0} defaultOpen onSelect={onSelect} />
					{whyFailed ? <p className="m-0 mb-3 ml-8 text-xs text-destructive">{whyFailed}</p> : null}
				</div>
			))}
		</div>
	);
}

function TreeBranch({
	node,
	depth,
	defaultOpen,
	onSelect,
}: {
	node: TreeNode;
	depth: number;
	defaultOpen?: boolean;
	onSelect: (payload: ArtifactPanelPayload) => void;
}) {
	const hasChildren = (node.children?.length ?? 0) > 0;
	const hasBody = Boolean(node.body && node.body.trim().length > 0);
	const isExpandable = hasChildren || hasBody;
	const [open, setOpen] = useState(Boolean(defaultOpen));

	const handleSelect = () => {
		if (!hasBody && !node.meta?.artifactId) {
			return;
		}
		onSelect({
			id: node.id,
			title: node.label,
			subtitle: node.hint,
			tags: buildTags(node),
			body: node.body ?? "",
			contentType: node.meta?.kind === "raw_output" ? "json" : "text",
		});
	};

	return (
		<Collapsible open={open} onOpenChange={setOpen}>
			<div
				className="group/tree-row flex items-start gap-2 rounded-md py-1 hover:bg-muted/50"
				style={{ paddingLeft: depth * 16 }}
			>
				<CollapsibleTrigger
					className={cn(
						"mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground",
						!isExpandable && "invisible",
					)}
					aria-label={open ? "Collapse" : "Expand"}
				>
					{open ? <ChevronDownIcon className="size-4" /> : <ChevronRightIcon className="size-4" />}
				</CollapsibleTrigger>
				<button
					type="button"
					onClick={handleSelect}
					className={cn(
						"flex flex-1 flex-col items-start gap-0.5 rounded px-1 py-0.5 text-left text-sm",
						hasBody || node.meta?.artifactId ? "cursor-pointer hover:underline" : "cursor-default",
					)}
				>
					<span className="flex flex-wrap items-center gap-2">
						<NodeStatusGlyph node={node} />
						<span className="font-medium leading-tight">{node.label}</span>
					</span>
					{node.hint ? <span className="text-xs text-muted-foreground">{node.hint}</span> : null}
				</button>
			</div>
			<CollapsibleContent>
				{hasBody ? (
					<pre className="m-0 mb-1 ml-8 max-h-40 overflow-auto rounded-md bg-muted p-2 text-xs whitespace-pre-wrap break-words">
						{node.body}
					</pre>
				) : null}
				{node.children?.map((child) => (
					<TreeBranch
						key={child.id}
						node={child}
						depth={depth + 1}
						defaultOpen={shouldDefaultOpen(child.kind)}
						onSelect={onSelect}
					/>
				))}
			</CollapsibleContent>
		</Collapsible>
	);
}

function NodeStatusGlyph({ node }: { node: TreeNode }) {
	if (node.status === "pass") {
		return <span className="text-emerald-600">✓</span>;
	}
	if (node.status === "fail") {
		return <span className="text-destructive">✗</span>;
	}
	if (node.status === "warn") {
		return <span className="text-amber-600">!</span>;
	}
	return <span className="text-muted-foreground">•</span>;
}

function shouldDefaultOpen(kind: TreeNodeKind) {
	return kind === "attacker" || kind === "retrieval" || kind === "defense" || kind === "steps";
}

function buildTags(node: TreeNode) {
	const tags: string[] = [node.kind];
	if (node.meta) {
		for (const [key, value] of Object.entries(node.meta)) {
			if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
				tags.push(`${key}=${value}`);
			}
		}
	}
	return tags;
}
