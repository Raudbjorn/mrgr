import { err, ok, type Result } from "./result.js";

export const MIN_POOL_CONCURRENCY = 1;
export const MAX_POOL_CONCURRENCY = 32;

export async function boundedPool<T, R>(
	items: readonly T[],
	concurrency: number,
	worker: (item: T, index: number) => Promise<R>,
): Promise<Result<R>[]> {
	if (
		!Number.isInteger(concurrency) ||
		concurrency < MIN_POOL_CONCURRENCY ||
		concurrency > MAX_POOL_CONCURRENCY
	) {
		return [
			err(
				"config",
				"bounded pool",
				"Concurrency must be an integer from 1 to 32",
				{ concurrency },
			),
		];
	}
	const outcomes: Result<R>[] = new Array(items.length);
	let nextIndex = 0;
	const workerCount = Math.min(concurrency, items.length);
	async function runWorker(): Promise<void> {
		while (nextIndex < items.length) {
			const index = nextIndex;
			nextIndex += 1;
			try {
				outcomes[index] = ok(await worker(items[index] as T, index));
			} catch {
				outcomes[index] = err(
					"unsupported",
					"bounded pool worker",
					"Bounded pool worker rejected",
					{ index },
				);
			}
		}
	}
	const runners: Promise<void>[] = [];
	for (let index = 0; index < workerCount; index += 1)
		runners.push(runWorker());
	await Promise.all(runners);
	return outcomes;
}
