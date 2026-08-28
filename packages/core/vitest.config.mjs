import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		// Use forks pool to avoid shared state issues with native modules
		pool: "forks",
		poolOptions: {
			forks: {
				singleFork: true,
			},
		},
	},
	optimizeDeps: {
		// Tell Vite not to optimize these dependencies
		exclude: ["node:sqlite", "sqlite"],
		noDiscovery: true,
		disabled: true,
	},
	ssr: {
		// Tell Vite to keep these external in SSR builds
		external: ["node:sqlite", "sqlite"],
	},
});
