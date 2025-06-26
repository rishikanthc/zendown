<script lang="ts">
	import type { PageData } from './+page.server';
	import { Button } from '$lib/components/ui/button/index.js';
	import { onMount, onDestroy } from 'svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import AppSidebar from '$lib/components/AppSidebar.svelte';
	import { Menu } from 'lucide-svelte';

	let { data }: { data: PageData } = $props();

	let isSidebarOpen = $state(false);

	function toggleSidebar() {
		isSidebarOpen = !isSidebarOpen;
	}

	function handleKeyDown(event: KeyboardEvent) {
		if ((event.ctrlKey || event.metaKey) && event.key === 'b') {
			event.preventDefault();
			toggleSidebar();
		}
	}

	onMount(() => {
		window.addEventListener('keydown', handleKeyDown);
		return () => {
			window.removeEventListener('keydown', handleKeyDown);
		};
	});
</script>

<Sidebar.Provider bind:open={isSidebarOpen}>
	<AppSidebar />
	<div class="flex min-h-screen w-full flex-col bg-white dark:bg-gray-900">
		<header
			class="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-2 bg-white/80 py-2 backdrop-blur-sm sm:px-6 dark:border-gray-700 dark:bg-gray-800/80"
		>
			<div class="container mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2">
				<div class="flex items-center gap-2">
					<Sidebar.Trigger asChild>
						<Button variant="ghost" size="icon" class="flex-shrink-0">
							<Menu class="h-5 w-5" />
							<span class="sr-only">Toggle Sidebar</span>
						</Button>
					</Sidebar.Trigger>
					<h1 class="font-[Space_Grotesk] text-xl text-gray-800 sm:text-2xl dark:text-gray-200">
						Notes tagged with <span
							class="rounded-md px-2 py-1 font-mono text-blue-600 dark:bg-blue-900/50 dark:text-blue-300"
							>#{data.tag}</span
						>
					</h1>
				</div>
				<Button href="/" variant="ghost" size="sm" class="sm:size-md">Back to All Notes</Button>
			</div>
		</header>

		<main class="container mx-auto max-w-4xl p-4 sm:p-6">
			{#if data.error}
				<div
					class="my-4 rounded border border-red-400 bg-red-100 p-3 text-sm text-red-700 sm:p-4 sm:text-base dark:border-red-600 dark:bg-red-900 dark:text-red-200"
				>
					<p><strong>Error:</strong> {data.error}</p>
				</div>
			{/if}

			{#if data.notes && data.notes.length > 0}
				<ul class="mt-4 space-y-0">
					{#each data.notes as note (note.id)}
						<li
							class="group flex items-center justify-between rounded-md p-0 transition-all hover:bg-gray-50 hover:shadow-sm dark:hover:bg-gray-800/50"
						>
							<a
								href="/{note.canonical_path}"
								class="block flex-grow truncate px-2 py-1 font-[Space_Grotesk] text-sm text-gray-800 hover:text-blue-600 hover:underline sm:text-base dark:text-gray-200"
							>
								{note.title || 'Untitled Note'}
							</a>
						</li>
					{/each}
				</ul>
			{:else if !data.error}
				<div class="py-12 text-center">
					<p class="text-lg text-gray-600 sm:text-xl dark:text-gray-400">
						No notes found with the tag "{data.tag}".
					</p>
				</div>
			{/if}
		</main>
	</div>
</Sidebar.Provider>
