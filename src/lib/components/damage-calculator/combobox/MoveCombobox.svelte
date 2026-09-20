<script lang="ts">
	import { movesOf } from '$lib/modules/damage-calculator/calc/learnsets';
	import { descriptionOf } from '$lib/modules/damage-calculator/calc/moveDescriptions';
	import {
		allMoves,
		effectiveBasePower,
		type MoveItem
	} from '$lib/modules/damage-calculator/calc/moves';
	import type { SpeciesItem } from '$lib/modules/shared/species/generation';
	import MoveCategoryIcon from '../display/MoveCategoryIcon.svelte';
	import TypeBadge from '../display/TypeBadge.svelte';
	import SearchableCombobox from '$lib/components/shared/ui/SearchableCombobox.svelte';

	let {
		species,
		selected = $bindable(null),
		disabled = false
	}: { species: SpeciesItem | null; selected?: MoveItem | null; disabled?: boolean } = $props();

	// Falls back to the full movepool (rather than an empty list) with no
	// species picked yet, same as before this combobox was species-aware.
	let items = $state<MoveItem[]>(allMoves);
	let loading = $state(false);

	$effect(() => {
		const current = species;
		if (!current) {
			items = allMoves;
			return;
		}
		loading = true;
		movesOf(current).then((moves) => {
			// The species may have changed again while this was in flight.
			if (current === species) {
				items = moves;
				loading = false;
			}
		});
	});
</script>

{#snippet meta(move: MoveItem)}
	<span class="flex w-16 shrink-0 justify-center"><TypeBadge type={move.type} /></span>
	<span class="flex w-8 shrink-0 justify-center">
		{#if move.category}
			<MoveCategoryIcon category={move.category} />
		{:else}
			<span class="text-[11px] text-gray-500">–</span>
		{/if}
	</span>
	<span class="w-8 shrink-0 text-right text-[11px] font-semibold text-gray-500">
		{effectiveBasePower(move) || '–'}
	</span>
{/snippet}

{#snippet row(move: MoveItem)}
	<span class="min-w-0 flex-1 truncate">{move.name}</span>
	{@render meta(move)}
{/snippet}

{#snippet tooltip(move: MoveItem)}
	{@const desc = descriptionOf(move)}
	{#if desc}
		<span class="mb-0.5 block font-semibold text-gray-100">{move.name}</span>
		<span class="block">{desc.shortDesc}</span>
		{#if desc.desc !== desc.shortDesc}
			<span class="mt-1 block text-gray-400">{desc.desc}</span>
		{/if}
	{/if}
{/snippet}

<SearchableCombobox
	{items}
	bind:selected
	getLabel={(m) => m.name}
	placeholder={loading ? 'Loading…' : 'Select a move…'}
	disabled={disabled || loading}
	{row}
	trailing={meta}
	{tooltip}
	class="w-full"
/>
