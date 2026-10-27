/**
 * A tag's default language must reach the upload form for every connector,
 * not only diarizing ones. The account language prefills uploadLanguage and is
 * sent explicitly, so a tag language that is skipped loses to it (OpenAI
 * connectors: account "en", tag "cs", upload sent "en"). Speaker counts stay
 * diarization-only.
 *
 * The same holds when the tag selection is restored from the last upload.
 * (The in-app recorder is not covered: it sends asrLanguage, which is never
 * prefilled with the account language, so the server resolves the tag.)
 *
 * useUpload only touches `.value`, so plain `{ value }` objects stand in for
 * refs; it reads the global Vue at call time, stubbed minimally.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useUpload } from './upload.js';

const ref = (value) => ({ value });

const csTag = {
    id: 1, name: 'cs', default_language: 'cs', default_min_speakers: 2, default_max_speakers: 4
};

function makeState({ diarization }) {
    const explicit = {
        selectedTagIds: ref([1]),
        availableTags: ref([csTag]),
        uploadLanguage: ref('en'),
        uploadMinSpeakers: ref(null),
        uploadMaxSpeakers: ref(null),
        uploadHotwords: ref(''),
        uploadInitialPrompt: ref(''),
        connectorSupportsDiarization: ref(diarization),
    };
    // Every other state ref is irrelevant to applyTagDefaults.
    return new Proxy(explicit, { get: (target, key) => target[key] ?? ref(null) });
}

beforeEach(() => {
    globalThis.Vue = {
        ref, markRaw: (v) => v, nextTick: vi.fn(),
        computed: (fn) => ({ get value() { return fn(); } }),
    };
});

describe('applyTagDefaults', () => {
    it('applies the tag language when the connector does not diarize', () => {
        const state = makeState({ diarization: false });
        useUpload(state, {}).applyTagDefaults();
        expect(state.uploadLanguage.value).toBe('cs');
        expect(state.uploadMinSpeakers.value).toBeNull();
        expect(state.uploadMaxSpeakers.value).toBeNull();
    });

    it('applies language and speaker counts when the connector diarizes', () => {
        const state = makeState({ diarization: true });
        useUpload(state, {}).applyTagDefaults();
        expect(state.uploadLanguage.value).toBe('cs');
        expect(state.uploadMinSpeakers.value).toBe(2);
        expect(state.uploadMaxSpeakers.value).toBe(4);
    });
});

describe('restoring the last upload defaults', () => {
    const restoreWith = (memo, { selected = [] } = {}) => {
        globalThis.localStorage = { getItem: () => JSON.stringify(memo) };
        const state = makeState({ diarization: false });
        state.selectedTagIds.value = selected;
        useUpload(state, {}).addFilesToQueue([]);
        return state;
    };

    it('lets the restored tag language beat the prefilled account language', () => {
        const state = restoreWith({ tagIds: [1], language: 'en' });
        expect(state.selectedTagIds.value).toEqual([1]);
        expect(state.uploadLanguage.value).toBe('cs');
    });

    it('keeps a language chosen by hand over the restored tag language', () => {
        const state = restoreWith({ tagIds: [1], language: 'de' });
        expect(state.uploadLanguage.value).toBe('en');
    });

    it('leaves the language alone when no tag is restored', () => {
        const state = restoreWith({ tagIds: [], language: 'en' });
        expect(state.uploadLanguage.value).toBe('en');
    });
});
