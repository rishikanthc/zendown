<script lang="ts">
	import NotePanel from './NotePanel.svelte';
	import { onMount, onDestroy } from 'svelte';
	import type { PageData, NoteTitle } from './+page';
	import { Button } from '$lib/components/ui/button/index.js';
	let { data }: { data: PageData } = $props();

	let showNewNoteModal = $state(false);
	let newNotePanelKey = $state(0);

	const localStorageKey = 'carta-editor-content';

	function openNewNoteModal() {
		if (typeof window !== 'undefined' && window.localStorage) {
			window.localStorage.removeItem(localStorageKey);
		}
		newNotePanelKey += 1;
		showNewNoteModal = true;
	}

	function closeNewNoteModal() {
		showNewNoteModal = false;
	}

	function handleGlobalKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape' && showNewNoteModal) {
			closeNewNoteModal();
		}
	}

	onMount(() => {
		window.addEventListener('keydown', handleGlobalKeyDown);
		return () => {
			window.removeEventListener('keydown', handleGlobalKeyDown);
		};
	});
</script>

<div class="bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100">
	<header class="m-0 w-full bg-white p-0 p-4 dark:bg-gray-800">
		<div class="flex w-full items-center justify-between">
			<h1 class="text-3xl text-blue-600 dark:text-blue-400">Zendown</h1>
			<Button onclick={openNewNoteModal}>New Note</Button>
		</div>
	</header>

	<main class="container mx-auto max-w-[784px] p-6">
		{#if data.error}
			<div class="my-4 rounded border border-red-400 bg-red-100 p-4 text-red-700">
				<p><strong>Error loading notes:</strong> {data.error}</p>
			</div>
		{/if}

		{#if data.notes && data.notes.length > 0}
			<!-- <h2 class="mb-4 text-2xl font-semibold text-gray-700 dark:text-gray-300">Existing Notes</h2> -->
			<ul class="space-y-1">
				{#each data.notes as note (note.id)}
					<li class="bg-white p-1 transition-shadow">
						<a href="/{note.canonical_path}" class="text-md hover:underline dark:text-blue-400">
							{note.title}
						</a>
					</li>
				{/each}
			</ul>
		{:else if !data.error}
			<div class="py-12 text-center">
				<p class="text-xl text-gray-600 dark:text-gray-400">
					No notes found. Click "New Note" to start writing your thoughts.
				</p>
			</div>
		{/if}

		{#if showNewNoteModal}
			<div
				class="fixed inset-0 z-40 flex items-center justify-center bg-white"
				role="dialog"
				aria-modal="true"
				aria-labelledby="new-note-panel-title"
				onclick={closeNewNoteModal}
			>
				<div
					class="h-full max-h-[95vh] w-full max-w-4xl overflow-hidden bg-white dark:bg-gray-800"
					onclick={(event) => event.stopPropagation()}
				>
					<div class="flex h-full flex-col">
						<div class="flex-grow overflow-y-auto">
							<NotePanel key={newNotePanelKey} />
						</div>
					</div>
				</div>
			</div>
		{/if}
	</main>
</div>

<style>
	:global(body.modal-open) {
		overflow: hidden;
	}
	.fixed.inset-0.z-40 {
		z-index: 40;
	}
</style>
