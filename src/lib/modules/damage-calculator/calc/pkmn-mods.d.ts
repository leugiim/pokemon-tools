/**
 * `@pkmn/mods`'s `package.json` only types its `"./champions"` subpath via
 * the legacy `typesVersions` field, not an explicit `"types"` condition in
 * `exports` — this project's `moduleResolution: "bundler"` doesn't fall
 * back to `typesVersions` when `exports` is present at all, so TypeScript
 * can't resolve that subpath's declaration file on its own. Declared here
 * with only the shape `learnsets.ts` actually reads, rather than pulling
 * in `@pkmn/mods`'s own (accurate, but `@pkmn/sim`-typed) declaration —
 * this app has no other reason to depend on `@pkmn/sim`.
 */
declare module '@pkmn/mods/champions' {
	export const Learnsets: Record<string, { learnset?: Record<string, string[]> } | undefined>;
}
