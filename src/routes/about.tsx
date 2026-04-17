import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
	component: About,
});

function About() {
	return (
		<main className="mx-auto min-h-[calc(100vh-8rem)] max-w-5xl px-4 py-12">
			<section className="max-w-3xl">
				<p className="mb-3 text-sm font-semibold uppercase text-muted-foreground">
					About
				</p>
				<h1 className="mb-4 text-4xl font-bold text-foreground sm:text-5xl">
					A clean foundation for the next feature.
				</h1>
				<p className="m-0 text-lg leading-8 text-muted-foreground">
					This project keeps the framework setup and removes the scaffold demos.
					Use the remaining files as the stable base for real routes, server
					functions, data loading, and shared UI.
				</p>
			</section>
		</main>
	);
}
