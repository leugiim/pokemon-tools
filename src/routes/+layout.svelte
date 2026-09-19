<script lang="ts">
	import './layout.css';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import favicon from '$lib/assets/favicon.svg';
	import { CURRENT_REGULATION } from '$lib/modules/shared/species/generation';
	import Footer from '$lib/components/shared/Footer.svelte';

	// Only place the domain is spelled out besides static/sitemap.xml and
	// static/robots.txt.
	const SITE_URL = 'https://vgc-tools.leugiim.es';

	const ROUTES: Record<string, { title: string; description: string }> = {
		'/': {
			title: 'Pokemon Tools — VGC tools for Pokémon Champions',
			description:
				'Competitive Pokémon VGC (doubles) tools: a 2v2 damage calculator and a team planner to track your matches.'
		},
		'/calc': {
			title: 'Damage Calculator — Pokemon Tools',
			description:
				'A competitive Pokémon VGC (doubles) damage calculator: build 2v2 teams and see the full damage matrix — every attacker/move against every opposing target, including doubles-only mechanics like spread damage and ally support.'
		},
		'/teams': {
			title: 'Team Planner — Pokemon Tools',
			description:
				'Keep your VGC teams and track your match history, win rates, leads and toughest opponents.'
		}
	};

	const path = $derived(page.url.pathname.replace(/\/$/, '') || '/');
	// /teams/... pages share the planner's meta.
	const meta = $derived(ROUTES[`/${path.split('/')[1] ?? ''}`] ?? ROUTES['/']);
	const url = $derived(`${SITE_URL}${path === '/' ? '/' : path}`);

	const LINKS = [
		{ href: '/', label: 'Home' },
		{ href: '/calc', label: 'Calculator' },
		{ href: '/teams', label: 'Teams' }
	] as const;

	function isActive(href: string) {
		return href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`);
	}

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" type="image/svg+xml" href={favicon} />
	<link rel="mask-icon" href={favicon} color="#ee1515" />
	<link rel="canonical" href={url} />
	<title>{meta.title}</title>
	<meta name="description" content={meta.description} />
	<meta name="theme-color" content="#030712" />

	<meta property="og:type" content="website" />
	<meta property="og:url" content={url} />
	<meta property="og:title" content={meta.title} />
	<meta property="og:description" content={meta.description} />

	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content={meta.title} />
	<meta name="twitter:description" content={meta.description} />
</svelte:head>

<div class="flex min-h-screen flex-col bg-gray-950">
	<nav
		class="flex items-center gap-1 border-b border-gray-800 px-4 py-2 sm:px-8 lg:px-16"
		aria-label="Main"
	>
		<span class="mr-3 text-sm font-bold text-gray-100">Pokemon Tools</span>
		{#each LINKS as link (link.href)}
			<a
				href={resolve(link.href)}
				aria-current={isActive(link.href) ? 'page' : undefined}
				class="rounded-md px-3 py-1 text-sm {isActive(link.href)
					? 'bg-gray-800 text-gray-100'
					: 'text-gray-400 hover:text-gray-200'}"
			>
				{link.label}
			</a>
		{/each}
		<span
			class="ml-auto rounded border border-gray-700 px-2 py-0.5 text-xs text-gray-300"
			title="The Pokémon picker follows this regulation"
		>
			Current: {CURRENT_REGULATION}
		</span>
	</nav>
	<main class="flex flex-1 flex-col">
		{@render children()}
	</main>
	<div class="px-4 pb-4 sm:px-8 lg:px-16">
		<Footer />
	</div>
</div>
