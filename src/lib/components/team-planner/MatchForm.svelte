<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Button from '$lib/components/shared/ui/Button.svelte';
	import {
		generateId,
		handoffIdOfResultKey,
		parseTeamPaste,
		readHandoffResult,
		writeHandoff,
		type HandoffMember,
		type PokemonSetData
	} from '$lib/modules/shared';
	import {
		canAddGame,
		displayName,
		emptyGame,
		gamesForFormat,
		LEAD_SIZE,
		MAX_GAMES,
		matchResult,
		padRivalSlots,
		RIVAL_TEAM_SIZE,
		planner,
		RESULT_LABELS,
		SELECTION_SIZE,
		syncRivalPicks,
		toggleLead,
		toggleSelection,
		validateMatch,
		type Game,
		type GameDraft,
		type MatchFormat,
		type MatchResult,
		type Team
	} from '$lib/modules/team-planner';
	import PokeToggleGroup from './PokeToggleGroup.svelte';
	import { findSpecies } from '$lib/modules/shared/species/generation';
	import SpeciesField from './SpeciesField.svelte';

	/** Records a match for `team`, or edits the match `matchId`. */
	let { team, matchId = undefined }: { team: Team; matchId?: string } = $props();

	const RESULTS: MatchResult[] = ['win', 'loss', 'ongoing'];
	const FORMATS: { value: MatchFormat; label: string }[] = [
		{ value: 'bo1', label: 'Bo1' },
		{ value: 'bo3', label: 'Bo3' }
	];

	// The saved match (when editing) seeds the fields once; they're the
	// reader's own from then on.
	// svelte-ignore state_referenced_locally
	const original = matchId
		? (planner.loadMatches(team.id).find((m) => m.id === matchId) ?? null)
		: null;

	let format = $state<MatchFormat>(original?.format ?? 'bo1');
	let games = $state<GameDraft[]>(original ? original.games.map((g) => ({ ...g })) : [emptyGame()]);
	// Which game of a Bo3 the fields below show.
	let activeGame = $state(0);
	let rivalTeam = $state(padRivalSlots(original?.rivalTeam ?? []));
	let notes = $state(original?.notes ?? '');
	// Full rival sets, from a pasted team or edited in the calculator.
	let rivalSets = $state<PokemonSetData[]>(original?.rivalSets ?? []);
	let rivalPaste = $state(original?.rivalPaste ?? '');
	let rivalPasteText = $state(original?.rivalPaste ?? '');
	let rivalNotice = $state('');
	let rivalNoticeIsError = $state(false);
	let pasteOpen = $state(!!original?.rivalPaste);
	// Ties this form to the calculator tab it opens.
	const handoffId = generateId();
	let error = $state('');

	const game = $derived(games[activeGame]);
	// "Game 2 your lead" in a Bo3, "Your lead" otherwise.
	const title = (text: string) =>
		format === 'bo3' ? `Game ${activeGame + 1} ${text}` : text[0].toUpperCase() + text.slice(1);
	const canAdd = $derived(canAddGame(format, games));
	const ownNames = $derived(team.pokemon.map(displayName));
	const rivalFilled = $derived(rivalTeam.map((n) => n.trim()).filter(Boolean));
	// The same Pokémon twice on their team is one choice to pick from.
	const rivalChoices = $derived([...new Set(rivalFilled)]);
	const speciesByName = $derived(
		Object.fromEntries(team.pokemon.map((p) => [displayName(p), p.species]))
	);
	const backHref = $derived(resolve('/teams/[id]', { id: team.id }));

	function setFormat(next: MatchFormat) {
		// The notes move with the format: a Bo3 keeps them per game, a Bo1 on the match.
		if (next === 'bo3' && format === 'bo1' && notes.trim() && !games[0].notes) {
			games[0].notes = notes;
			notes = '';
		} else if (next === 'bo1' && format === 'bo3' && !notes.trim() && games[0].notes) {
			notes = games[0].notes;
		}
		format = next;
		games = gamesForFormat(next, games);
		activeGame = Math.min(activeGame, games.length - 1);
	}

	function addGame() {
		if (!canAdd) return;
		games = [...games, emptyGame()];
		activeGame = games.length - 1;
	}

	function removeGame(i: number) {
		if (games.length <= 1) return;
		games = games.filter((_, index) => index !== i);
		activeGame = Math.min(activeGame, games.length - 1);
	}

	function pickOwn(name: string) {
		({ selection: game.selection, lead: game.lead } = toggleSelection(game, name));
	}

	function pickRival(name: string) {
		({ selection: game.rivalSelection, lead: game.rivalLead } = toggleSelection(
			{ selection: game.rivalSelection, lead: game.rivalLead },
			name
		));
	}

	// Changing a rival's name only drops the picks that no longer exist, in every game.
	function onRivalChange() {
		for (const g of games) {
			({ selection: g.rivalSelection, lead: g.rivalLead } = syncRivalPicks(rivalTeam, {
				selection: g.rivalSelection,
				lead: g.rivalLead
			}));
		}
	}

	const norm = (name: string) => name.trim().toLowerCase();
	const isSetOf = (set: PokemonSetData, name: string) =>
		norm(set.nickname || set.species) === norm(name) || norm(set.species) === norm(name);

	/** The two teams as they are in the form now, for the calculator. */
	function openCalculator() {
		if (!applyPendingRivalPaste()) return;
		const roster = original?.teamRoster ?? [];
		const inRoster = team.pokemon.filter((p) =>
			roster.some((n) => norm(n) === norm(displayName(p)))
		);
		const own: HandoffMember[] = (inRoster.length > 0 ? inRoster : team.pokemon).map((p) => ({
			name: displayName(p),
			set: p
		}));
		const rival: HandoffMember[] = rivalFilled.map((name) => ({
			name,
			set: rivalSets.find((s) => isSetOf(s, name))
		}));

		const stored = writeHandoff(handoffId, {
			createdAt: Date.now(),
			teamId: team.id,
			teamName: team.name,
			own,
			ownLead: game.lead,
			rival,
			rivalLead: game.rivalLead
		});
		if (!stored) {
			error = "Couldn't open the calculator (browser storage unavailable).";
			return;
		}
		window.open(`${resolve('/calc')}?handoff=${encodeURIComponent(handoffId)}`, '_blank');
	}

	// The calculator tab saves the rival sets it ends up with under this form's key.
	function onStorage(e: StorageEvent) {
		if (handoffIdOfResultKey(e.key) !== handoffId) return;
		const result = readHandoffResult(handoffId);
		if (!result) return;
		rivalSets = result.rivalSets;
		rivalNotice = `${result.rivalSets.length} rival sets updated from the calculator.`;
		rivalNoticeIsError = false;
	}

	/**
	 * Fills the opposing team (names and sets) from a pasted team. Only the
	 * Pokémon whose species is known are used (up to 6); the others are named
	 * in the message. Returns whether any Pokémon was found.
	 */
	function applyRivalPaste(): boolean {
		const parsed = parseTeamPaste(rivalPasteText);
		const sets = parsed.filter((set) => findSpecies(set.species)).slice(0, RIVAL_TEAM_SIZE);
		const unknown = parsed.filter((set) => !findSpecies(set.species)).map((set) => set.species);
		if (sets.length === 0) {
			rivalNotice = "Couldn't find any Pokémon in that paste.";
			rivalNoticeIsError = true;
			return false;
		}
		rivalSets = sets;
		rivalPaste = rivalPasteText.trim();
		rivalTeam = padRivalSlots(sets.map((set) => set.species));
		onRivalChange();
		rivalNotice =
			`${sets.length} Pokémon from the paste are now in the opposing team.` +
			(unknown.length > 0 ? ` Not recognized, left out: ${unknown.join(', ')}.` : '');
		rivalNoticeIsError = false;
		return true;
	}

	/**
	 * Text pasted but not yet applied (the reader went straight to Save or to
	 * the calculator) is applied first, so its Pokémon end up in the opposing
	 * team. Returns false, with the reason in `error`, if it can't be read.
	 */
	function applyPendingRivalPaste(): boolean {
		const text = rivalPasteText.trim();
		if (!text || text === rivalPaste) return true;
		if (applyRivalPaste()) return true;
		pasteOpen = true;
		error = "Couldn't find any Pokémon in the pasted opposing team.";
		return false;
	}

	function save() {
		if (!applyPendingRivalPaste()) return;
		error = validateMatch({ format, games }) ?? '';
		if (error) return;
		// Validated: every game has its result now.
		const saved = games as Game[];

		planner.saveMatch({
			// Editing keeps the rival sets and paste that this form doesn't show.
			...original,
			id: original?.id ?? generateId(),
			teamId: team.id,
			date: original?.date ?? Date.now(),
			format,
			games: saved.map((g) => ({ ...g, notes: g.notes?.trim() || undefined })),
			result: matchResult(format, saved),
			teamRoster: original?.teamRoster ?? ownNames,
			rivalTeam: rivalFilled,
			// Only the sets of Pokémon that are still on the opposing team.
			rivalSets: rivalSets.some((set) => rivalFilled.some((name) => isSetOf(set, name)))
				? rivalSets.filter((set) => rivalFilled.some((name) => isSetOf(set, name)))
				: undefined,
			rivalPaste: rivalPaste || undefined,
			notes: format === 'bo3' ? '' : notes.trim()
		});
		goto(backHref);
	}

	const label = 'text-sm font-medium text-gray-200';
	const hint = 'text-xs font-normal text-gray-500';
