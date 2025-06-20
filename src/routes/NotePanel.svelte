<script lang="ts">
	import { Carta, MarkdownEditor, type Plugin as CartaPlugin } from 'carta-md';
	import { onMount, onDestroy } from 'svelte';
	import 'carta-md/default.css';
	import { Eye, Pencil, Menu, Save } from 'lucide-svelte';
	import { getCartaInstance } from './getCarta';
	import './tw.css';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import AppSidebar from '../lib/components/AppSidebar.svelte';

	type NewNoteData = any;

	interface RelatedNote {
		id: string;
		title: string;
		canonical_path: string;
		score: number;
	}

	let relatedNotes = $state<RelatedNote[]>([]);
	let isLoadingRelatedNotes = $state(false);
	let relatedNotesError = $state<string | null>(null);

	let isDirty = $state(false);
	const AUTO_SAVE_INTERVAL = 3000; // 3 seconds
	let autoSaveDebounceTimer: number | undefined; // Timer for debounced auto-save
	let lastInputTimestamp = $state(Date.now()); // Ensures effect re-runs on each input
	let isAutoSaving = $state(false); // Prevents overlapping auto-save calls

	let {
		key,
		initialContent,
		id: initialId,
		onNoteCreated
	}: {
		key?: number;
		initialContent?: string;
		id?: string;
		onNoteCreated?: (newNote: NewNoteData) => void | Promise<void>;
	} = $props();

	let currentNoteId = $state(initialId);

	const changeListenerPlugin: CartaPlugin = {
		listeners: [
			[
				'input', // Listen to the 'input' event on the textarea element within Carta
				() => {
					isDirty = true;
					lastInputTimestamp = Date.now(); // Update timestamp on every input
				}
			]
		]
	};

	const carta = getCartaInstance('light', false, [changeListenerPlugin]);
	const localStorageKey = 'carta-editor-content';

	const defaultNewNoteValue = '# Start typing your title here\n\nAnd your content below...';

	let noteValue = $state(
		(() => {
			if (initialContent !== undefined) {
				return initialContent;
			}
			if (typeof window !== 'undefined' && window.localStorage) {
				return window.localStorage.getItem(localStorageKey) ?? defaultNewNoteValue;
			}
			return defaultNewNoteValue;
		})()
	);

	let debounceTimer: number | undefined;

	$effect(() => {
		const valueToSave = noteValue;
		if (
			currentNoteId === undefined &&
			initialContent === undefined &&
			typeof window !== 'undefined' &&
			window.localStorage
		) {
			clearTimeout(debounceTimer);
			debounceTimer = window.setTimeout(() => {
				window.localStorage.setItem(localStorageKey, valueToSave);
			}, 500);
		}
		return () => {
			clearTimeout(debounceTimer);
		};
	});

	let currentMode = $state<'write' | 'preview'>('write');
	let saveStatusMessage = $state('');

	const wordCount = $derived(
		noteValue.trim() === '' ? 0 : noteValue.trim().split(/\s+/).filter(Boolean).length
	);

	function extractTitleFromMarkdown(markdown: string): string | null {
		if (!markdown) return null;
		const match = markdown.match(/^(?:#\s+)(.+)$/m);
		if (match && match[1]) {
			return match[1].trim();
		}
		return null;
	}

	async function saveNote(options?: { isAutoSave?: boolean }): Promise<boolean> {
		const title = extractTitleFromMarkdown(noteValue);
		const isAutoSave = options?.isAutoSave ?? false;

		if (!title) {
			// For manual saves, show an error message and alert.
			// For auto-saves, this will fail silently, note remains dirty.
			if (!isAutoSave) {
				const message =
					'Error: A title (H1 heading, e.g., "# Your Title") is required to save the note.';
				saveStatusMessage = message;
				if (typeof window !== 'undefined') window.alert(message);
				setTimeout(() => {
					if (saveStatusMessage === message) saveStatusMessage = '';
				}, 5000);
			}
			return false; // Save failed
		}

		// Show "Saving..." only for manual saves
		if (!isAutoSave) {
			saveStatusMessage = 'Saving...';
		}
		// For auto-save, we don't set "Saving...".
		// Any existing message will be replaced by "Saved" on success, or cleared by its own timeout.
		let response;
		let requestBody;
		let apiUrl: string;
		const isNewNote = !currentNoteId;

		if (isNewNote) {
			apiUrl = '/api/notes/create';
			requestBody = { content: noteValue };
		} else {
			apiUrl = '/api/notes/update';
			requestBody = { id: currentNoteId, content: noteValue };
		}

		try {
			response = await fetch(apiUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(requestBody)
			});

			let responseData;
			const contentType = response.headers.get('content-type');
			if (contentType && contentType.includes('application/json')) {
				responseData = await response.json();
			} else {
				responseData = {
					message: response.statusText || 'Received non-JSON response from server.'
				};
			}

			if (response.ok) {
				const savedTitle = responseData.title || title;
				let successMessage: string;

				if (isAutoSave) {
					successMessage = 'Saved'; // Simple message for auto-save
				} else {
					successMessage = `Note '${savedTitle}' saved successfully!`;
				}
				saveStatusMessage = successMessage;

				// Clear success message after a delay
				// Shorter delay for "Saved" from auto-save
				setTimeout(
					() => {
						if (saveStatusMessage === successMessage) saveStatusMessage = '';
					},
					isAutoSave ? 1500 : 3000
				);

				if (isNewNote && responseData.id) {
					currentNoteId = responseData.id;
					if (typeof window !== 'undefined' && window.localStorage) {
						window.localStorage.removeItem(localStorageKey);
					}
					if (onNoteCreated) {
						await onNoteCreated(responseData);
					}
				}
				isDirty = false; // Reset dirty flag on successful save (for both auto and manual)
				return true;
			} else {
				const errorMessage = `Error saving note: ${responseData.message || response.statusText || 'Unknown server error.'}`;
				if (!isAutoSave) {
					saveStatusMessage = errorMessage;
					// Clear error message after a delay
					setTimeout(() => {
						if (saveStatusMessage === errorMessage) saveStatusMessage = '';
					}, 5000);
				}
				if (!isAutoSave && typeof window !== 'undefined') window.alert(errorMessage);
				return false;
			}
		} catch (error: any) {
			console.error('Failed to save note:', error);
			const networkErrorMessage = `Failed to save note: ${error?.message || 'A network or client-side error occurred.'}`;
			if (!isAutoSave) {
				saveStatusMessage = networkErrorMessage;
				// Clear network error message after a delay
				setTimeout(() => {
					if (saveStatusMessage === networkErrorMessage) saveStatusMessage = '';
				}, 5000);
			}
			if (!isAutoSave && typeof window !== 'undefined') window.alert(networkErrorMessage);
			return false;
		}
	}

	async function fetchRelatedNotes(noteId: string) {
		if (!noteId) return;
		isLoadingRelatedNotes = true;
		relatedNotesError = null;
		relatedNotes = [];

		try {
			const response = await fetch(`/api/notes/related?id=${noteId}`);
			if (!response.ok) {
				const errorData = await response.json().catch(() => ({ message: response.statusText }));
				throw new Error(errorData.message || `Failed to fetch related notes: ${response.status}`);
			}
			const data = (await response.json()) as RelatedNote[];
			relatedNotes = data;
		} catch (err: any) {
			relatedNotesError = err.message || 'An unknown error occurred while fetching related notes.';
			console.error('Error fetching related notes:', err);
		} finally {
			isLoadingRelatedNotes = false;
		}
	}

	function togglePreviewMode() {
		currentMode = currentMode === 'write' ? 'preview' : 'write';
	}

	const handleKeyDown = (event: KeyboardEvent) => {
		if ((event.ctrlKey || event.metaKey) && event.key === 'p') {
			event.preventDefault();
			togglePreviewMode();
		} else if ((event.ctrlKey || event.metaKey) && event.key === 's') {
			event.preventDefault();
			saveNote();
		}
	};

	onMount(() => {
		if (typeof window !== 'undefined') {
			window.addEventListener('keydown', handleKeyDown);
		}
		if (initialContent === '' && noteValue !== defaultNewNoteValue) {
			noteValue = defaultNewNoteValue;
		} else if (initialContent && noteValue !== initialContent) {
			noteValue = initialContent;
		}

		return () => {
			if (typeof window !== 'undefined') {
				window.removeEventListener('keydown', handleKeyDown);
			}
			clearTimeout(debounceTimer);
		};
	});

	$effect(() => {
		if (initialId !== undefined) {
			currentNoteId = initialId;
		}
		if (initialContent !== undefined) {
			noteValue = initialContent;
			if (currentNoteId && typeof window !== 'undefined' && window.localStorage) {
				window.localStorage.removeItem(localStorageKey);
			}
		} else if (currentNoteId === undefined) {
			if (typeof window !== 'undefined' && window.localStorage) {
				noteValue = window.localStorage.getItem(localStorageKey) ?? defaultNewNoteValue;
			} else {
				noteValue = defaultNewNoteValue;
			}
		}
	});

	$effect(() => {
		if (currentNoteId && currentMode === 'preview') {
			fetchRelatedNotes(currentNoteId);
		} else {
			relatedNotes = [];
			isLoadingRelatedNotes = false;
			relatedNotesError = null;
		}
	});

	// Debounced auto-save effect
	$effect(() => {
		const _timestamp = lastInputTimestamp; // Read to make it a dependency for the effect

		if (typeof window !== 'undefined') {
			if (!isDirty) {
				clearTimeout(autoSaveDebounceTimer);
				autoSaveDebounceTimer = undefined;
				return; // No need to set up a new timer if not dirty
			}

			// If dirty, set up or reset the debounce timer
			clearTimeout(autoSaveDebounceTimer);
			autoSaveDebounceTimer = window.setTimeout(async () => {
				// Only proceed if still dirty AND an auto-save isn't already in progress
				if (isDirty && !isAutoSaving) {
					isAutoSaving = true;
					// console.log('Auto-save: Attempting to save due to inactivity...'); // Optional: for debugging
					await saveNote({ isAutoSave: true });
					// isDirty is set to false within saveNote on successful save
					isAutoSaving = false;
				}
			}, AUTO_SAVE_INTERVAL);

			// Cleanup function for the effect when dependencies change or component unmounts
			return () => {
				clearTimeout(autoSaveDebounceTimer);
			};
		}
	});
</script>

<Sidebar.Provider>
	{#if currentNoteId}
		<AppSidebar />
	{/if}

	<div class="flex min-h-screen w-full flex-col bg-white p-2 dark:bg-gray-900">
		<header
			class="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-2 bg-white px-4 py-3 sm:px-6 dark:bg-gray-800"
		>
			<div class="flex flex-shrink-0 items-center gap-2">
				{#if currentNoteId}
					<Sidebar.Trigger asChild>
						<Button
							variant="secondary"
							size="icon"
							title="Toggle Sidebar (Ctrl+B or Cmd+B)"
							class="flex-shrink-0"
						>
							<Menu class="h-5 w-5" />
							<span class="sr-only">Toggle navigation sidebar</span>
						</Button>
					</Sidebar.Trigger>
				{/if}
				<a
					href="/"
					class="rounded-0 inline-flex flex-shrink-0 items-center px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none dark:text-gray-200 dark:hover:bg-gray-700"
				>
					Back to Notes
				</a>
			</div>
			<div class="flex items-center gap-2">
				<div class="relative">
					<Button
						on:click={saveNote}
						variant="secondary"
						size="icon"
						title="Save note (Ctrl+S or Cmd+S)"
						class="flex-shrink-0"
					>
						<Save stroke-width={2} class="h-5 w-5 rounded-sm sm:h-6 sm:w-6" />
					</Button>
					{#if isDirty}
						<span
							class="bg-magenta-400 absolute top-0 right-0 -mt-1 -mr-1 flex h-2 w-2 items-center justify-center rounded-full ring-2 ring-white dark:ring-gray-800"
							title="Unsaved changes"
						>
							<span class="sr-only">Unsaved changes</span>
						</span>
					{/if}
				</div>

				<Button
					onclick={togglePreviewMode}
					variant="secondary"
					size="icon"
					title="Toggle edit/preview (Ctrl+P or Cmd+P)"
					class="flex-shrink-0"
				>
					{#if currentMode === 'write'}
						<Eye stroke-width={2} class="h-5 w-5 rounded-sm sm:h-6 sm:w-6" />
					{:else}
						<Pencil stroke-width={2} class="h-5 w-5 rounded-sm sm:h-6 sm:w-6" />
					{/if}
				</Button>
			</div>
		</header>

		<div
			class="prose prose-base dark:prose-invert prose-headings:font-[Space_Grotesk] prose-headings:text-gray-800 mx-auto w-full max-w-[800px] flex-grow px-2 py-4 font-[Noto_Sans] text-gray-700 sm:px-4 md:px-6 md:py-6 dark:text-gray-100"
		>
			<MarkdownEditor
				{carta}
				bind:value={noteValue}
				disableToolbar={true}
				theme="tw"
				scroll="sync"
				mode="tabs"
				selectedTab={currentMode}
			/>
		</div>

		{#if currentMode === 'preview' && currentNoteId}
			<div
				class="mx-auto w-full max-w-[800px] px-2 py-4 text-gray-700 sm:px-4 md:px-6 md:py-6 dark:text-gray-100"
				role="region"
				aria-labelledby="related-notes-heading"
			>
				<h2
					id="related-notes-heading"
					class="mb-3 border-b pb-2 font-[Space_Grotesk] text-lg font-semibold sm:text-xl dark:border-gray-700"
				>
					Related Notes
				</h2>
				{#if isLoadingRelatedNotes}
					<p class="text-sm sm:text-base">Loading related notes...</p>
				{:else if relatedNotesError}
					<p class="text-sm text-red-500 sm:text-base dark:text-red-400">
						Error: {relatedNotesError}
					</p>
				{:else if relatedNotes.length > 0}
					<ul
						class="list-none space-y-2 pl-0 text-sm sm:text-base md:list-disc md:space-y-1 md:pl-5"
					>
						{#each relatedNotes as note}
							<li>
								<a
									href="/{note.canonical_path}"
									class="font-[Noto_Sans] text-blue-600 hover:underline dark:text-blue-400"
								>
									{note.title}
								</a>
								<span class="ml-1 text-xs text-gray-500 sm:text-sm dark:text-gray-400">
									(Score: {note.score.toFixed(3)})
								</span>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="text-sm sm:text-base">No related notes found.</p>
				{/if}
			</div>
		{/if}

		<footer
			class="fixed right-0 bottom-0 z-30 flex items-center justify-end px-2 py-1 text-xs sm:px-4 sm:py-2 sm:text-sm"
		>
			<div class="text-gray-600 dark:text-gray-400">Word Count: {wordCount}</div>
		</footer>

		{#if saveStatusMessage}
			<div
				class="fixed right-2 bottom-12 z-[100] rounded-md px-3 py-2 text-xs font-medium shadow-lg sm:right-5 sm:bottom-16 sm:px-4 sm:py-3 sm:text-sm md:bottom-[calc(theme(spacing.10)_+_0.5rem)] lg:bottom-16"
				class:text-white={true}
				class:bg-blue-600={saveStatusMessage.startsWith('Saving') ||
					saveStatusMessage.includes('successfully') ||
					saveStatusMessage === 'Saved'}
				class:bg-red-600={saveStatusMessage.toLowerCase().includes('error')}
				class:bg-gray-700={!saveStatusMessage.toLowerCase().includes('error') &&
					!(saveStatusMessage.includes('successfully') || saveStatusMessage === 'Saved') &&
					!saveStatusMessage.startsWith('Saving')}
				role="status"
				aria-live="polite"
			>
				{saveStatusMessage}
			</div>
		{/if}
	</div>
</Sidebar.Provider>

<style>
	@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;1,100;1,200;1,300;1,400;1,500;1,600;1,700&family=IBM+Plex+Serif:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;1,100;1,200;1,300;1,400;1,500;1,600;1,700&family=Noto+Sans+Mono:wght@100..900&family=Noto+Sans:ital,wght@0,100..900;1,100..900&family=Noto+Serif:ital,wght@0,100..900;1,100..900&family=Nunito:ital,wght@0,200..1000;1,200..1000&display=swap');
	@import url('https://fonts.googleapis.com/css2?family=Noto+Sans:ital,wght@0,100..900;1,100..900&family=Space+Grotesk:wght@300..700&family=Space+Mono:ital,wght@0,400;0,700;1,400;1,700&display=swap');

	/* Ensure the main content area can grow to fill available space, especially if related notes are not shown */
	.prose {
		/* A fallback min-height. Adjust based on your header/footer/other fixed elements' combined height. */
		/* This helps prevent a very short editor on large screens if content is minimal. */
		min-height: calc(100vh - theme('spacing.32')); /* Example: 32 = 8rem, adjust as needed */
	}
</style>
