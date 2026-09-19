<script lang="ts">
	import Modal from '$lib/components/shared/ui/Modal.svelte';
	import ToggleButton from '$lib/components/shared/ui/ToggleButton.svelte';
	import TypeBadge from '../display/TypeBadge.svelte';
	import {
		formatMultiplier,
		groupByMultiplier,
		hasDefensiveModifier,
		matchups
	} from '$lib/modules/damage-calculator/calc/typeMatchups';
	import type { TeamSlot } from '$lib/modules/damage-calculator/stores/team.svelte';

	/**
	 * What the slot's Pokémon takes from each type: weaknesses, resistances
	 * and immunities, from its types alone or with its ability and item
	 * folded in. Read-only: it never writes to the slot.
	 */
	let { slot, onclose }: { slot: TeamSlot; onclose: () => void } = $props();

	const types = $derived(slot.types);
	const mods = $derived({ ability: slot.ability, item: slot.item?.name });
	const modifies = $derived(hasDefensiveModifier(types, mods));

	let useAbility = $state(true);
	// Weakest first, so ×1 lands between the weaknesses and the resistances.
	const groups = $derived(groupByMultiplier(matchups(types, useAbility && modifies ? mods : {})));

	function tone(multiplier: number): string {
		if (multiplier === 1) return 'text-gray-400';
		if (multiplier > 1) return 'text-red-300';
		if (multiplier === 0) return 'text-sky-300';
		return 'text-emerald-300';
	}
</script>

<Modal title="Type matchups{slot.species ? ` — ${slot.species.name}` : ''}" {onclose}>
	<div class="flex flex-wrap items-center gap-2 text-xs text-gray-300">
		{#each types as type (type)}<TypeBadge {type} />{/each}
		{#if modifies}
			<ToggleButton
				class="rounded border border-gray-700"
				active={useAbility}
				title="Fold this Pokémon's ability and item into the matchups"
				onclick={() => (useAbility = !useAbility)}
			>
				Ability &amp; item
			</ToggleButton>
		{/if}
	</div>

	<ul class="flex flex-col gap-1">
		{#each groups as group (group.multiplier)}
			<li
				class="flex items-start gap-2 rounded px-2 py-1 {group.multiplier === 1
					? 'opacity-60'
					: 'bg-gray-800/60'}"
			>
				<span class="w-14 shrink-0 pt-0.5 text-xs font-semibold {tone(group.multiplier)}">
					{formatMultiplier(group.multiplier)}
				</span>
				<div class="flex flex-wrap gap-1">
					{#each group.matchups as m (m.type)}
						<span title={m.source ? `${m.source} (was ${formatMultiplier(m.base)})` : undefined}>
							<TypeBadge type={m.type} />
							{#if m.source}<span class="text-[9px] text-gray-400">{m.source}</span>{/if}
						</span>
					{/each}
				</div>
			</li>
		{/each}
	</ul>
</Modal>
