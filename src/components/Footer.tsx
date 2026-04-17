export default function Footer() {
	const year = new Date().getFullYear();

	return (
		<footer className="border-t border-border">
			<div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-6 text-sm text-muted-foreground">
				<p className="m-0">Built with TanStack Start.</p>
				<p className="m-0">{year}</p>
			</div>
		</footer>
	);
}
