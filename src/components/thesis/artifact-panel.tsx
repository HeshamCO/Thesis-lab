import { CopyIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "#/components/ui/sheet";
import { HighlightedText } from "./highlighted-text";

export type ArtifactPanelPayload = {
	id: string;
	title: string;
	subtitle?: string;
	tags?: string[];
	body: string;
	contentType?: "text" | "json";
	openUrl?: string;
};

export function ArtifactPanel({ payload, onClose }: { payload: ArtifactPanelPayload | null; onClose: () => void }) {
	const open = payload !== null;
	return (
		<Sheet
			open={open}
			onOpenChange={(next) => {
				if (!next) {
					onClose();
				}
			}}
		>
			<SheetContent className="sm:!max-w-xl flex flex-col gap-3">
				{payload ? <ArtifactPanelBody payload={payload} /> : null}
			</SheetContent>
		</Sheet>
	);
}

function ArtifactPanelBody({ payload }: { payload: ArtifactPanelPayload }) {
	const copy = async () => {
		try {
			await navigator.clipboard.writeText(payload.body);
			toast.success("Copied to clipboard");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Copy failed");
		}
	};

	return (
		<>
			<SheetHeader className="pr-10">
				<SheetTitle>{payload.title}</SheetTitle>
				{payload.subtitle ? <SheetDescription>{payload.subtitle}</SheetDescription> : null}
				{payload.tags && payload.tags.length > 0 ? (
					<div className="flex flex-wrap gap-1 pt-1">
						{payload.tags.map((tag) => (
							<Badge key={tag} variant="outline">
								{tag}
							</Badge>
						))}
					</div>
				) : null}
			</SheetHeader>
			<div className="flex items-center gap-2 px-4">
				<Button size="sm" variant="outline" onClick={copy}>
					<CopyIcon data-icon="inline-start" />
					Copy
				</Button>
				{payload.openUrl ? (
					<Button size="sm" variant="outline" asChild>
						<a href={payload.openUrl} target="_blank" rel="noreferrer">
							Open as JSON
						</a>
					</Button>
				) : null}
			</div>
			<HighlightedText
				text={payload.body}
				steps={[]}
				emptyText="(empty)"
				className="mx-4 mb-4 flex-1 overflow-auto"
			/>
		</>
	);
}
