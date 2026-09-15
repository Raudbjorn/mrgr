import { err, ok } from "./result.js";
export const MIN_POOL_CONCURRENCY = 1;
export const MAX_POOL_CONCURRENCY = 32;
export async function boundedPool(items, concurrency, worker) {
    if (!Number.isInteger(concurrency) ||
        concurrency < MIN_POOL_CONCURRENCY ||
        concurrency > MAX_POOL_CONCURRENCY) {
        return [
            err("config", "bounded pool", "Concurrency must be an integer from 1 to 32", { concurrency }),
        ];
    }
    const outcomes = new Array(items.length);
    let nextIndex = 0;
    const workerCount = Math.min(concurrency, items.length);
    async function runWorker() {
        while (nextIndex < items.length) {
            const index = nextIndex;
            nextIndex += 1;
            try {
                outcomes[index] = ok(await worker(items[index], index));
            }
            catch {
                outcomes[index] = err("unsupported", "bounded pool worker", "Bounded pool worker rejected", { index });
            }
        }
    }
    const runners = [];
    for (let index = 0; index < workerCount; index += 1)
        runners.push(runWorker());
    await Promise.all(runners);
    return outcomes;
}
//# sourceMappingURL=pool.js.map