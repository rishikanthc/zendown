<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		Editor,
		rootCtx,
		defaultValueCtx,
		editorViewOptionsCtx,
		editorViewCtx,
		serializerCtx
	} from '@milkdown/core';
	import { nord } from '@milkdown/theme-nord';
	import { commonmark } from '@milkdown/preset-commonmark';
	import { gfm } from '@milkdown/preset-gfm';
	import { history } from '@milkdown/plugin-history';
	import { math } from '@milkdown/plugin-math';
	import { prism } from '@milkdown/plugin-prism';
	import { clipboard } from '@milkdown/plugin-clipboard';
	import { cursor } from '@milkdown/plugin-cursor';
	import { listener, listenerCtx } from '@milkdown/plugin-listener';
	import { Eye, Pencil, Menu, Save } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import AppSidebar from '../lib/components/AppSidebar.svelte';

	// Import Milkdown styles
	import '@milkdown/theme-nord/style.css';

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
		id: initialId, // Renamed to avoid conflict with DOM id attribute
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

	// noteValue is the Svelte-side truth for the editor's content.
	// It's initialized based on props or localStorage.
	// It's updated by the editor listener upon user input.
	// It's updated by the prop-handling $effect if new initialContent/initialId is passed.
	let noteValue = $state(
		(() => {
			if (initialContent !== undefined) {
				return initialContent;
			}
			if (typeof window !== 'undefined' && window.localStorage) {
				// Only use localStorage if it's a new note (no initialId)
				if (initialId === undefined) {
					return window.localStorage.getItem(localStorageKey) ?? defaultNewNoteValue;
				}
			}
			return defaultNewNoteValue;
		})()
	);

	let debounceTimer: number | undefined;
	let milkdownEditor: Editor | undefined;
	let editorContainer: HTMLElement;

	// Effect for saving new, unsaved note content to localStorage
	$effect(() => {
		const valueToSave = noteValue;
		if (
			currentNoteId === undefined && // Only save if it's a new, unsaved note
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

	async function saveNote(): Promise<boolean> {
		const title = extractTitleFromMarkdown(noteValue);

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
				const successMessage = `Note '${savedTitle}' saved successfully!`;
				saveStatusMessage = successMessage;

				setTimeout(() => {
					if (saveStatusMessage === successMessage) saveStatusMessage = '';
				}, 3000);

				if (isNewNote && responseData.id) {
					currentNoteId = responseData.id; // Update currentNoteId for the newly created note
					if (typeof window !== 'undefined' && window.localStorage) {
						window.localStorage.removeItem(localStorageKey); // Clear temp content
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
			if (milkdownEditor) {
				milkdownEditor.action((ctx) => {
					const editorView = ctx.get(editorViewCtx);
					const serializer = ctx.get(serializerCtx);
					const currentEditorMarkdown = serializer(editorView.state.doc);
					if (currentEditorMarkdown !== noteValue) {
						noteValue = currentEditorMarkdown; // Sync Svelte state if editor had changes not yet flushed by listener
					}
				});
			}
			currentMode = 'preview';
		} else {
			currentMode = 'write';
			// Editor will be re-initialized by the $effect managing its lifecycle
		}
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

	async function initializeEditor(contentToLoad: string) {
		if (!editorContainer) return;
		// Ensure any previous editor is fully destroyed before creating a new one.
		if (milkdownEditor) {
			await destroyEditor();
		}
		try {
			milkdownEditor = await Editor.make()
				.config((ctx) => {
					ctx.set(rootCtx, editorContainer);
					ctx.set(defaultValueCtx, contentToLoad); // Use the passed content
					ctx.get(listenerCtx).markdownUpdated((_ctx, markdown, _prevMarkdown) => {
						if (markdown !== noteValue) {
							noteValue = markdown; // Update Svelte state from editor changes
							isDirty = true;
						}
					});
				})
				.config(nord)
				.use(commonmark)
				.use(gfm)
				.use(history)
				// .use(math) // Uncomment after installing katex
				// .use(prism) // Uncomment after installing prismjs
				.use(clipboard)
				.use(cursor)
				.use(listener)
				.create();
		} catch (error) {
			console.error('Failed to initialize Milkdown editor:', error);
		}
	}

	async function destroyEditor() {
		if (milkdownEditor) {
			try {
				await milkdownEditor.destroy();
			} catch (error) {
				console.error('Failed to destroy Milkdown editor:', error);
			} finally {
				milkdownEditor = undefined;
			}
		}
	}

	onMount(() => {
		if (typeof window !== 'undefined') {
			window.addEventListener('keydown', handleKeyDown);
		}
		// Initial editor setup is handled by $effects based on `currentMode` and props.
		return () => {
			if (typeof window !== 'undefined') {
				window.removeEventListener('keydown', handleKeyDown);
			}
			clearTimeout(debounceTimer);
			// destroyEditor(); // Handled by $effect cleanup
		};
	});

	// Effect for handling prop changes (initialContent, initialId)
	// This effect is responsible for updating the Svelte state (noteValue, currentNoteId)
	// and then ensuring the editor, if active, reflects these changes.
	$effect(() => {
		// This effect's explicit dependencies are initialContent and initialId (from props).
		// It runs when these props change, indicating a new note should be loaded or state reset.
		let newContentToSet: string;
		const newIdToSet: string | undefined = initialId; // Use current prop value for id

		if (initialContent !== undefined) {
			// If initialContent prop is provided, it's the source of truth.
			newContentToSet = initialContent;
			// If loading a specific note (newIdToSet is defined), clear any temp localStorage content.
			if (newIdToSet && typeof window !== 'undefined' && window.localStorage) {
				window.localStorage.removeItem(localStorageKey);
			}
		} else {
			// No initialContent prop. This typically means a new, unsaved note scenario.
			if (newIdToSet === undefined && typeof window !== 'undefined' && window.localStorage) {
				// If it's a truly new note (no ID prop yet), try to load from localStorage.
				newContentToSet = window.localStorage.getItem(localStorageKey) ?? defaultNewNoteValue;
			} else {
				// Default for new notes if localStorage is empty,
				// or if an ID was passed but no content (less common for existing notes, but fallback).
				newContentToSet = defaultNewNoteValue;
			}
		}

		// Update Svelte's reactive state variables.
		noteValue = newContentToSet;
		currentNoteId = newIdToSet;
		isDirty = false; // Content has just been loaded/reset from props/localStorage, so it's not "dirty"

		// If the Milkdown editor is currently active (in 'write' mode and container exists),
		// it needs to be updated to reflect this newly set `noteValue`.
		// Destroying and re-initializing is a robust way to ensure the editor state is correct.
		if (milkdownEditor && currentMode === 'write' && editorContainer) {
			destroyEditor().then(() => {
				// After destruction, if conditions are still met (still in write mode, container exists),
				// re-initialize the editor. It will use the `noteValue` that was just updated.
				if (editorContainer && currentMode === 'write') {
					initializeEditor(noteValue);
				}
			});
		}
		// If the editor is not in 'write' mode, or not yet created (e.g. editorContainer not ready),
		// the other $effect (editor lifecycle manager) will use the updated `noteValue`
		// when it eventually creates or switches to the editor.
	});

	// Effect for managing editor instance creation/destruction based on mode and container.
	// This ensures the editor exists and is correctly configured when in 'write' mode,
	// and is cleaned up otherwise.
	$effect(() => {
		// Dependencies: editorContainer, currentMode.
		// Also implicitly depends on `noteValue` because `initializeEditor` uses it.
		if (editorContainer && currentMode === 'write') {
			// If in 'write' mode and the DOM container for the editor is available...
			if (!milkdownEditor) {
				// ...and no editor instance currently exists, create one.
				// `noteValue` at this point reflects the latest state,
				// either from initial component load, prop changes, or user input.
				initializeEditor(noteValue);
			}
			// If `milkdownEditor` already exists and `currentMode` is 'write',
			// we assume it's correctly reflecting `noteValue` due to its internal listener,
			// or it was just re-initialized by the prop-handling effect.
			// No specific action to re-initialize is needed here if the editor instance is already present.
		} else {
			// If not in 'write' mode, or if the editor container is not (or no longer) available,
			// ensure any existing Milkdown editor instance is destroyed to free resources.
			if (milkdownEditor) {
				destroyEditor();
			}
		}

		// Cleanup function for this $effect:
		// This runs if `editorContainer` or `currentMode` changes (causing the effect to re-run),
		// or when the component instance is unmounted.
		// Its purpose is to ensure the editor is cleaned up if the conditions for its existence are no longer met.
		return () => {
			if (milkdownEditor) {
				destroyEditor();
			}
		};
	});

	// Effect for fetching related notes when in preview mode and a note ID exists
	$effect(() => {
		if (currentNoteId && currentMode === 'preview') {
			fetchRelatedNotes(currentNoteId);
		} else {
			// Clear related notes if not applicable
			relatedNotes = [];
			isLoadingRelatedNotes = false;
			relatedNotesError = null;
		}
	});

	// Simple markdown to HTML conversion for preview mode
	function markdownToHtml(markdown: string): string {
		// Basic replacements; consider a more robust library if complex markdown features are needed here
		// that aren't covered by Milkdown's direct preview or if Milkdown isn't used for preview.
		return markdown
			.replace(/^### (.*$)/gm, '<h3>$1</h3>')
			.replace(/^## (.*$)/gm, '<h2>$1</h2>')
			.replace(/^# (.*$)/gm, '<h1>$1</h1>')
			.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
			.replace(/\*(.*?)\*/g, '<em>$1</em>')
			.replace(/`(.*?)`/g, '<code>$1</code>')
			.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')
			.replace(/\n\n/g, '</p><p>') // Handle paragraph breaks
			.replace(/\n/g, '<br>') // Handle line breaks within paragraphs
			.replace(/^(.*)$/gm, '<p>$1</p>') // Wrap remaining lines in paragraphs
			.replace(/<p><\/p>/g, '') // Remove empty paragraphs
			.replace(/<p>(<h[1-6]>.*?<\/h[1-6]>)<\/p>/g, '$1') // Correctly handle headings wrapped in <p>
			.replace(/<p>(<br>)+<\/p>/g, ''); // Clean up paragraphs that only contain <br>
	}

	// onDestroy lifecycle hook for final cleanup (though $effect cleanup should handle editor)
	onDestroy(() => {
		// Main editor destruction is handled by the $effect cleanup.
		// This is a final safeguard.
		if (milkdownEditor) {
			destroyEditor();
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
				<div bind:this={editorContainer} class="milkdown-editor min-h-[400px]"></div>
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

	/* Custom styles for Milkdown editor */
	:global(.milkdown) {
		background: transparent !important;
		border: none !important;
		box-shadow: none !important;
		outline: none !important;
	}

	:global(.milkdown .editor) {
		outline: none !important;
		border: none !important;
		font-family: 'Noto Sans', sans-serif !important;
		line-height: 1.7 !important;
		color: inherit !important;
		background: transparent !important;
		min-height: inherit; /* Ensure editor takes up min-h from parent */
		height: 100%; /* Allow editor to grow */
		padding: 0; /* Override default milkdown padding if any */
	}

	.milkdown-editor {
		/* This is the direct parent of .milkdown */
		/* Ensure it allows child to expand; min-h-[400px] is already applied */
		display: flex; /* Helps if .milkdown needs to fill height */
		flex-direction: column;
	}

	:global(.milkdown .ProseMirror) {
		padding: 0.5rem; /* Add some padding inside the editable area if desired */
		min-height: inherit; /* Inherit min-height from parent for typing area */
		height: 100%;
		box-sizing: border-box;
	}

	:global(.milkdown .prose) {
		max-width: none !important;
		color: inherit !important;
	}

	:global(.milkdown h1),
	:global(.milkdown h2),
	:global(.milkdown h3),
	:global(.milkdown h4),
	:global(.milkdown h5),
	:global(.milkdown h6) {
		font-family: 'Space Grotesk', sans-serif !important;
		color: inherit !important;
	}

	:global(.milkdown-editor .milkdown) {
		padding: 0 !important;
		margin: 0 !important;
		flex-grow: 1; /* Allow milkdown itself to grow if its parent is flex */
	}
</style>
