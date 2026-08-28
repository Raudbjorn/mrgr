declare module "node:sqlite" {
	export class DatabaseSync {
		constructor(path: string);
		exec(sql: string): void;
		prepare(sql: string): Statement;
		close(): void;
	}

	export interface Statement {
		get(): unknown;
		run(...params: unknown[]): void;
		all(...params: unknown[]): unknown[];
	}
}
