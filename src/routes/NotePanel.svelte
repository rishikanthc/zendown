<script lang="ts">
	import { onMount } from 'svelte';
	import { Eye, Pencil, Menu, Save } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import AppSidebar from '../lib/components/AppSidebar.svelte';
	import MarkdownEditor from './MarkdownEditor.svelte';

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

	const localStorageKey = 'milkdown-editor-content';
	const defaultNewNoteValue = '# Start typing your title here\n\nAnd your content below...';

	// Initialize noteValue - this will be the single source of truth
	let noteValue = $state(
		(() => {
			if (initialContent !== undefined) {
				return initialContent;
			}
			if (typeof window !== 'undefined' && window.localStorage) {
				if (initialId === undefined) {
					return window.localStorage.getItem(localStorageKey) ?? defaultNewNoteValue;
				}
			}
			return defaultNewNoteValue;
		})()
	);

	let debounceTimer: number | undefined;
	let markdownEditor: MarkdownEditor;

	// Create a unique key for the editor that changes when switching notes
	const editorKey = $derived(currentNoteId || 'new-note');

	// Save to localStorage for new notes
	$effect(() => {
		if (currentNoteId === undefined && typeof window !== 'undefined' && window.localStorage) {
			clearTimeout(debounceTimer);
			debounceTimer = window.setTimeout(() => {
				window.localStorage.setItem(localStorageKey, noteValue);
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

	async function saveNote(): Promise<boolean> {
		// Get the latest content from the editor
		let contentToSave = noteValue;
		if (markdownEditor && currentMode === 'write') {
			contentToSave = markdownEditor.getContent();
		}

		const title = extractTitleFromMarkdown(contentToSave);

		if (!title) {
			const message =
				'Error: A title (H1 heading, e.g., "# Your Title") is required to save the note.';
			saveStatusMessage = message;
			if (typeof window !== 'undefined') window.alert(message);
			setTimeout(() => {
				if (saveStatusMessage === message) saveStatusMessage = '';
			}, 5000);
			return false;
		}

		saveStatusMessage = 'Saving...';

		let response;
		let requestBody;
		let apiUrl: string;
		const isNewNote = !currentNoteId;

		if (isNewNote) {
			apiUrl = '/api/notes/create';
			requestBody = { content: contentToSave };
		} else {
			apiUrl = '/api/notes/update';
			requestBody = { id: currentNoteId, content: contentToSave };
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
				const successMessage = `Note '${savedTitle}' saved successfully!`;
				saveStatusMessage = successMessage;

				// Update noteValue to match what was actually saved
				noteValue = contentToSave;

				setTimeout(() => {
					if (saveStatusMessage === successMessage) saveStatusMessage = '';
				}, 3000);

				if (isNewNote && responseData.id) {
					currentNoteId = responseData.id;
					if (typeof window !== 'undefined' && window.localStorage) {
						window.localStorage.removeItem(localStorageKey);
					}
					if (onNoteCreated) {
						await onNoteCreated(responseData);
					}
				}
				isDirty = false;
				return true;
			} else {
				const errorMessage = `Error saving note: ${responseData.message || response.statusText || 'Unknown server error.'}`;
				saveStatusMessage = errorMessage;
				setTimeout(() => {
					if (saveStatusMessage === errorMessage) saveStatusMessage = '';
				}, 5000);
				if (typeof window !== 'undefined') window.alert(errorMessage);
				return false;
			}
		} catch (error: any) {
			console.error('Failed to save note:', error);
			const networkErrorMessage = `Failed to save note: ${error?.message || 'A network or client-side error occurred.'}`;
			saveStatusMessage = networkErrorMessage;
			setTimeout(() => {
				if (saveStatusMessage === networkErrorMessage) saveStatusMessage = '';
			}, 5000);
			if (typeof window !== 'undefined') window.alert(networkErrorMessage);
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
		if (currentMode === 'write') {
			// Get current content from editor before switching to preview
			if (markdownEditor) {
				noteValue = markdownEditor.getContent();
			}
			currentMode = 'preview';
		} else {
			currentMode = 'write';
		}
	}

	function handleEditorChange(event: CustomEvent<string>) {
		noteValue = event.detail;
		isDirty = true;
	}

	function handleKeyDown(event: KeyboardEvent) {
		if ((event.ctrlKey || event.metaKey) && event.key === 'p') {
			event.preventDefault();
			togglePreviewMode();
		} else if ((event.ctrlKey || event.metaKey) && event.key === 's') {
			event.preventDefault();
			saveNote();
		}
	}

	// Handle prop changes for loading new notes
	// Store the context of the last data load using props
	let previousLoadContextKey = $state<string | undefined>(undefined);

	$effect(() => {
		const newNoteIdProp = initialId; // Prop from parent ([slug]/+page.svelte or +page.svelte's modal)
		const newContentProp = initialContent; // Prop from parent, content for existing notes
		const panelInstanceKeyProp = key; // Prop from parent, used to differentiate "new note" panel instances

		// Construct a unique key representing the current data loading context.
		// This key changes if:
		//  a) A different existing note is loaded (newNoteIdProp changes).
		//  b) A new instance of the "new note" panel is created/re-keyed (panelInstanceKeyProp changes).
		const currentLoadContextKey = `${newNoteIdProp || 'newNoteMode'}-${panelInstanceKeyProp || 'noPanelInstanceKey'}`;

		if (currentLoadContextKey !== previousLoadContextKey) {
			// The loading context has changed. This means we are either:
			// 1. Loading an entirely different existing note.
			// 2. Displaying a fresh "new note" panel instance.
			// 3. Or, this is the very first time this $effect is running for this NotePanel instance.
			// In these scenarios, it's correct to (re)initialize `noteValue` based on the new props or defaults.

			if (newContentProp !== undefined) {
				// If initialContent is provided (typically for an existing note), use it as the source of truth.
				noteValue = newContentProp;
			} else if (newNoteIdProp === undefined) {
				// This condition implies it's a "new note" panel context:
				// - `newNoteIdProp` is undefined (no existing note ID passed).
				// - `newContentProp` was also undefined (no specific initial content forced by props).
				// So, attempt to load a draft from localStorage, or fall back to the default new note value.
				noteValue = (typeof window !== 'undefined' && window.localStorage?.getItem(localStorageKey)) ?? defaultNewNoteValue;
			}
			// Note: If `newNoteIdProp` is defined (existing note) but `newContentProp` is undefined,
			// `noteValue` would not be set here. This scenario assumes `initialContent` is always provided for existing notes.

			isDirty = false; // Reset dirty status as we're loading fresh/initial content.
			currentNoteId = newNoteIdProp; // Sync the panel's internal `currentNoteId` state with the prop.

			if (newNoteIdProp && typeof window !== 'undefined' && window.localStorage) {
				// If an existing note is being loaded, it's good practice to clear any
				// "new note" draft from localStorage, as it's no longer the active editing context.
				window.localStorage.removeItem(localStorageKey);
			}

			// Critical: Update the `previousLoadContextKey` to the current one.
			// This ensures that this `if` block is not re-entered in subsequent $effect runs
			// unless the loading context genuinely changes again.
			previousLoadContextKey = currentLoadContextKey;
		}
		// If `currentLoadContextKey === previousLoadContextKey`:
		// This means the props defining the "identity" of the note being edited (initialId and panelInstanceKeyProp)
		// have *not* changed since the last time this $effect ran.
		// A common case for this is after a `saveNote()` operation on the *same* note:
		//  - `initialId` prop (for existing notes) remains the same.
		//  - `panelInstanceKeyProp` (for new note modals) remains the same.
		// In this crucial scenario, `noteValue` should *not* be reset from `newContentProp` by this $effect.
		// Doing so would overwrite the `noteValue` that was just updated by `saveNote()` to reflect the successfully saved content.
		// The `saveNote()` function is responsible for updating `noteValue` to the content that was persisted.
	});

	// Fetch related notes when in preview mode
	$effect(() => {
		if (currentNoteId && currentMode === 'preview') {
			fetchRelatedNotes(currentNoteId);
		} else {
			relatedNotes = [];
			isLoadingRelatedNotes = false;
			relatedNotesError = null;
		}
	});

	function markdownToHtml(markdown: string): string {
		return markdown
			.replace(/^### (.*$)/gm, '<h3>$1</h3>')
			.replace(/^## (.*$)/gm, '<h2>$1</h2>')
			.replace(/^# (.*$)/gm, '<h1>$1</h1>')
			.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
			.replace(/\*(.*?)\*/g, '<em>$1</em>')
			.replace(/`(.*?)`/g, '<code>$1</code>')
			.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')
			.replace(/\n\n/g, '</p><p>')
			.replace(/\n/g, '<br>')
			.replace(/^(.*)$/gm, '<p>$1</p>')
			.replace(/<p><\/p>/g, '')
			.replace(/<p>(<h[1-6]>.*?<\/h[1-6]>)<\/p>/g, '$1')
			.replace(/<p>(<br>)+<\/p>/g, '');
	}

	onMount(() => {
		if (typeof window !== 'undefined') {
			window.addEventListener('keydown', handleKeyDown);
		}
		return () => {
			if (typeof window !== 'undefined') {
				window.removeEventListener('keydown', handleKeyDown);
			}
			clearTimeout(debounceTimer);
		};
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
						onclick={saveNote}
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
			{#if currentMode === 'write'}
				<MarkdownEditor
					bind:this={markdownEditor}
					value={noteValue}
					key={editorKey}
					onchange={handleEditorChange}
				/>
			{:else}
				<div class="prose-content">
					{@html markdownToHtml(noteValue)}
				</div>
			{/if}
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
					saveStatusMessage.includes('successfully')}
				class:bg-red-600={saveStatusMessage.toLowerCase().includes('error')}
				class:bg-gray-700={!saveStatusMessage.toLowerCase().includes('error') &&
					!saveStatusMessage.includes('successfully') &&
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
</style>
