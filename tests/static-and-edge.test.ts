import { expect, test } from "bun:test";
import { FeatureFlags, type Subscription } from "../src/index";

const simpleSchema = {
    a: { options: [0, 1, 2] as const },
    b: { readonly: true, options: [false, true] as const },
} as const;

test("isValidValue", () => {
    expect(FeatureFlags.isValidValue(true)).toBe(true);
    expect(FeatureFlags.isValidValue(0)).toBe(true);
    expect(FeatureFlags.isValidValue("x")).toBe(true);
    expect(FeatureFlags.isValidValue(null)).toBe(false);
    expect(FeatureFlags.isValidValue(undefined)).toBe(false);
    expect(FeatureFlags.isValidValue({})).toBe(false);
    expect(FeatureFlags.isValidValue(Symbol("x"))).toBe(false);
    expect(FeatureFlags.isValidValue(() => {})).toBe(false);
    expect(FeatureFlags.isValidValue([])).toBe(false);
});

test("computeValue precedence: manual over override over default", () => {
    const schema = { f: { options: [0, 1, 2] as const } } as const;
    expect(
        FeatureFlags.computeValue({
            schema,
            flag: "f",
            manual: 2,
            defaults: { f: 0 },
            overrides: () => 1,
        }),
    ).toBe(2);
    expect(
        FeatureFlags.computeValue({
            schema,
            flag: "f",
            manual: undefined,
            defaults: { f: 0 },
            overrides: () => 1,
        }),
    ).toBe(1);
    expect(
        FeatureFlags.computeValue({
            schema,
            flag: "f",
            manual: undefined,
            defaults: { f: 0 },
            overrides: () => undefined,
        }),
    ).toBe(0);
});

test("computeValue: readonly ignores manual", () => {
    const schema = { r: { readonly: true, options: [0, 1] as const } } as const;
    expect(
        FeatureFlags.computeValue({
            schema,
            flag: "r",
            manual: 1,
        }),
    ).toBe(0);
});

test("computeValue: current fallback", () => {
    const schema = { f: { options: [0, 1, 2] as const } } as const;
    expect(
        FeatureFlags.computeValue({
            schema,
            flag: "f",
            current: 2,
        }),
    ).toBe(2);
});

test("computeOverride: readonly", () => {
    const schema = { r: { readonly: true, options: [0, 1] as const } } as const;
    expect(
        FeatureFlags.computeOverride({
            schema,
            flag: "r",
            overrides: () => 1,
        }),
    ).toBeUndefined();
});

test("computeOverride: non-primitive from overrides is ignored", () => {
    const schema = { f: { options: [0, 1] as const } } as const;
    expect(
        FeatureFlags.computeOverride({
            schema,
            flag: "f",
            overrides: () => ({}) as never,
        }),
    ).toBeUndefined();
});

test("computeStore: builds store from schema", () => {
    const store = FeatureFlags.computeStore({ schema: simpleSchema });
    expect(store.a).toBe(0);
    expect(store.b).toBe(false);
});

test("constructor: defaults without environment throws", () => {
    expect(
        () =>
            new FeatureFlags({
                schema: { x: { options: [0, 1] } },
                defaults: { dev: { x: 0 } } as never,
            }),
    ).toThrow("Got defaults but no environment");
});

test("subscribe: notifications run in registration order", () => {
    const f = new FeatureFlags({ schema: { x: { options: [0, 1, 2] } } });
    const order: string[] = [];
    f.subscribe(() => {
        order.push("a");
    });
    f.subscribe(() => {
        order.push("b");
    });
    f.set("x", 1);
    expect(order).toEqual(["a", "b"]);
});

test("unsubscribe: not found returns false", () => {
    const f = new FeatureFlags({ schema: { x: { options: [0, 1] } } });
    const cb = () => {};
    expect(f.unsubscribe(cb)).toBe(false);
});

test("unsubscribe: first subscriber can be removed and stops receiving", () => {
    const f = new FeatureFlags({
        schema: { x: { options: [0, 1, 2] as const } } as const,
    });
    const first: [string, number][] = [];
    const second: [string, number][] = [];
    const fn1: Subscription<typeof f.schema> = (flag, value) => {
        first.push([flag, value]);
    };
    const fn2: Subscription<typeof f.schema> = (flag, value) => {
        second.push([flag, value]);
    };
    f.subscribe(fn1);
    f.subscribe(fn2);
    expect(f.unsubscribe(fn1)).toBe(true);
    f.set("x", 1);
    expect(first).toEqual([]);
    expect(second).toEqual([["x", 1]]);
});

test("unsubscribe: second subscriber removable", () => {
    const f = new FeatureFlags({ schema: { x: { options: [0, 1, 2] } } });
    const fn1 = () => {};
    const fn2 = () => {};
    f.subscribe(fn1);
    f.subscribe(fn2);
    expect(f.unsubscribe(fn2)).toBe(true);
    expect(f.unsubscribe(fn2)).toBe(false);
});

test("getStoreSnapshot: same object reference when store unchanged", () => {
    const f = new FeatureFlags({ schema: { x: { options: [0, 1, 2] } } });
    const a = f.getStoreSnapshot();
    const b = f.getStoreSnapshot();
    expect(a).toBe(b);
});

test("getStoreSnapshot: new reference after set and after direct store write", () => {
    const f = new FeatureFlags({ schema: { x: { options: [0, 1, 2] } } });
    const initial = f.getStoreSnapshot();
    f.set("x", 1);
    const afterSet = f.getStoreSnapshot();
    expect(afterSet).not.toBe(initial);
    expect(afterSet.x).toBe(1);
    expect(f.getStoreSnapshot()).toBe(afterSet);
    f.store.x = 2;
    const afterDirect = f.getStoreSnapshot();
    expect(afterDirect).not.toBe(afterSet);
    expect(afterDirect.x).toBe(2);
});
