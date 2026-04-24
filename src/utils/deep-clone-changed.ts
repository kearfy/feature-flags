/**
 * Deep-compare two object trees and return structural sharing: new references
 * only where values differ. Used to update `useSyncExternalStore` snapshot identity
 * without JSON serialization.
 */
export function deepCloneChanged<A extends object, B = A>(prev: A, next: B): B {
    if (Object.is(prev, next)) {
        return next;
    }

    let changed = false;

    function walk<T, U>(p: T, n: U): T | U {
        if (Object.is(p, n)) {
            return p;
        }

        if (p === null || n === null || typeof p !== "object" || typeof n !== "object") {
            changed = true;
            return n;
        }

        if (Array.isArray(p) || Array.isArray(n)) {
            changed = true;
            return n;
        }

        const pKeys = Object.keys(p as Record<string, unknown>);
        const nKeys = Object.keys(n as Record<string, unknown>);

        if (pKeys.length !== nKeys.length) {
            changed = true;
            return n;
        }

        let localChanged = false;
        const result: Record<string, unknown> = {};

        for (let i = 0; i < pKeys.length; i++) {
            if (pKeys[i] !== nKeys[i]) {
                localChanged = true;
                break;
            }
        }

        if (!localChanged) {
            for (const key of pKeys) {
                const prevVal = (p as Record<string, unknown>)[key];
                const nextVal = (n as Record<string, unknown>)[key];
                const child = walk(prevVal, nextVal);

                if (child !== prevVal) {
                    localChanged = true;
                }

                result[key] = child;
            }
        } else {
            const allKeys = new Set([...pKeys, ...nKeys]);
            for (const key of allKeys) {
                const prevVal = (p as Record<string, unknown>)[key];
                const nextVal = (n as Record<string, unknown>)[key];
                const child = walk(prevVal, nextVal);

                if (child !== prevVal) {
                    localChanged = true;
                }

                result[key] = child;
            }
        }

        if (localChanged) {
            changed = true;
            return result as T | U;
        } else {
            return p;
        }
    }

    const result = walk(prev, next);
    return (changed ? result : prev) as B;
}
