<script lang="ts">
	import NotePanel from './NotePanel.svelte';
	import { onMount, onDestroy } from 'svelte';
	import { invalidateAll, goto } from '$app/navigation';
	import type { PageData } from './+page';
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		AlertDialog,
		AlertDialogAction,
		AlertDialogCancel,
		AlertDialogContent,
		AlertDialogDescription,
		AlertDialogFooter,
		AlertDialogHeader,
		AlertDialogTitle
	} from '$lib/components/ui/alert-dialog/index.js';
	import { Trash2 } from 'lucide-svelte';

	// Define the type for a single note based on your PageData structure
	// This assumes data.notes is an array of objects with at least id, title, canonical_path
	// and other fields returned by the API (like created_on, modified_on)
	type Note = NonNullable<PageData['notes']>[number];

	let { data }: { data: PageData } = $props();

	let showDeleteDialog = $state(false);
	let noteIdToDelete = $state<string | null>(null);
	let noteTitleToDelete = $state<string | null>(null);
	let isDeleting = $state(false);
	let deleteError = $state<string | null>(null);

	const localStorageKey = 'milkdown-editor-content'; // Corrected key

	function handleNewNoteClick() {
		if (typeof window !== 'undefined' && window.localStorage) {
			window.localStorage.removeItem(localStorageKey); // Clear content for a new note
		}
		goto('/notes/new'); // Navigate to the new note page
	}

	function handleGlobalKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			if (showDeleteDialog) closeDeleteDialog();
			// Semantic search dialog escape is handled globally in +layout.svelte
		}
		// Cmd+K for semantic search is handled globally in +layout.svelte
	}

	function openDeleteDialog(id: string, title: string) {
		noteIdToDelete = id;
		noteTitleToDelete = title;
		deleteError = null;
		showDeleteDialog = true;
		if (typeof document !== 'undefined') document.body.classList.add('modal-open');
	}

	function closeDeleteDialog() {
		showDeleteDialog = false;
		noteIdToDelete = null;
		noteTitleToDelete = null;
		if (typeof document !== 'undefined') document.body.classList.remove('modal-open');
	}

	async function handleDeleteConfirm() {
		if (!noteIdToDelete) return;
		isDeleting = true;
		deleteError = null;
		try {
			const response = await fetch(`/api/notes/${noteIdToDelete}`, { method: 'DELETE' });
			if (response.ok) {
				// data.notes will be updated by SvelteKit's reactivity after invalidation
				await invalidateAll(); // Re-run load functions to fetch the latest notes
				closeDeleteDialog();
			} else {
				const errorResult = await response.json();
				deleteError = errorResult.message || `Failed to delete note (status: ${response.status}).`;
				// Keep dialog open to show error or close and show on main page:
				// For now, closing to show on main page as per original logic.
				closeDeleteDialog();
			}
		} catch (error) {
			console.error('Error deleting note:', error);
			deleteError = 'An unexpected error occurred while deleting the note.';
			closeDeleteDialog();
		} finally {
			isDeleting = false;
		}
	}

	onMount(() => {
		if (typeof window !== 'undefined') {
			window.addEventListener('keydown', handleGlobalKeyDown);
		}
		return () => {
			if (typeof window !== 'undefined') {
				window.removeEventListener('keydown', handleGlobalKeyDown);
			}
		};
	});
</script>

<div class="min-h-screen bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100">
	<header class="m-0 w-full bg-white p-4 sm:p-6 dark:border-gray-700 dark:bg-gray-800">
		<div class="container mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2">
			<h1 class="font-[Megrim] text-2xl text-blue-600 sm:text-3xl dark:text-blue-400">ZenDown</h1>
			<Button onclick={handleNewNoteClick} variant="ghost" size="sm" class="sm:size-md"
				>New Note</Button
			>
		</div>
	</header>

	<main class="container mx-auto max-w-4xl p-4 sm:p-6">
		{#if data.error}
			<div
				class="my-4 rounded border border-red-400 bg-red-100 p-3 text-sm text-red-700 sm:p-4 sm:text-base dark:border-red-600 dark:bg-red-900 dark:text-red-200"
			>
				<p><strong>Error loading notes:</strong> {data.error}</p>
			</div>
		{/if}

		{#if deleteError}
			<div
				class="my-4 rounded border border-red-400 bg-red-100 p-3 text-sm text-red-700 sm:p-4 sm:text-base dark:border-red-600 dark:bg-red-900 dark:text-red-200"
			>
				<p><strong>Error deleting note:</strong> {deleteError}</p>
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
						<Button
							variant="ghost"
							size="icon"
							class="mr-1 flex-shrink-0 text-gray-500 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:text-red-600 focus:opacity-100 dark:text-gray-400 dark:hover:text-red-500"
							onclick={() => openDeleteDialog(note.id, note.title || 'Untitled Note')}
							aria-label="Delete note"
						>
							<Trash2 class="h-4 w-4 sm:h-5 sm:w-5" />
						</Button>
					</li>
				{/each}
			</ul>
		{:else if !data.error && !(data.notes && data.notes.length > 0)}
			<div class="py-12 text-center">
				<p class="text-lg text-gray-600 sm:text-xl dark:text-gray-400">
					No notes found. Click "New Note" to start writing your thoughts.
				</p>
			</div>
		{/if}

		{#if showDeleteDialog && noteIdToDelete}
			<AlertDialog
				bind:open={showDeleteDialog}
				onOpenChange={(open) => {
					if (!open) closeDeleteDialog();
				}}
			>
				<AlertDialogContent class="w-[90vw] max-w-md rounded-lg sm:w-full">
					<AlertDialogHeader>
						<AlertDialogTitle class="text-lg sm:text-xl">Are you absolutely sure?</AlertDialogTitle>
						<AlertDialogDescription class="text-sm sm:text-base">
							This action cannot be undone. This will permanently delete the note titled "<strong
								>{noteTitleToDelete || 'Selected Note'}</strong
							>".
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter class="flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:space-x-2">
						<AlertDialogCancel
							onclick={closeDeleteDialog}
							disabled={isDeleting}
							class="w-full sm:w-auto">Cancel</AlertDialogCancel
						>
						<AlertDialogAction
							onclick={handleDeleteConfirm}
							disabled={isDeleting}
							class="w-full bg-red-600 text-white hover:bg-red-700 sm:w-auto"
						>
							{#if isDeleting}
								<svg
									class="mr-2 h-4 w-4 animate-spin"
									xmlns="http://www.w3.org/2000/svg"
									fill="none"
									viewBox="0 0 24 24"
								>
									<circle
										class="opacity-25"
										cx="12"
										cy="12"
										r="10"
										stroke="currentColor"
										stroke-width="4"
									></circle>
									<path
										class="opacity-75"
										fill="currentColor"
										d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
									></path>
								</svg>
								Deleting...
							{:else}
								Delete
							{/if}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		{/if}
	</main>
</div>

<style>
	@import url('https://fonts.googleapis.com/css2?family=Noto+Sans:ital,wght@0,100..900;1,100..900&family=Space+Grotesk:wght@300..700&display=swap');

	:global(body.modal-open) {
		overflow: hidden;
	}
	/* Ensure new note modal and alert dialog are on top */
	.fixed.inset-0.z-40 {
		/* For the new note modal backdrop */
		z-index: 40;
	}
	/* shadcn/ui AlertDialog typically has z-index: 50, which is higher than 40. */
</style>
