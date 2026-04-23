import { Link } from "@tanstack/react-router";
import { ActivityIcon, BotIcon, FlaskConicalIcon, LayersIcon, LayoutDashboardIcon, ShieldIcon, TargetIcon } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import { cn } from "#/lib/utils";

const navItems = [
	{ to: "/", label: "Dashboard", icon: LayoutDashboardIcon, exact: true },
	{ to: "/scenarios", label: "Scenarios", icon: TargetIcon, exact: false },
	{ to: "/models", label: "Models", icon: BotIcon, exact: false },
	{ to: "/defenses", label: "Defenses", icon: ShieldIcon, exact: false },
	{ to: "/runs", label: "Runs", icon: ActivityIcon, exact: false },
	{ to: "/bulk-runs", label: "Bulk runs", icon: LayersIcon, exact: false },
] as const;

export default function Header() {
	return (
		<header className="border-b border-sidebar-border bg-sidebar text-sidebar-foreground lg:sticky lg:top-0 lg:h-screen lg:border-r lg:border-b-0">
			<div className="flex h-full flex-col gap-6 px-4 py-5">
				<Link
					to="/"
					className="flex items-center gap-2.5 rounded-md text-sm font-semibold text-sidebar-foreground no-underline"
					activeOptions={{ exact: true }}
				>
					<span className="flex size-7 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
						<FlaskConicalIcon className="size-4" />
					</span>
					<span className="flex flex-col leading-tight">
						<span>Thesis Lab</span>
						<span className="text-[10px] font-normal uppercase tracking-[0.14em] text-muted-foreground">
							Injection research
						</span>
					</span>
				</Link>
				<nav className="flex flex-wrap gap-0.5 lg:flex-col">
					{navItems.map((item) => (
						<Link
							key={item.to}
							to={item.to}
							className="group/nav flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground no-underline transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
							activeOptions={item.exact ? { exact: true } : undefined}
							activeProps={{
								className: cn("bg-sidebar-accent text-sidebar-accent-foreground"),
							}}
						>
							<item.icon className="size-4 text-muted-foreground transition-colors group-hover/nav:text-sidebar-accent-foreground group-aria-current/nav:text-sidebar-accent-foreground" />
							{item.label}
						</Link>
					))}
				</nav>
				<div className="mt-auto flex flex-col gap-3">
					<div className="hidden h-px w-full bg-sidebar-border lg:block" />
					<div className="flex items-center justify-between gap-3">
						<p className="m-0 hidden text-[11px] text-muted-foreground lg:block">Local research workspace</p>
						<ThemeToggle />
					</div>
				</div>
			</div>
		</header>
	);
}
