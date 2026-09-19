<script lang="ts">
	import type { Result } from '@smogon/calc';
	import {
		MAX_ALLIES_FAINTED,
		type TeamSlot
	} from '$lib/modules/damage-calculator/stores/team.svelte';
	import type { DamageDisplay } from '$lib/modules/damage-calculator/calc/damage';
	import {
		hasDamageComponent,
		multiHitRange,
		scalesWithAlliesFainted,
		type MultiHitRange
	} from '$lib/modules/damage-calculator/calc/moves';
	import type { DamageMatrixAttacker } from '$lib/modules/damage-calculator/calc/matrix';
	import { ATTACK_TYPES } from '$lib/modules/damage-calculator/calc/typeMatchups';
	import { hasTypeShift } from '$lib/modules/damage-calculator/calc/typeShift';
	import TypePicker from '../display/TypePicker.svelte';
	import DamageResult from './DamageResult.svelte';
	import SpeciesSprite from '$lib/components/shared/species/SpeciesSprite.svelte';
	import NumberStepper from '$lib/components/shared/ui/NumberStepper.svelte';
	import ToggleButton from '$lib/components/shared/ui/ToggleButton.svelte';

	let {
		entry,
		ally,
		labelFor
	}: {
		entry: DamageMatrixAttacker | null;
		/** This attacker's own ally — `null` only when `entry` itself is (an unpicked slot has no meaningful ally column either). */
		ally: TeamSlot | null;
		/** "Team A #1: Garchomp"-style label for any slot on either side — owned by `DamageMatrix` since it needs the full `sides` map, not just this one attacker's own table. */
		labelFor: (slot: TeamSlot) => string;
	} = $props();

	/** Every whole hit count a `multiHitRange` allows, for a `<select>`'s options. */
	function hitOptions({ min, max }: MultiHitRange): number[] {
		const options: number[] = [];
		for (let n = min; n <= max; n++) options.push(n);
		return options;
	}

	/**
	 * Which cell is currently "pinned" open below the table — `moveIndex`
	 * (not a `rows` array index, since ally-only moves are filtered out of
	 * `rows`, see `DamageMatrixRow.moveIndex`'s own doc comment) paired with
	 * its target, or `null` for the ally column. `null` overall means
	 * nothing's been clicked yet, in which case `selectedCell` below falls
	 * back to the first row against the first opponent.
	 */
	let pinned = $state<{ moveIndex: number; target: TeamSlot | null } | null>(null);

	interface SelectedCell {
		moveIndex: number;
		target: TeamSlot | null;
		damage: DamageDisplay | null;
	}

	/** Resolves one `(moveIndex, target)` pick against `entry`'s current rows — `null` if that row/target no longer exists (a stale `pinned` pick after the team itself changed). */
	function resolve(moveIndex: number, target: TeamSlot | null): SelectedCell | null {
		const row = entry?.rows.find((r) => r.moveIndex === moveIndex);
		if (!row) return null;
		if (target === null) {
			return row.isAllAdjacentMove ? { moveIndex, target: null, damage: row.allyDamage } : null;
		}
		const cell = row.cells.find((c) => c.target === target);
		return cell ? { moveIndex, target, damage: cell.damage } : null;
	}

	/**
	 * The cell whose full description shows below the table: `pinned` when
	 * it still resolves to a real row/target, else the first row against
	 * the first opponent (per-app convention — "nothing marked" shows the
	 * first attack on the first rival, same default a fresh matchup starts
	 * on). `null` only when there's truly nothing to show (no rows, or no
	 * opponents at all).
	 */
	const selectedCell = $derived.by((): SelectedCell | null => {
		if (!entry || entry.rows.length === 0) return null;
		if (pinned) {
			const resolved = resolve(pinned.moveIndex, pinned.target);
			if (resolved) return resolved;
		}
		const firstOpponent = entry.opponents[0];
		return firstOpponent ? resolve(entry.rows[0].moveIndex, firstOpponent) : null;
	});

	function isSelected(moveIndex: number, target: TeamSlot | null): boolean {
		return selectedCell?.moveIndex === moveIndex && selectedCell?.target === target;
	}

	/** Clicking the already-shown cell unpins it (back to the first-row/first-opponent default) — same click-to-deselect convention `FieldConditionsPicker`'s Weather/Terrain groups use. */
	function selectCell(moveIndex: number, target: TeamSlot | null) {
		pinned = isSelected(moveIndex, target) ? null : { moveIndex, target };
	}

	/**
	 * The raw list of possible damage rolls (16 entries, gen 3+) for
	 * Showdown-calc's own "(104, 108, 108, ...)" convention — `null` for
	 * anything that isn't that flat per-roll shape (a fixed/status 0
	 * "roll", or a multi-hit move's nested per-hit distributions), where
	 * that convention doesn't apply.
	 */
	function damageRolls(result: Result): number[] | null {
		const { damage } = result;
		return Array.isArray(damage) && damage.every((d) => typeof d === 'number')
			? (damage as number[])
			: null;
	}
