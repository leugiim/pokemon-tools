<script lang="ts">
	import { movesOf } from '$lib/modules/damage-calculator/calc/learnsets';
	import { allMoves, type MoveItem } from '$lib/modules/damage-calculator/calc/moves';
	import type { SpeciesItem } from '$lib/modules/shared/species/generation';
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

<SearchableCombobox
	{items}
	bind:selected
	getLabel={(m) => m.name}
	placeholder={loading ? 'Loading…' : 'Select a move…'}
	disabled={disabled || loading}
/>
