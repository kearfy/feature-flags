import { expect, test } from "bun:test";
import { FeatureFlags } from "../src/index";

const schema = {
    devTools: {
        options: [false, true],
    },
    migrateDatabase: {
        readonly: true,
        options: [false, true],
    },
    max: {
        options: [2, 4],
    },
} as const;

const options = FeatureFlags.createOptions({
    schema,
    defaults: {
        dev: {
            migrateDatabase: true,
            devTools: true,
            max: 4,
        },
        preview: {
            devTools: true,
        },
    },
});

test("test defaults", () => {
    console.info("For prod");
    const prod = new FeatureFlags({
        ...options,
        environment: "prod",
    });

    expect(prod.store.max).toBe(2);
    expect(prod.store.migrateDatabase).toBe(false);
    expect(prod.store.devTools).toBe(false);

    console.info("For dev");
    const dev = new FeatureFlags({
        ...options,
        environment: "dev",
    });

    expect(dev.store.max).toBe(4);
    expect(dev.store.migrateDatabase).toBe(true);
    expect(dev.store.devTools).toBe(true);

    console.info("For preview");
    const preview = new FeatureFlags({
        ...options,
        environment: "preview",
    });

    expect(preview.store.max).toBe(2);
    expect(preview.store.migrateDatabase).toBe(false);
    expect(preview.store.devTools).toBe(true);
});

test("Test updating", () => {
    const prod = new FeatureFlags({
        ...options,
        environment: "prod",
    });

    console.log("Enabling devTools");
    prod.store.devTools = true;
    expect(prod.store.devTools).toBe(true);

    console.log("Cannot change migrateDatabase");
    let assignError: unknown;
    try {
        prod.store.migrateDatabase = true;
    } catch (e) {
        assignError = e;
    }
    expect(assignError).toBeInstanceOf(TypeError);
    expect((assignError as TypeError).message).toContain("migrateDatabase");
    expect(prod.store.migrateDatabase).toBe(false);
});

test("Test overrides", () => {
    const prod = new FeatureFlags({
        ...options,
        environment: "prod",
        overrides: (flag) =>
            (
                ({
                    max: 4,
                    migrateDatabase: true,
                    devTools: true,
                }) as const
            )[flag],
    });

    expect(prod.store.max).toBe(4);
    expect(prod.store.migrateDatabase).toBe(false);
    expect(prod.store.devTools).toBe(true);
});

test("Test subscriptions", () => {
    const updates: [unknown, unknown][][] = [[], []];
    const validate = (state: [unknown, unknown][]) => {
        expect(updates).toEqual([state, state]);
    };

    const prod = new FeatureFlags({
        ...options,
        environment: "prod",
        subscription: (...args) => updates[0].push(args),
    });

    prod.subscribe((...args) => updates[1].push(args));

    prod.store.max = 4;
    validate([["max", 4]]);

    prod.store.devTools = true;
    validate([
        ["max", 4],
        ["devTools", true],
    ]);

    prod.store.max = 2;
    validate([
        ["max", 4],
        ["devTools", true],
        ["max", 2],
    ]);

    prod.store.devTools = false;
    validate([
        ["max", 4],
        ["devTools", true],
        ["max", 2],
        ["devTools", false],
    ]);
});
