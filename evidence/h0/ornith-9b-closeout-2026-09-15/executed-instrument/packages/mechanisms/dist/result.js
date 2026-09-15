// A small, local Result type — @mrgr/mechanisms deliberately doesn't depend
// on @mrgr/core. It's meant to be an independently-consumable package, and a
// workspace dependency on core's dist-based type exports doesn't resolve
// during `pnpm -r typecheck`/`test`, which run before `pnpm -r build` in CI.
export function ok(value) {
    return { ok: true, value };
}
export function err(kind, operation, message, details) {
    return details === undefined
        ? { ok: false, error: { kind, operation, message } }
        : { ok: false, error: { kind, operation, message, details } };
}
//# sourceMappingURL=result.js.map