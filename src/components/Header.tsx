import { Link } from "@tanstack/react-router";
import ThemeToggle from "./ThemeToggle";

export default function Header() {
	return (
		<header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
			<div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
				<Link
					to="/"
					className="rounded-md text-sm font-semibold text-foreground no-underline"
					activeOptions={{ exact: true }}
				>
					TanStack Start
				</Link>
				<nav className="flex items-center gap-1">
					<Link
						to="/"
						className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground no-underline transition-colors hover:text-foreground"
						activeOptions={{ exact: true }}
						activeProps={{
							className: "bg-muted text-foreground",
						}}
					>
						Home
					</Link>
					<Link
						to="/about"
						className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground no-underline transition-colors hover:text-foreground"
						activeProps={{
							className: "bg-muted text-foreground",
						}}
					>
						About
					</Link>
					<ThemeToggle />
				</nav>
			</div>
		</header>
	);
}
