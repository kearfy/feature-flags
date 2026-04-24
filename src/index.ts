import { deepCloneChanged } from "./utils/deep-clone-changed";

export class FeatureFlags<Environment extends string, Schema extends FeatureFlagSchema> {
    private subscriptions: Subscription<Schema>[] = [];
    /** Plain object for React `useSyncExternalStore` (reference updates via `deepCloneChanged` when flags change). */
    private _storeSnapshot!: TFeatureFlags<Schema>;
    public readonly schema: Schema;
    public readonly initialStore: TFeatureFlags<Schema>;
    private _store: TFeatureFlags<Schema>;

    constructor({
        schema,
        environment,
        defaults: defaultsInput,
        overrides,
        subscription,
    }: {
        schema: Schema;
        environment?: Environment;
        defaults?: FeatureFlagDefaults<Environment | string, Schema>;
        overrides?: Overrides<Schema>;
        subscription?: Subscription<Schema>;
    }) {
        if (defaultsInput && !environment) {
            throw new Error("Got defaults but no environment");
        }
        const defaults =
            defaultsInput && environment && environment in defaultsInput
                ? defaultsInput[environment]
                : undefined;
        this.schema = schema;
        this._store = new Proxy(FeatureFlags.computeStore({ schema, defaults, overrides }), {
            set: (store, flag, value) => {
                if (typeof flag !== "string") return false;

                const valid =
                    value ===
                    FeatureFlags.computeValue({
                        schema: this.schema,
                        flag,
                        current: flag in store ? store[flag as keyof typeof store] : undefined,
                        manual: value,
                    });

                if (!valid) return false;
                const success = Reflect.set(store, flag, value);
                if (success) {
                    this.materializeStoreSnapshot();
                    const subs = this.subscriptions;
                    for (let i = 0; i < subs.length; i++) {
                        const cb = subs[i];
                        if (cb) cb(flag, value);
                    }
                }
                return success;
            },
        });

        this.initialStore = { ...this._store };
        this._storeSnapshot = deepCloneChanged(
            {} as TFeatureFlags<Schema>,
            { ...this._store } as TFeatureFlags<Schema>,
        );
        if (subscription) this.subscriptions.push(subscription);
    }

    /** Current plain object for `useSyncExternalStore` getSnapshot. */
    getStoreSnapshot(): TFeatureFlags<Schema> {
        return this._storeSnapshot;
    }

    /** Server snapshot: stable initial state (matches `initialStore`). */
    getInitialStoreSnapshot(): TFeatureFlags<Schema> {
        return this.initialStore;
    }

    private materializeStoreSnapshot() {
        const nextPlain = { ...this._store } as TFeatureFlags<Schema>;
        this._storeSnapshot = deepCloneChanged(this._storeSnapshot, nextPlain);
    }

    subscribe(subscription: Subscription<Schema>) {
        this.subscriptions.push(subscription);
        return true;
    }

    unsubscribe(subscription: Subscription<Schema>) {
        const index = this.subscriptions.indexOf(subscription);
        if (index === -1) return false;
        this.subscriptions.splice(index, 1);
        return true;
    }

    get store() {
        return this._store;
    }

    get<Flag extends FeatureFlag<Schema>>(flag: Flag): FeatureFlagOption<Schema, Flag> {
        return this._store[flag];
    }

    set<Flag extends FeatureFlag<Schema>>(flag: Flag, value: FeatureFlagOption<Schema, Flag>) {
        this._store[flag] = value;
        return true;
    }

    static computeStore<Schema extends FeatureFlagSchema>({
        schema,
        defaults,
        overrides,
    }: {
        schema: Schema;
        defaults?: Partial<TFeatureFlags<Schema>>;
        overrides?: Overrides<Schema>;
    }) {
        const options = FeatureFlags.listOptionsFromSchema(schema);
        const out = {} as TFeatureFlags<Schema>;
        for (const flag of options) {
            (out as Record<FeatureFlag<Schema>, FeatureFlagValue>)[flag] =
                FeatureFlags.computeValue({
                    schema,
                    defaults,
                    overrides,
                    flag,
                });
        }
        return out;
    }

    static computeValue<Schema extends FeatureFlagSchema, Flag extends FeatureFlag<Schema>>({
        schema,
        flag,
        overrides,
        defaults,
        current: vCurrent,
        manual,
    }: {
        schema: Schema;
        flag: Flag;
        defaults?: Partial<TFeatureFlags<Schema>>;
        overrides?: Overrides<Schema>;
        current?: FeatureFlagValue;
        manual?: FeatureFlagValue;
    }): FeatureFlagValue {
        const v = (v: unknown) =>
            schema[flag].options.includes(v as FeatureFlagValue)
                ? (v as FeatureFlagValue)
                : undefined;
        const vSchema = schema[flag].options[0];
        const vDefault = v(defaults?.[flag]);
        const vOverride = v(FeatureFlags.computeOverride({ schema, flag, overrides }));
        const vManual = v(!schema[flag].readonly ? manual : undefined);

        return vManual ?? vOverride ?? vDefault ?? vCurrent ?? vSchema;
    }

    static computeOverride<Schema extends FeatureFlagSchema, Flag extends FeatureFlag<Schema>>({
        schema,
        flag,
        overrides,
    }: {
        schema: Schema;
        flag: Flag;
        overrides?: Overrides<Schema>;
    }): FeatureFlagValue | undefined {
        if (schema[flag].readonly) return undefined;

        const value = overrides?.(flag);
        if (!FeatureFlags.isValidValue(value)) return undefined;

        return value;
    }

    static listOptionsFromSchema<Schema extends FeatureFlagSchema>(schema: Schema) {
        return Object.keys(schema) as FeatureFlag<Schema>[];
    }

    static isValidValue(v: unknown): v is FeatureFlagValue {
        return ["string", "number", "boolean"].includes(typeof v);
    }

    static createOptions<Environment extends string, Schema extends FeatureFlagSchema>({
        schema,
        defaults,
    }: {
        schema: Schema;
        defaults?: FeatureFlagDefaults<Environment | string, Schema>;
    }) {
        return { schema, defaults };
    }
}

/////////////////////////////////////
/////////////   TYPES   /////////////
/////////////////////////////////////

export type FeatureFlagValue = boolean | number | string;
export type FeatureFlagSchema = Record<
    string,
    {
        readonly?: boolean;
        options: readonly [FeatureFlagValue, ...FeatureFlagValue[]];
    }
>;

export type TFeatureFlags<Schema extends FeatureFlagSchema> = {
    -readonly [T in FeatureFlag<Schema>]: FeatureFlagOption<Schema, T>;
};

export type FeatureFlagDefaults<
    Environment extends string,
    Schema extends FeatureFlagSchema,
> = Partial<Record<Environment, Partial<TFeatureFlags<Schema>>>>;

export type FeatureFlag<T extends FeatureFlagSchema> = keyof T;
export type FeatureFlagOption<
    Schema extends FeatureFlagSchema,
    Flag extends FeatureFlag<Schema>,
> = Schema[Flag]["options"][number];

export type Overrides<Schema extends FeatureFlagSchema> = <T extends FeatureFlag<Schema>>(
    flag: T,
) => FeatureFlagValue | undefined;
export type Subscription<Schema extends FeatureFlagSchema> = <T extends FeatureFlag<Schema>>(
    flag: T,
    value: FeatureFlagOption<Schema, T>,
) => unknown | Promise<unknown>;

// biome-ignore lint/suspicious/noExplicitAny: values must be assignable from any schema-bound FeatureFlags
export type AnyFeatureFlags = FeatureFlags<any, any>;
