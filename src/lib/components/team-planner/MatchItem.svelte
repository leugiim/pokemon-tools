<script lang="ts">
	import { resolve } from '$app/paths';
	import Button from '$lib/components/shared/ui/Button.svelte';
	import { formatDate, RESULT_LABELS, seriesScore, type Match } from '$lib/modules/team-planner';
	import PokeIcon from './PokeIcon.svelte';

	let {
		match,
		speciesByName = {},
		onexport,
		ondelete
	}: {
		match: Match;
		speciesByName?: Record<string, string>;
		onexport: (match: Match) => void;
		ondelete: (match: Match) => void;
	} = $props();

	const benched = (roster: string[], picked: string[]) => roster.filter((n) => !picked.includes(n));

	const badge = $derived(
		match.result === 'win'
			? 'bg-emerald-600/30 text-emerald-300'
			: match.result === 'loss'
				? 'bg-red-600/30 text-red-300'
				: 'bg-gray-700 text-gray-300'
	);
</script>

{#snippet row(label: string, picked: string[], lead: string[], benched: string[])}
	<div class="flex items-center gap-2 text-xs text-gray-400">
		<span class="w-16 shrink-0">{label}</span>
		<span class="flex flex-wrap items-center gap-1">
			{#each picked as name (name)}
				<span class="rounded {lead.includes(name) ? 'ring-2 ring-sky-500' : ''}">
					<PokeIcon {name} species={speciesByName[name]} labelled class="h-8 w-8" />
				</span>
			{/each}
			{#if benched.length > 0}
				<span class="mx-1 h-6 w-px bg-gray-700"></span>
				{#each benched as name (name)}
					<span class="opacity-40"
						><PokeIcon {name} species={speciesByName[name]} labelled class="h-8 w-8" /></span
					>
				{/each}
			{/if}
		</span>
	</div>
{/snippet}

<li class="flex items-start gap-3 rounded-xl border border-gray-800 bg-gray-900 p-3">
	<div
		class="flex h-8 w-16 shrink-0 items-center justify-center rounded-md text-xs font-bold {badge}"
	>
		{RESULT_LABELS[match.result]}
		{#if match.format === 'bo3'}<span class="ml-1 font-normal">{seriesScore(match.games)}</span
			>{/if}
	</div>
	<div class="flex min-w-0 flex-1 flex-col gap-1">
		<div class="text-xs text-gray-500">{formatDate(match.date)}</div>
		{#each match.games as game, i (i)}
			{#if match.format === 'bo3'}
				<div class="mt-1 text-xs font-medium text-gray-300">
					Game {i + 1} · {RESULT_LABELS[game.result]}
				</div>
			{/if}
			{@render row('You', game.selection, game.lead, benched(match.teamRoster, game.selection))}
			{#if game.rivalSelection.length > 0}
				{@render row(
					'Rival',
					game.rivalSelection,
					game.rivalLead,
					benched(match.rivalTeam, game.rivalSelection)
				)}
			{:else if match.rivalTeam.length > 0 && i === 0}
				{@render row('Rival', match.rivalTeam, [], [])}
			{/if}
		{/each}
		{#if match.notes}
			<p class="mt-1 text-xs whitespace-pre-wrap text-gray-300">{match.notes}</p>
		{/if}
	</div>
	<div class="flex shrink-0 gap-1">
		<Button
			size="sm"
			title="Edit"
			href={resolve('/teams/[id]/match/[matchId]', { id: match.teamId, matchId: match.id })}
		>
			Edit
		</Button>
		<Button size="sm" title="Export match" onclick={() => onexport(match)}>Export</Button>
		<Button size="sm" variant="danger" title="Delete match" onclick={() => ondelete(match)}>
			Delete
		</Button>
	</div>
</li>
