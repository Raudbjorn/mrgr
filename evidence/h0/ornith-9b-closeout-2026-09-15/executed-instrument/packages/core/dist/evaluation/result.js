export function ok(value) {
    return { ok: true, value };
}
export function err(kind, operation, message, details) {
    const error = details === undefined
        ? { kind, operation, message }
        : { kind, operation, message, details };
    return { ok: false, error };
}
//# sourceMappingURL=result.js.map