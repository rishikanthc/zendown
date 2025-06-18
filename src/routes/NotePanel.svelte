<script lang="ts">
	import { Carta, MarkdownEditor } from 'carta-md';
	import { onMount, onDestroy, tick } from 'svelte';
	import 'carta-md/default.css';
	import { Eye, Pencil } from 'lucide-svelte';
	import { getCartaInstance } from './getCarta';
	import './tw.css'; // Ensure Tailwind is processed for this component
	import { Button } from '$lib/components/ui/button/index.js';
	// Placeholder for the actual type of a newly created note.
	type NewNoteData = any;

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

	const carta = getCartaInstance('light'); // Assuming 'light' or a theme that adapts
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

	async function saveNote() {
		const title = extractTitleFromMarkdown(noteValue);

		if (!title) {
			const message =
				'Error: A title (H1 heading, e.g., "# Your Title") is required to save the note.';
			saveStatusMessage = message;
			// Consider a less intrusive notification system if window.alert is not preferred
			if (typeof window !== 'undefined') window.alert(message);
			setTimeout(() => {
				if (saveStatusMessage === message) saveStatusMessage = '';
			}, 5000);
			return;
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

				if (isNewNote && responseData.id) {
					currentNoteId = responseData.id;
					if (typeof window !== 'undefined' && window.localStorage) {
						window.localStorage.removeItem(localStorageKey);
					}
					if (onNoteCreated) {
						await onNoteCreated(responseData);
					}
				}
			} else {
				const errorMessage = `Error saving note: ${responseData.message || response.statusText || 'Unknown server error.'}`;
				saveStatusMessage = errorMessage;
				if (typeof window !== 'undefined') window.alert(errorMessage);
			}
		} catch (error: any) {
			console.error('Failed to save note:', error);
			const networkErrorMessage = `Failed to save note: ${error?.message || 'A network or client-side error occurred.'}`;
			saveStatusMessage = networkErrorMessage;
			if (typeof window !== 'undefined') window.alert(networkErrorMessage);
		}

		const titleRequiredErrorMessage =
			'Error: A title (H1 heading, e.g., "# Your Title") is required to save the note.';
		if (saveStatusMessage !== titleRequiredErrorMessage) {
			setTimeout(() => {
				if (saveStatusMessage !== titleRequiredErrorMessage) saveStatusMessage = '';
			}, 5000);
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
		// Refresh UI if initialContent is empty, to ensure placeholder is shown if necessary
		if (initialContent === '' && noteValue !== defaultNewNoteValue) {
			noteValue = defaultNewNoteValue;
		} else if (initialContent && noteValue !== initialContent) {
			// Ensure initialContent from prop is respected if it changed
			noteValue = initialContent;
		}

		return () => {
			if (typeof window !== 'undefined') {
				window.removeEventListener('keydown', handleKeyDown);
			}
			clearTimeout(debounceTimer);
		};
	});

	// React to prop changes for initialContent and id
	$effect(() => {
		if (initialId !== undefined) {
			currentNoteId = initialId;
		}
		if (initialContent !== undefined) {
			noteValue = initialContent;
			// If initialContent means it's a saved note, clear local storage for new notes.
			if (currentNoteId && typeof window !== 'undefined' && window.localStorage) {
				window.localStorage.removeItem(localStorageKey);
			}
		} else if (currentNoteId === undefined) {
			// If we switched to a "new note" view (no id, no initialContent)
			// load from local storage or use default.
			if (typeof window !== 'undefined' && window.localStorage) {
				noteValue = window.localStorage.getItem(localStorageKey) ?? defaultNewNoteValue;
			} else {
				noteValue = defaultNewNoteValue;
			}
		}
	});
</script>

<div class="flex min-h-screen w-full flex-col bg-white dark:bg-gray-900">
	<!-- Header -->
	<header
		class="sticky top-0 z-30 flex items-center justify-between px-4 py-3 sm:px-6 dark:bg-gray-800"
	>
		<a
			href="/"
			class="inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none dark:text-gray-200 dark:hover:bg-gray-700"
		>
			&larr; Back to Notes
		</a>
		<Button
			onclick={togglePreviewMode}
			variant="secondary"
			size="icon"
			title="Toggle edit/preview (Ctrl+P or Cmd+P)"
		>
			{#if currentMode === 'write'}
				<Eye stroke-width={2} class="rounded-sm" />
			{:else}
				<Pencil stroke-width={2} class="rounded-sm" />
			{/if}
		</Button>
	</header>

	<!-- Main Content Area (Scrollable) -->

	<!-- Editor Wrapper (Centering & Max Width) -->
	<div
		class="prose prose-base dark:prose-invert mx-auto h-full w-full max-w-[800px] px-4 py-6 text-gray-800 sm:px-2 dark:text-gray-100"
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

	<!-- Footer -->
	<footer class="fixed right-0 bottom-0 z-30 flex items-center justify-end px-4 py-2 sm:px-6">
		<div class="text-sm text-gray-600 dark:text-gray-400">Word Count: {wordCount}</div>
	</footer>

	<!-- Save Status Message -->
	{#if saveStatusMessage}
		<div
			class="fixed right-5 bottom-16 z-[100] rounded-md px-4 py-3 text-sm font-medium shadow-lg sm:bottom-[calc(theme(height.10)_+_1.25rem)] md:bottom-16"
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

<style>
	/* Styles from the original component, if any specific ones are needed beyond Tailwind. */
	/* For Carta in dark mode, if not handled by 'tw' theme or prose-invert */

	@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;1,100;1,200;1,300;1,400;1,500;1,600;1,700&family=IBM+Plex+Serif:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;1,100;1,200;1,300;1,400;1,500;1,600;1,700&family=Noto+Sans+Mono:wght@100..900&family=Noto+Sans:ital,wght@0,100..900;1,100..900&family=Noto+Serif:ital,wght@0,100..900;1,100..900&family=Nunito:ital,wght@0,200..1000;1,200..1000&display=swap');
</style>
