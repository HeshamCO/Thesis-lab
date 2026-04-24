import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ClipboardCopyIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeading } from "#/components/thesis/page-heading";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { api } from "#/lib/thesis/api";
import { queryKeys } from "#/lib/thesis/query";

export const Route = createFileRoute("/prompts/")({ component: PromptsPage });

type RoleKey = "attacker" | "benign" | "judge";

function PromptsPage() {
	const query = useQuery({ queryKey: queryKeys.prompts, queryFn: api.prompts });
	const [role, setRole] = useState<RoleKey>("attacker");

	if (query.isLoading) return <p className="p-4">Loading…</p>;
	if (!query.data) return <p className="p-4">Failed to load prompts.</p>;

	const entries = query.data[role];
	const filePathHint = {
		attacker: "server/prompts/attacker/v*.ts",
		benign: "server/prompts/benign/v*.ts",
		judge: "server/prompts/judge/v*.ts",
	}[role];

	return (
		<>
			<PageHeading
				title="Prompts"
				description="System + user templates used by the attacker, benign, and judge roles, rendered against a synthetic sample scenario."
			/>

			<Card>
				<CardHeader>
					<CardTitle>Role</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-wrap gap-2">
					{(["attacker", "benign", "judge"] as const).map((r) => (
						<Button
							key={r}
							type="button"
							size="sm"
							variant={role === r ? "default" : "outline"}
							onClick={() => setRole(r)}
						>
							{r} ({query.data[r].length})
						</Button>
					))}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Editing prompts</CardTitle>
				</CardHeader>
				<CardContent className="text-sm text-muted-foreground">
					Prompts are TypeScript modules compiled into the API server at startup. To add or edit a
					version, open the file <code className="font-mono text-foreground">{filePathHint}</code>,
					copy an existing version into a new file <code className="font-mono text-foreground">v(N+1).ts</code>,
					register it in <code className="font-mono text-foreground">server/prompts/index.ts</code>, and
					add its id to <code className="font-mono text-foreground">src/lib/thesis/schemas.ts</code>{" "}
					<code className="font-mono text-foreground">{role.toUpperCase()}_PROMPT_VERSIONS</code>. Restart
					the API server and the new version will appear in the bulk-run / sweep dropdowns.
				</CardContent>
			</Card>

			<div className="flex flex-col gap-4">
				{entries.map((prompt) => (
					<PromptCard key={prompt.id} prompt={prompt} />
				))}
			</div>
		</>
	);
}

function PromptCard({
	prompt,
}: {
	prompt: { id: string; description: string; system: string; user: string };
}) {
	const copy = async (text: string, label: string) => {
		try {
			await navigator.clipboard.writeText(text);
			toast.success(`Copied ${label} to clipboard (${text.length.toLocaleString()} chars).`);
		} catch {
			toast.error("Copy failed.");
		}
	};

	return (
		<Card>
			<CardHeader className="flex flex-row items-start justify-between gap-4">
				<div>
					<CardTitle className="text-base">
						<code className="font-mono">{prompt.id}</code>
					</CardTitle>
					<p className="mt-1 text-sm text-muted-foreground">{prompt.description}</p>
				</div>
				<div className="flex gap-2">
					<Badge variant="outline" className="text-[10px]">
						system {prompt.system.length.toLocaleString()}ch
					</Badge>
					<Badge variant="outline" className="text-[10px]">
						user {prompt.user.length.toLocaleString()}ch
					</Badge>
				</div>
			</CardHeader>
			<CardContent className="flex flex-col gap-3">
				<PromptBlock label="System" value={prompt.system} onCopy={copy} />
				<PromptBlock label="User (sample-rendered)" value={prompt.user} onCopy={copy} />
			</CardContent>
		</Card>
	);
}

function PromptBlock({
	label,
	value,
	onCopy,
}: {
	label: string;
	value: string;
	onCopy: (text: string, label: string) => void;
}) {
	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center justify-between">
				<span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
					{label}
				</span>
				<Button size="sm" variant="ghost" type="button" onClick={() => onCopy(value, label)}>
					<ClipboardCopyIcon data-icon="inline-start" />
					Copy
				</Button>
			</div>
			<pre className="m-0 max-h-80 overflow-auto rounded-md bg-muted/50 p-3 text-xs whitespace-pre-wrap break-words font-mono">
				{value || "(empty)"}
			</pre>
		</div>
	);
}
