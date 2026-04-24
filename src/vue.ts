import { onUnmounted, shallowRef } from "vue";
import { type AnyFeatureFlags, FeatureFlags, type TFeatureFlags } from "./index";

export function featureFlagsHookFactory<T extends AnyFeatureFlags>(featureFlags: T) {
    return () => {
        type Schema = (typeof featureFlags)["schema"];
        const state = shallowRef({ ...featureFlags.store } as TFeatureFlags<Schema>);

        const setState = (updates: Partial<TFeatureFlags<Schema>>) => {
            const flags = Object.keys(updates) as (keyof typeof updates)[];
            flags.forEach((flag) => {
                const v = updates[flag];
                if (FeatureFlags.isValidValue(v)) {
                    featureFlags.set(flag, v);
                }
            });
        };

        const listener = () => {
            state.value = { ...featureFlags.store };
        };
        featureFlags.subscribe(listener);
        onUnmounted(() => featureFlags.unsubscribe(listener));

        return [state, setState] as const;
    };
}
