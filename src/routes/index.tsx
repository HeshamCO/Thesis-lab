import { Link, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: App });

const STARTER_NOTES = [
	{
		title: "File routes",
		description:
			"Add pages in src/routes and TanStack Router keeps route types generated.",
	},
	{
		title: "Root shell",
		description:
			"Shared metadata, styles, scripts, header, footer, and devtools live in __root.tsx.",
	},
	{
		title: "Query context",
		description:
			"React Query is already connected to the router for SSR-aware data loading.",
	},
];

function App() {
	return (
		<main className="mx-auto min-h-[calc(100vh-8rem)] max-w-5xl px-4 py-12">
			<section className="max-w-3xl">
				<p className="mb-3 text-sm font-semibold uppercase text-muted-foreground">
					Fresh TanStack Start App
				</p>
				<h1 className="mb-5 text-4xl font-bold text-foreground sm:text-5xl">
					Start with the application, not the demo.
				</h1>
				<p className="mb-8 text-lg leading-8 text-muted-foreground">
					The template extras have been removed. What remains is a small
					TanStack Start foundation with routing, SSR-aware query context,
					Tailwind CSS, and a few reusable UI primitives.
				</p>
				<div className="flex flex-wrap gap-3">
					<Link
						to="/about"
						className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground no-underline transition-colors hover:bg-primary/90"
					>
						Read the notes
					</Link>
					<a
						href="https://tanstack.com/start"
						target="_blank"
						rel="noopener noreferrer"
						className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-foreground no-underline transition-colors hover:bg-muted"
					>
						TanStack Start
					</a>
				</div>
			</section>

			<section className="mt-12 grid gap-4 sm:grid-cols-3">
				{STARTER_NOTES.map((note) => (
					<article
						key={note.title}
						className="rounded-lg border border-border p-5"
					>
						<h2 className="mb-2 text-base font-semibold text-foreground">
							{note.title}
						</h2>
						<p className="m-0 text-sm leading-6 text-muted-foreground">
							{note.description}
						</p>
					</article>
				))}
			</section>

			<section className="mt-12 rounded-lg border border-border bg-muted/30 p-5">
				<h2 className="mb-3 text-base font-semibold text-foreground">
					Next steps
				</h2>
				<ul className="m-0 list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
					<li>
						Edit <code>src/routes/index.tsx</code> to customize the home page.
					</li>
					<li>
						Update <code>src/components/Header.tsx</code> and{" "}
						<code>src/components/Footer.tsx</code> for brand links.
					</li>
					<li>
						Add routes in <code>src/routes</code> and tweak visual tokens in{" "}
						<code>src/styles.css</code>.
					</li>
				</ul>
			</section>
		</main>
	);
}
