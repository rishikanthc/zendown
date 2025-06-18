<script lang="ts">
	import { Carta, MarkdownEditor } from 'carta-md';
	import { onMount, onDestroy } from 'svelte';
	import 'carta-md/default.css';
	import { getCartaInstance } from './getCarta';
	import './tw.css';

	let {
		key,
		initialContent,
		id: initialId
	}: { key?: number; initialContent?: string; id?: string } = $props();

	let currentNoteId = $state(initialId);

	const carta = getCartaInstance('light');
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

	// $effect(() => {
	// 	if (initialContent !== undefined) {
	// 		noteValue = initialContent;
	// 	}
	// });

	let debounceTimer: number | undefined;

	$effect(() => {
		// Capture noteValue for the closure, as noteValue itself is reactive
		// and could change before the timeout fires if we don't.
		const valueToSave = noteValue;

		// Only save to generic local storage if it's a new note that hasn't been saved yet (no currentNoteId)
		// and wasn't loaded with initialContent (which implies it's an existing note being edited).
		if (
			currentNoteId === undefined &&
			initialContent === undefined &&
			typeof window !== 'undefined' &&
			window.localStorage
		) {
			// Clear any existing timer
			clearTimeout(debounceTimer);
			// Set a new timer
			debounceTimer = window.setTimeout(() => {
				window.localStorage.setItem(localStorageKey, valueToSave);
			}, 500); // 500ms delay, you can adjust this value
		}

		// Cleanup function for the effect:
		// This will run when the effect re-runs (due to noteValue changing)
		// or when the component is unmounted.
		return () => {
			clearTimeout(debounceTimer);
		};
	});

	let currentMode = $state<'write' | 'preview'>('write');
	let saveStatusMessage = $state('');

	function extractTitleFromMarkdown(markdown: string): string | null {
		if (!markdown) return null;
		const match = markdown.match(/^(?:#\s+)(.+)$/m);
		if (match && match[1]) {
			return match[1].trim();
		}
		return null;
	}

	async function saveNote() {
		const title = extractTitleFromMarkdown(noteValue); // Client-side extraction for pre-flight check

		if (!title) {
			const message =
				'Error: A title (H1 heading, e.g., "# Your Title") is required to save the note.';
			saveStatusMessage = message;
			window.alert(message);
			setTimeout(() => {
				if (saveStatusMessage === message) saveStatusMessage = '';
			}, 5000);
			return;
		}

		saveStatusMessage = 'Saving...';
		let response;
		let requestBody;
		let apiUrl: string;

		if (currentNoteId) {
			apiUrl = '/api/notes/update';
			requestBody = {
				id: currentNoteId,
				content: noteValue
				// tags could be added here if the UI supports them
			};
		} else {
			apiUrl = '/api/notes/create';
			requestBody = {
				content: noteValue
				// tags could be added here
			};
		}

		try {
			response = await fetch(apiUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(requestBody)
			});

			let responseData;
			const contentType = response.headers.get('content-type');
			if (contentType && contentType.includes('application/json')) {
				responseData = await response.json();
			} else {
				responseData = { message: response.statusText || 'Received non-JSON response from server.' };
			}

			if (response.ok) {
				// The backend's extractTitleFromMarkdownServer is the source of truth for the saved title.
				const savedTitle = responseData.title || title; // Fallback to client-extracted if somehow missing
				const successMessage = `Note '${savedTitle}' saved successfully!`;
				saveStatusMessage = successMessage;

				if (!currentNoteId && responseData.id) {
					// If it was a create operation and successful, store the new ID
					currentNoteId = responseData.id;
					// Clear the generic local storage for new notes as this one is now saved.
					if (typeof window !== 'undefined' && window.localStorage) {
						window.localStorage.removeItem(localStorageKey);
					}
				}
				// window.alert(successMessage); // Usually not needed with status message
			} else {
				const errorMessage = `Error saving note: ${responseData.message || response.statusText || 'Unknown server error.'}`;
				saveStatusMessage = errorMessage;
				window.alert(errorMessage);
			}
		} catch (error: any) {
			console.error('Failed to save note:', error);
			const networkErrorMessage = `Failed to save note: ${error?.message || 'A network or client-side error occurred.'}`;
			saveStatusMessage = networkErrorMessage;
			window.alert(networkErrorMessage);
		}

		const titleRequiredErrorMessage =
			'Error: A title (H1 heading, e.g., "# Your Title") is required to save the note.';
		if (saveStatusMessage !== titleRequiredErrorMessage) {
			setTimeout(() => {
				if (saveStatusMessage !== titleRequiredErrorMessage) saveStatusMessage = '';
			}, 5000);
		}
	}

	const handleKeyDown = (event: KeyboardEvent) => {
		if ((event.ctrlKey || event.metaKey) && event.key === 'p') {
			event.preventDefault();
			currentMode = currentMode === 'write' ? 'preview' : 'write';
		} else if ((event.ctrlKey || event.metaKey) && event.key === 's') {
			event.preventDefault();
			saveNote();
		}
	};

	onMount(() => {
		window.addEventListener('keydown', handleKeyDown);
		return () => {
			window.removeEventListener('keydown', handleKeyDown);
		};
	});
</script>

<div
	class="prose prose-base dark:prose-invert mx-auto w-full max-w-[800px] flex-grow text-gray-800 dark:text-gray-200"
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

{#if saveStatusMessage}
	<div
		class="fixed right-5 bottom-5 z-[100] rounded-md px-4 py-3 text-sm font-medium shadow-lg"
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

<style>
	@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;1,100;1,200;1,300;1,400;1,500;1,600;1,700&family=IBM+Plex+Serif:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;1,100;1,200;1,300;1,400;1,500;1,600;1,700&family=Noto+Sans+Mono:wght@100..900&family=Noto+Sans:ital,wght@0,100..900;1,100..900&family=Noto+Serif:ital,wght@0,100..900;1,100..900&family=Nunito:ital,wght@0,200..1000;1,200..1000&display=swap');
</style>
