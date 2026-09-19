<script lang="ts">
	import ToggleButton from '$lib/components/shared/ui/ToggleButton.svelte';
	import Modal from '$lib/components/shared/ui/Modal.svelte';
	import SpeciesSprite from '$lib/components/shared/species/SpeciesSprite.svelte';
	import {
		SPEED_CONDITION_LABELS,
		SPEED_LISTS,
		isMega,
		ownSpeed,
		speedGroups,
		withYou,
		type SpeedEntry,
		type SpeedGroup
	} from '$lib/modules/damage-calculator/calc/speedTiers';
	import type { TeamSlot } from '$lib/modules/damage-calculator/stores/team.svelte';

	/**
	 * Where this slot's Pokémon stands in Speed against every Pokémon in the
	 * roster, under six assumptions about the rival's investment (one list
	 * each). Read-only: it never writes to the slot.
	 */
	let {
		slot,
		tailwind = false,
		onclose
	}: {
		slot: TeamSlot;
		/** Whether the slot's own team has Tailwind up — only the starting value of this modal's own toggle. */
		tailwind?: boolean;
		onclose: () => void;
	} = $props();

	let activeId = $state(SPEED_LISTS[0].id);
	// Local to the modal: the calculator's own Tailwind is never touched.
	// svelte-ignore state_referenced_locally
	let ownTailwind = $state(tailwind);
	// Same for Scarf: starts from the slot's item, but flipping it here is a what-if.
	// svelte-ignore state_referenced_locally
	let scarfWanted = $state(slot.item?.name === 'Choice Scarf');
	// A Mega holds its Mega Stone, so it can't hold a Scarf.
	const cannotScarf = $derived(slot.species ? isMega(slot.species) : false);
	const ownScarf = $derived(scarfWanted && !cannotScarf);
	let rivalTailwind = $state<Record<string, boolean>>({});
	let includeAbilities = $state(true);
	let search = $state('');

	const list = $derived(SPEED_LISTS.find((l) => l.id === activeId)!);
	const yourSpeed = $derived(
		slot.species
			? ownSpeed({
					baseSpeed: slot.species.baseStats.spe,
					sp: slot.statPoints.spe,
					nature: slot.nature,
					stage: slot.boosts.spe,
					scarf: ownScarf,
					tailwind: ownTailwind
				})
			: 0
	);

	const query = $derived(search.trim().toLowerCase());
	const rows = $derived.by(() => {
		const groups = speedGroups(list, {
			tailwind: rivalTailwind[list.id] ?? false,
			includeAbilities
		});
		const shown: SpeedGroup[] = query
			? groups
					.map((g) => ({
						...g,
						entries: g.entries.filter((e) => e.species.name.toLowerCase().includes(query))
					}))
					.filter((g) => g.entries.length > 0)
			: groups;
		return withYou(shown, yourSpeed);
	});

	function label(e: SpeedEntry): string {
		return e.ability
			? `${e.species.name} (${e.ability}, ${SPEED_CONDITION_LABELS[e.condition!]})`
			: e.species.name;
	}
</script>

<Modal title="Speed check{slot.species ? ` — ${slot.species.name}` : ''}" {onclose}>
	<div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-300">
		<span>
			Your Speed: <strong class="text-sky-300">{yourSpeed}</strong>
		</span>
		<ToggleButton
			class="rounded border border-gray-700"
			active={ownTailwind}
			onclick={() => (ownTailwind = !ownTailwind)}
		>
			Your Tailwind
		</ToggleButton>
		<ToggleButton
			class="rounded border border-gray-700"
			active={ownScarf}
			disabled={cannotScarf}
			title={cannotScarf ? 'A Mega Evolution holds its Mega Stone, not a Scarf' : undefined}
			onclick={() => (scarfWanted = !scarfWanted)}
		>
			Your Scarf
		</ToggleButton>
		<ToggleButton
			class="rounded border border-gray-700"
			active={includeAbilities}
			onclick={() => (includeAbilities = !includeAbilities)}
		>
			Abilities
		</ToggleButton>
	</div>

	<div class="flex flex-wrap gap-1" role="tablist" aria-label="Rival Speed assumption">
		{#each SPEED_LISTS as l (l.id)}
			<button
				type="button"
				role="tab"
				aria-selected={l.id === activeId}
				onclick={() => (activeId = l.id)}
				class="rounded border px-2 py-1 text-[11px] {l.id === activeId
					? 'border-sky-600 bg-sky-900/50 text-sky-100'
					: 'border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700'}"
			>
				{l.label}
			</button>
		{/each}
	</div>

	<div class="flex items-center gap-3 text-xs text-gray-300">
		<input
			type="search"
			bind:value={search}
			placeholder="Filter by name"
			aria-label="Filter Pokémon by name"
			class="min-w-0 flex-1 rounded border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100"
		/>
		<ToggleButton
			class="shrink-0 rounded border border-gray-700"
			active={rivalTailwind[list.id] ?? false}
			onclick={() => (rivalTailwind[list.id] = !rivalTailwind[list.id])}
		>
			Rival Tailwind
		</ToggleButton>
	</div>

	<ul class="flex flex-col gap-1">
		{#each rows as row, i (i)}
			{#if row.kind === 'you'}
				<li
					class="rounded border border-sky-600 bg-sky-900/40 px-2 py-1 text-xs font-medium text-sky-200"
				>
					You are here — {row.speed}
				</li>
			{:else}
				<li
					class="flex items-center gap-2 rounded px-2 py-1 {row.kind === 'tie'
						? 'border border-sky-600 bg-sky-900/40'
						: 'bg-gray-800/60'}"
				>
					<span class="w-10 shrink-0 text-right text-xs font-semibold text-gray-100"
						>{row.group.speed}</span
					>
					<div class="flex flex-wrap items-center gap-0.5">
						{#each row.group.entries as entry (entry.species.name + (entry.ability ?? ''))}
							<span
								title={label(entry)}
								class="relative rounded {entry.ability
									? 'bg-amber-900/50 ring-1 ring-amber-600'
									: ''}"
							>
								<SpeciesSprite species={entry.species} size={32} />
							</span>
						{/each}
					</div>
					{#if row.kind === 'tie'}
						<span class="ml-auto shrink-0 text-[10px] text-sky-200">You tie here</span>
					{/if}
				</li>
			{/if}
		{:else}
			<li class="text-xs text-gray-400">No Pokémon match.</li>
		{/each}
	</ul>
</Modal>
