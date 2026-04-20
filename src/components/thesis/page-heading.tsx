import type { ReactNode } from "react";

export function PageHeading({
	title,
	description,
	action,
	eyebrow = "Indirect prompt injection loop",
	backButton,
}: {
	title: string;
	description: string;
	action?: ReactNode;
	eyebrow?: string;
	backButton?: string;
}) {
	return (
		<div className="flex flex-col gap-4 border-b border-border/60 pb-5 md:flex-row md:items-end md:justify-between">
			<div className="flex w-full flex-col gap-2">
				<p className="m-0 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{eyebrow}</p>
				<h1 className="m-0 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">{title}</h1>
				<p className="m-0 text-sm leading-6 text-muted-foreground">{description}</p>
				{/* back button */}
				{backButton && (
					<>
						<div className="absolute left-4 top-4 md:relative md:left-0 md:top-0">
							<a href="/runs" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
									className="h-4 w-4"
								>
									<line x1="19" y1="12" x2="5" y2="12"></line>
									<polyline points="12 19 5 12 12 5"></polyline>
								</svg>
								Back to {backButton}
							</a>
						</div>
					</>
				)}
			</div>
			{action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
		</div>
	);
}