</script>

<div class="flex flex-col gap-2 rounded-xl border border-gray-800 bg-gray-900 p-3">
	{#if entry === null}
		<p class="text-center text-[11px] text-gray-500">No Pokémon picked.</p>
	{:else}
		{@const { attacker, opponents, rows } = entry}
		{@const showsAllyColumn = rows.some((row) => row.isAllAdjacentMove)}
		{@const showsHitsColumn = rows.some(
			(row) => hasDamageComponent(row.move) && multiHitRange(row.move)
		)}
		{@const usesAlliesFainted =
			attacker.ability === 'Supreme Overlord' ||
			attacker.moves.some((move) => move !== null && scalesWithAlliesFainted(move))}
		<div class="flex items-center justify-between gap-2">
			<h3 class="flex items-center gap-1.5 text-xs font-semibold text-gray-200">
				{#if attacker.species}
					<SpeciesSprite species={attacker.species} size={20} />
				{/if}
				{labelFor(attacker)}
			</h3>
			<div class="flex items-center gap-3">
				<!-- Protean/Libero: which type it has right now (Auto = STAB on every move). -->
				{#if hasTypeShift(attacker.ability)}
					<span
						class="flex items-center gap-1.5 text-[11px] text-gray-400"
						title="The type this Pokémon has right now. Auto gives STAB on every move."
					>
						Current type
						<TypePicker
							bind:value={attacker.currentType}
							types={ATTACK_TYPES}
							ariaLabel="current type for {labelFor(attacker)}"
						/>
					</span>
				{/if}
				<!-- Only Supreme Overlord and Last Respects read this. -->
				{#if usesAlliesFainted}
					<span class="flex items-center gap-1.5 text-[11px] text-gray-400">
						Fainted allies
						<NumberStepper
							value={attacker.alliesFainted}
							min={0}
							max={MAX_ALLIES_FAINTED}
							ariaLabel="fainted allies for {labelFor(attacker)}"
							onChange={(n) =>
								(attacker.alliesFainted = Math.min(
									MAX_ALLIES_FAINTED,
									Math.max(0, Math.round(n) || 0)
								))}
						/>
					</span>
				{/if}
			</div>
		</div>
		{#if opponents.length === 0}
			<p class="text-[11px] text-gray-500">Pick a species for at least one opposing Pokémon.</p>
		{:else if rows.length === 0}
			<p class="text-[11px] text-gray-500">No moves selected yet.</p>
		{:else}
			<!-- Scrolls horizontally within its own card on a narrow viewport
			     (many opponent/ally columns can easily outgrow it) instead of
			     forcing the whole page to scroll sideways. -->
			<div class="overflow-x-auto">
				<table class="w-full min-w-max text-left text-[11px]">
					<thead>
						<tr class="text-gray-400">
							<th class="py-1 pr-2 font-medium">Move</th>
							<th class="py-1 pr-2 font-medium">Crit</th>
							{#if showsHitsColumn}
								<th class="py-1 pr-2 font-medium">Hits</th>
							{/if}
							{#each opponents as opponent (opponent)}
								<th class="py-1 pr-2 font-medium" title={labelFor(opponent)}>
									<div class="flex flex-col items-center gap-0.5">
										{#if opponent.species}
											<SpeciesSprite species={opponent.species} size={20} />
										{/if}
										<span class="text-center leading-tight">{opponent.species?.name}</span>
									</div>
								</th>
							{/each}
							{#if showsAllyColumn}
								<th class="py-1 pr-2 font-medium" title={ally ? labelFor(ally) : 'Ally'}>
									<div class="flex flex-col items-center gap-0.5">
										{#if ally?.species}
											<SpeciesSprite species={ally.species} size={20} />
										{/if}
										<span class="text-center leading-tight">{ally?.species?.name ?? 'Ally'}</span>
									</div>
								</th>
							{/if}
						</tr>
					</thead>
					<tbody>
						{#each rows as { move, moveIndex, cells, isAllAdjacentMove, allyDamage } (moveIndex)}
							{@const damaging = hasDamageComponent(move)}
							{@const range = multiHitRange(move)}
							<tr class="border-t border-gray-800/60">
								<td class="py-1 pr-2 text-gray-200">{move.name}</td>
								<td class="py-1 pr-2">
									<!-- Only a damaging move's crit assumption changes anything it
								     computes — a Status move's row has nothing for it to affect. -->
									{#if damaging}
										<label class="flex items-center gap-1 text-gray-400">
											<input
												type="checkbox"
												bind:checked={attacker.moveOptions[moveIndex].isCrit}
											/>
											<span class="sr-only">Assume critical hit for {move.name}</span>
										</label>
									{/if}
								</td>
								{#if showsHitsColumn}
									<td class="py-1 pr-2">
										{#if damaging && range}
											<select
												class="rounded bg-gray-800 px-1 py-0.5 text-[11px] text-gray-200"
												aria-label="Hit count for {move.name}"
												bind:value={attacker.moveOptions[moveIndex].hits}
											>
												<option value={null}>Auto</option>
												{#each hitOptions(range) as n (n)}
													<option value={n}>{n}</option>
												{/each}
											</select>
										{/if}
									</td>
								{/if}
								{#each cells as { target, damage } (target)}
									<td class="py-1 pr-2 text-center text-gray-100">
										{#if damage}
											<ToggleButton
												class="rounded"
												active={isSelected(moveIndex, target)}
												onclick={() => selectCell(moveIndex, target)}
											>
												<DamageResult {damage} koChanceClass="text-gray-300" />
											</ToggleButton>
										{:else}
											—
										{/if}
									</td>
								{/each}
								{#if showsAllyColumn}
									<td class="py-1 pr-2 text-center text-gray-100">
										{#if allyDamage}
											<ToggleButton
												class="rounded"
												active={isSelected(moveIndex, null)}
												onclick={() => selectCell(moveIndex, null)}
											>
												<DamageResult damage={allyDamage} koChanceClass="text-gray-300" />
											</ToggleButton>
										{:else if isAllAdjacentMove}
											—
										{/if}
									</td>
								{/if}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			{#if selectedCell?.damage}
				{@const result = selectedCell.damage.result}
				{@const rolls = damageRolls(result)}
				<div
					class="rounded border border-gray-800 bg-gray-950 px-2 py-1 font-mono text-[10px] text-gray-300"
				>
					<p>{result.fullDesc('%', false)}</p>
					{#if rolls}
						<p class="text-gray-500">({rolls.join(', ')})</p>
					{/if}
				</div>
			{/if}
		{/if}
	{/if}
</div>