</script>

<svelte:window onstorage={onStorage} />

<div class="flex flex-col gap-6">
	<section class="flex flex-col gap-2">
		<span class={label}>Opposing team <span class={hint}>(optional, up to 6 Pokémon)</span></span>
		<details class="text-sm" bind:open={pasteOpen}>
			<summary class="cursor-pointer text-gray-300">Paste the opposing team (optional)</summary>
			<div class="mt-2 flex flex-col gap-2">
				<textarea
					bind:value={rivalPasteText}
					rows="8"
					spellcheck="false"
					placeholder="Paste their Pokepaste to get full sets for the calculator…"
					class="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 font-mono text-xs text-gray-100 placeholder:text-gray-500"
				></textarea>
				<div><Button size="sm" onclick={applyRivalPaste}>Use this paste</Button></div>
			</div>
		</details>
		{#if rivalNotice}
			<p class="text-xs {rivalNoticeIsError ? 'text-red-400' : 'text-emerald-400'}">
				{rivalNotice}
			</p>
		{/if}

		<div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
			{#each [...rivalTeam.keys()] as i (i)}
				<SpeciesField bind:value={rivalTeam[i]} onchange={onRivalChange} />
			{/each}
		</div>
	</section>

	<section class="flex flex-col gap-2">
		<span class={label}>Calculator</span>
		<div class="flex flex-wrap items-center gap-3">
			<Button onclick={openCalculator}>Open in calculator</Button>
			<span class={hint}>
				Opens in a new tab with your whole team and the opposing team ({rivalFilled.length}
				named, {rivalSets.length} with a set). Nothing you typed here is lost.
			</span>
		</div>
	</section>

	<section class="flex flex-col gap-2">
		<span class={label}>Format</span>
		<div class="flex gap-2">
			{#each FORMATS as f (f.value)}
				<Button
					class={format === f.value ? 'ring-2 ring-sky-500' : ''}
					variant={format === f.value ? 'primary' : 'secondary'}
					onclick={() => setFormat(f.value)}
				>
					{f.label}
				</Button>
			{/each}
		</div>
	</section>

	{#if format === 'bo3'}
		<section class="flex flex-wrap items-center gap-2" aria-label="Games">
			{#each games as g, i (i)}
				<Button
					size="sm"
					class={activeGame === i ? 'ring-2 ring-sky-500' : ''}
					variant={activeGame === i ? 'primary' : 'secondary'}
					onclick={() => (activeGame = i)}
				>
					Game {i + 1}{g.result ? ` · ${RESULT_LABELS[g.result]}` : ''}
				</Button>
			{/each}
			{#if canAdd}
				<Button size="sm" onclick={addGame}>+ Add game {games.length + 1}</Button>
			{/if}
			{#if games.length > 1}
				<Button size="sm" variant="danger" onclick={() => removeGame(activeGame)}>
					Remove game {activeGame + 1}
				</Button>
			{/if}
			<span class={hint}
				>Match: {RESULT_LABELS[
					matchResult(
						format,
						games.filter((g): g is Game => g.result !== '')
					)
				]} (max {MAX_GAMES[format]} games)</span
			>
		</section>
	{/if}

	<section class="flex flex-col gap-2">
		<span class={label}>{format === 'bo3' ? `Game ${activeGame + 1} result` : 'Result'}</span>
		<div class="flex gap-2">
			{#each RESULTS as r (r)}
				<Button
					class={game.result === r ? 'ring-2 ring-sky-500' : ''}
					variant={game.result === r ? 'primary' : 'secondary'}
					onclick={() => (game.result = r)}
				>
					{RESULT_LABELS[r]}
				</Button>
			{/each}
		</div>
	</section>

	<section class="flex flex-col gap-2">
		<span class={label}>
			{title('your selection')}
			<span class={hint}>({game.selection.length}/{SELECTION_SIZE} selected)</span>
		</span>
		<PokeToggleGroup
			names={ownNames}
			selected={game.selection}
			ontoggle={pickOwn}
			{speciesByName}
		/>
	</section>

	{#if game.selection.length === SELECTION_SIZE}
		<section class="flex flex-col gap-2">
			<span class={label}
				>{title('your lead')}
				<span class={hint}>({game.lead.length}/{LEAD_SIZE} selected)</span></span
			>
			<PokeToggleGroup
				names={game.selection}
				selected={game.lead}
				ontoggle={(name) => (game.lead = toggleLead(game.lead, name))}
				{speciesByName}
			/>
		</section>
	{/if}

	<section class="flex flex-col gap-2">
		{#if rivalChoices.length >= 2}
			<span class="{label} mt-2">
				{title('opposing selection')}
				<span class={hint}>({game.rivalSelection.length}/{SELECTION_SIZE})</span>
			</span>
			<PokeToggleGroup names={rivalChoices} selected={game.rivalSelection} ontoggle={pickRival} />
		{/if}

		{#if game.rivalSelection.length >= 2}
			<span class="{label} mt-2">
				{title('opposing lead')} <span class={hint}>({game.rivalLead.length}/{LEAD_SIZE})</span>
			</span>
			<PokeToggleGroup
				names={game.rivalSelection}
				selected={game.rivalLead}
				ontoggle={(name) => (game.rivalLead = toggleLead(game.rivalLead, name))}
			/>
		{/if}
	</section>

	<section class="flex flex-col gap-1">
		<label for="match-notes" class={label}
			>{title('notes')} <span class={hint}>(optional)</span></label
		>
		<textarea
			id="match-notes"
			value={format === 'bo3' ? (game.notes ?? '') : notes}
			oninput={(e) => {
				if (format === 'bo3') game.notes = e.currentTarget.value;
				else notes = e.currentTarget.value;
			}}
			rows="4"
			placeholder="Key crit, missed move, turning point…"
			class="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500"
		></textarea>
	</section>

	{#if error}
		<p class="text-sm text-red-400">{error}</p>
	{/if}

	<div class="flex justify-end gap-2">
		<Button href={backHref}>Cancel</Button>
		<Button variant="primary" onclick={save}>{matchId ? 'Save changes' : 'Save match'}</Button>
	</div>
</div>
