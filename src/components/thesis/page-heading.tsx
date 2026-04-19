import type { ReactNode } from "react";

export function PageHeading({
	title,
	description,
	action,
}: {
	title: string;
	description: string;
	action?: ReactNode;
}) {
	return (
		<div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
			<div className="flex max-w-3xl flex-col gap-2">
				<p className="m-0 text-sm font-medium text-muted-foreground">
					Indirect prompt injection loop
				</p>
				<h1 className="m-0 text-3xl font-semibold text-foreground">{title}</h1>
				<p className="m-0 text-sm leading-6 text-muted-foreground">
					{description}
				</p>
			</div>
			{action}
		</div>
	);
}
