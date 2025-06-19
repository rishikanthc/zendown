<script lang="ts">
	import NotePanel from './NotePanel.svelte';
	import { onMount, onDestroy } from 'svelte';
	import { invalidateAll } from '$app/navigation';
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

	let showNewNoteModal = $state(false);
	let newNotePanelKey = $state(0);

	let showDeleteDialog = $state(false);
	let noteIdToDelete = $state<string | null>(null);
	let noteTitleToDelete = $state<string | null>(null);
	let isDeleting = $state(false);
	let deleteError = $state<string | null>(null);

	const localStorageKey = 'carta-editor-content';

	function openNewNoteModal() {
		if (typeof window !== 'undefined' && window.localStorage) {
			window.localStorage.removeItem(localStorageKey);
		}
		newNotePanelKey += 1;
		showNewNoteModal = true;
		document.body.classList.add('modal-open');
	}

	function closeNewNoteModal() {
		showNewNoteModal = false;
		document.body.classList.remove('modal-open');
	}

	function handleGlobalKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			if (showNewNoteModal) closeNewNoteModal();
			if (showDeleteDialog) closeDeleteDialog();
		}
	}

	function openDeleteDialog(id: string, title: string) {
		noteIdToDelete = id;
		noteTitleToDelete = title;
		deleteError = null;
		showDeleteDialog = true;
		document.body.classList.add('modal-open');
	}

	function closeDeleteDialog() {
		showDeleteDialog = false;
		noteIdToDelete = null;
		noteTitleToDelete = null;
		document.body.classList.remove('modal-open');
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
				closeDeleteDialog(); // Close dialog to show error on main page
			}
		} catch (error) {
			console.error('Error deleting note:', error);
			deleteError = 'An unexpected error occurred while deleting the note.';
			closeDeleteDialog(); // Close dialog on unexpected error too
		} finally {
			isDeleting = false;
		}
	}

	async function handleNoteCreated(newNote: Note) {
		closeNewNoteModal();
		// data.notes will be updated by SvelteKit's reactivity after invalidation
		await invalidateAll(); // Re-run load functions to fetch the latest notes
		// The newNote parameter is kept for potential future use if direct data manipulation is needed
		// for optimistic updates, but for now, we rely on refetching.
	}

	onMount(() => {
		window.addEventListener('keydown', handleGlobalKeyDown);
		return () => {
			window.removeEventListener('keydown', handleGlobalKeyDown);
		};
	});
</script>

<div class="min-h-screen bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100">
	<header class="m-0 w-full bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
		<div class="flex w-full items-center justify-between">
			<h1 class="font-[Megrim] text-3xl text-blue-600 dark:text-blue-400">ZenDown</h1>
			<Button onclick={openNewNoteModal} class="bg-blue-600 text-white hover:bg-blue-700"
				>New Note</Button
			>
		</div>
	</header>

	<main class="container mx-auto max-w-[784px] p-6">
		{#if data.error}
			<div
				class="my-4 rounded border border-red-400 bg-red-100 p-4 text-red-700 dark:border-red-600 dark:bg-red-900 dark:text-red-200"
			>
				<p><strong>Error loading notes:</strong> {data.error}</p>
			</div>
		{/if}

		{#if deleteError}
			<div
				class="my-4 rounded border border-red-400 bg-red-100 p-4 text-red-700 dark:border-red-600 dark:bg-red-900 dark:text-red-200"
			>
				<p><strong>Error deleting note:</strong> {deleteError}</p>
			</div>
		{/if}

		{#if data.notes && data.notes.length > 0}
			<ul class="mt-4">
				{#each data.notes as note (note.id)}
					<li class="group flex items-center justify-between p-0 transition-all hover:shadow-sm">
						<a
							href="/{note.canonical_path}"
							class="px-2 text-base text-gray-800 hover:text-blue-600 hover:underline dark:text-gray-200"
						>
							{note.title}
						</a>
						<Button
							variant="ghost"
							size="icon"
							class="text-gray-500 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-600 focus:opacity-100 dark:text-gray-400 dark:hover:text-red-500"
							onclick={() => openDeleteDialog(note.id, note.title)}
							aria-label="Delete note"
						>
							<Trash2 class="h-5 w-5" />
						</Button>
					</li>
				{/each}
			</ul>
		{:else if !data.error && !(data.notes && data.notes.length > 0)}
			<div class="py-12 text-center">
				<p class="text-xl text-gray-600 dark:text-gray-400">
					No notes found. Click "New Note" to start writing your thoughts.
				</p>
			</div>
		{/if}

		{#if showNewNoteModal}
			<div
				class="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm"
				role="dialog"
				aria-modal="true"
				aria-labelledby="new-note-panel-title"
				onkeydown={(e) => {
					if (e.key === 'Escape') closeNewNoteModal();
				}}
				onclick={closeNewNoteModal}
			>
				<div
					class="h-full max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-lg bg-white shadow-2xl dark:bg-gray-800"
					onclick={(event) => event.stopPropagation()}
				>
					<div class="flex h-full flex-col">
						<div class="flex-grow overflow-y-auto">
							<NotePanel key={newNotePanelKey} onNoteCreated={handleNoteCreated} />
						</div>
					</div>
				</div>
			</div>
		{/if}

		{#if showDeleteDialog && noteIdToDelete}
			<AlertDialog
				bind:open={showDeleteDialog}
				onOpenChange={(open) => {
					if (!open) closeDeleteDialog();
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
						<AlertDialogDescription>
							This action cannot be undone. This will permanently delete the note titled "<strong
								>{noteTitleToDelete || 'Selected Note'}</strong
							>".
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel onclick={closeDeleteDialog} disabled={isDeleting}
							>Cancel</AlertDialogCancel
						>
						<AlertDialogAction
							onclick={handleDeleteConfirm}
							disabled={isDeleting}
							class="bg-red-600 text-white hover:bg-red-700"
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
