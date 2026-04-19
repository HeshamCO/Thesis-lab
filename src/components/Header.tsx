import { Link } from "@tanstack/react-router";
import { ActivityIcon, BotIcon, DatabaseIcon, LayoutDashboardIcon, ShieldIcon, TargetIcon } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import { cn } from "#/lib/utils";

const navItems = [
	{ to: "/", label: "Dashboard", icon: LayoutDashboardIcon, exact: true },
	{ to: "/scenarios", label: "Scenarios", icon: TargetIcon, exact: false },
	{ to: "/models", label: "Models", icon: BotIcon, exact: false },
	{ to: "/defenses", label: "Defenses", icon: ShieldIcon, exact: false },
	{ to: "/runs", label: "Runs", icon: ActivityIcon, exact: false },
] as const;

export default function Header() {
	return (
		<header className="border-b border-border bg-background/95 lg:sticky lg:top-0 lg:h-screen lg:border-r lg:border-b-0">
			<div className="flex h-full flex-col gap-5 px-4 py-4">
				<Link
					to="/"
					className="flex items-center gap-2 rounded-md text-sm font-semibold text-foreground no-underline"
					activeOptions={{ exact: true }}
				>
					<DatabaseIcon />
					Thesis Lab
				</Link>
				<nav className="flex flex-wrap gap-1 lg:flex-col">
					{navItems.map((item) => (
						<Link
							key={item.to}
							to={item.to}
							className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground no-underline transition-colors hover:bg-muted hover:text-foreground"
							activeOptions={item.exact ? { exact: true } : undefined}
							activeProps={{
								className: cn("bg-muted text-foreground"),
							}}
						>
							<item.icon />
							{item.label}
						</Link>
					))}
				</nav>
				<div className="mt-auto flex items-center justify-between gap-3">
					<p className="m-0 hidden text-xs text-muted-foreground lg:block">Local research workspace</p>
					<ThemeToggle />
				</div>
			</div>
		</header>
	);
}
