import { HeadContent, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import Header from "../components/Header";
import { Toaster } from "../components/ui/sonner";
import appCss from "../styles.css?url";

interface MyRouterContext {
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Thesis Lab" },
		],
		links: [{ rel: "stylesheet", href: appCss }],
	}),
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<HeadContent />
			</head>
			<body className="min-h-screen bg-background font-sans text-foreground antialiased [overflow-wrap:anywhere]">
				<div className="min-h-screen lg:grid lg:grid-cols-[15rem_1fr]">
					<Header />
					<div className="min-w-0">
						<main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 lg:px-8">
							{children}
						</main>
					</div>
				</div>
				<Toaster />
				<Scripts />
			</body>
		</html>
	);
}
