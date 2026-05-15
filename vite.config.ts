import { defineConfig } from "vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const proxy = {
	"/api": "http://localhost:3334",
	"/socket.io": {
		target: "http://localhost:3334",
		ws: true,
	},
};

const config = defineConfig({
	resolve: { tsconfigPaths: true },
	server: { proxy },
	preview: {
		port: 3333,
		host: "0.0.0.0",
		allowedHosts: ["thesis.hir.sa"],
		proxy,
	},
	plugins: [devtools(), tailwindcss(), tanstackStart(), viteReact()],
});

export default config;
