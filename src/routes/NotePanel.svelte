<script lang="ts">
	import { onMount, onDestroy, getContext } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { Eye, Pencil, Menu, Save, Plus, MoveLeft, Search } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import AppSidebar from '../lib/components/AppSidebar.svelte';
	import MarkdownEditor from './MarkdownEditor.svelte';
	import { getCartaInstance } from './getCarta';
	import { Markdown } from 'carta-md';
	import Tags from '$lib/components/tags/Tags.svelte';

	const openSemanticSearchDialog: () => void = getContext('openSemanticSearchDialog');

	// Types
	type NewNoteData = any;
	interface RelatedNote {
		id: string;
		title: string;
		canonical_path: string;
		score: number;
	}

	// Props
	let {
		content,
		id,
		onNoteCreated
	}: {
		content: string;
		id?: string;
		onNoteCreated?: (newNote: NewNoteData) => void | Promise<void>;
	} = $props();

	// Component State
	const carta = getCartaInstance('light');
	const user = $derived.by(() => $page.data.user);
	const isLoggedIn = $derived(!!user);

	// Core reactive state for the note panel
	let noteValue = $state('');
	let currentNoteId = $state<string | undefined>();
	let currentMode = $state<'write' | 'preview'>('preview');
	let isDirty = $state(false);

	// Other UI and data states
	let isZenMode = $state(false);
	let saveStatusMessage = $state('');
	let relatedNotes = $state<RelatedNote[]>([]);
	let isLoadingRelatedNotes = $state(false);
	let relatedNotesError = $state<string | null>(null);
	let markdownEditor: MarkdownEditor;

	// This key is crucial for forcing the MarkdownEditor to re-initialize when the note changes.
	const editorKey = $derived(currentNoteId || 'new-note-key');

	const wordCount = $derived(
		noteValue.trim() === '' ? 0 : noteValue.trim().split(/\s+/).filter(Boolean).length
	);

	function extractTitleFromMarkdown(markdown: string): string | null {
		if (!markdown) return null;
		const match = markdown.match(/^(?:#\s+)(.+)$/m);
		return match && match[1] ? match[1].trim() : null;
	}

	async function saveNote(): Promise<boolean> {
		if (!isLoggedIn) {
			saveStatusMessage = 'You must be logged in to save notes.';
			setTimeout(() => (saveStatusMessage = ''), 3000);
			return false;
		}

		let contentToSave = noteValue;
		if (markdownEditor && currentMode === 'write') {
			contentToSave = markdownEditor.getContent();
		}

		const title = extractTitleFromMarkdown(contentToSave);
		if (!title) {
			const message = 'A title (H1 heading, e.g., "# Your Title") is required to save.';
			saveStatusMessage = message;
			if (typeof window !== 'undefined') window.alert(message);
			setTimeout(() => (saveStatusMessage = ''), 5000);
			return false;
		}

		saveStatusMessage = 'Saving...';
		const isNewNote = !currentNoteId;
		const apiUrl = isNewNote ? '/api/notes/create' : '/api/notes/update';
		const requestBody = isNewNote
			? { content: contentToSave }
			: { id: currentNoteId, content: contentToSave };

		try {
			const response = await fetch(apiUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(requestBody)
			});

			const responseData = await response.json();

			if (response.ok) {
				const successMessage = `Note '${responseData.title || title}' saved!`;
				saveStatusMessage = successMessage;
				noteValue = contentToSave; // Sync state with saved content
				isDirty = false;

				if (isNewNote && responseData.id) {
					currentNoteId = responseData.id;
					if (onNoteCreated) {
						await onNoteCreated(responseData);
					}
				}

				setTimeout(() => (saveStatusMessage = ''), 3000);
				return true;
			} else {
				throw new Error(responseData.message || 'Unknown server error.');
			}
		} catch (error: any) {
			console.error('Failed to save note:', error);
			const errorMessage = `Error: ${error.message || 'Network or client error.'}`;
			saveStatusMessage = errorMessage;
			if (typeof window !== 'undefined') window.alert(errorMessage);
			setTimeout(() => (saveStatusMessage = ''), 5000);
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
				throw new Error(errorData.message || 'Failed to fetch related notes.');
			}
			relatedNotes = (await response.json()) as RelatedNote[];
		} catch (err: any) {
			relatedNotesError = err.message;
		} finally {
			isLoadingRelatedNotes = false;
		}
	}

	function togglePreviewMode() {
		if (!isLoggedIn) return; // Guests can only preview
		if (currentMode === 'write') {
			if (markdownEditor) noteValue = markdownEditor.getContent(); // Capture latest content before switching
			currentMode = 'preview';
		} else {
			currentMode = 'write';
		}
	}

	function handleEditorChange(event: CustomEvent<string>) {
		if (!isLoggedIn) return;
		noteValue = event.detail;
		isDirty = true;
	}

	function toggleZenMode() {
		isZenMode = !isZenMode;
		if (typeof document !== 'undefined') {
			if (isZenMode) {
				if (document.documentElement.requestFullscreen) {
					document.documentElement.requestFullscreen().catch((err) => {
						console.warn(
							`Error attempting to enable full-screen mode: ${err.message} (${err.name})`
						);
					});
				}
			} else {
				if (document.exitFullscreen && document.fullscreenElement) {
					document.exitFullscreen().catch((err) => {
						console.warn(`Error attempting to exit full-screen mode: ${err.message} (${err.name})`);
					});
				}
			}
		}
	}

	function handleFullscreenChange() {
		if (typeof document !== 'undefined' && !document.fullscreenElement) {
			// If fullscreen was exited (e.g. by pressing ESC), ensure Zen mode is also turned off.
			if (isZenMode) {
				isZenMode = false;
			}
		}
	}

	function handleKeyDown(event: KeyboardEvent) {
		// Zen mode: Ctrl/Cmd + L (available for everyone)
		if ((event.ctrlKey || event.metaKey) && event.key === 'l') {
			event.preventDefault();
			toggleZenMode();
		}

		// The following shortcuts are only for logged-in users.
		if (!isLoggedIn) return;

		if ((event.ctrlKey || event.metaKey) && event.key === 'p') {
			event.preventDefault();
			togglePreviewMode();
		} else if ((event.ctrlKey || event.metaKey) && event.key === 's') {
			event.preventDefault();
			saveNote();
		}
	}

	// This effect is the key to fixing the reactivity issues.
	// It runs whenever the component's props (id, content) change,
	// effectively resetting the component's state for the new note.
	$effect(() => {
		noteValue = content;
		currentNoteId = id;
		isDirty = false;
		// Set mode based on login status whenever a new note is loaded
		currentMode = isLoggedIn ? 'write' : 'preview';
	});

	// This effect specifically reacts to login/logout events happening
	// while the user is on the page.
	$effect(() => {
		if (isLoggedIn) {
			// If user just logged in, switch to write mode
			currentMode = 'write';
		} else {
			// If user just logged out, force preview mode
			currentMode = 'preview';
		}
	});

	// Fetch related notes when the note ID changes.
	$effect(() => {
		if (currentNoteId) {
			fetchRelatedNotes(currentNoteId);
		} else {
			relatedNotes = [];
		}
	});

	onMount(() => {
		window.addEventListener('keydown', handleKeyDown);
		document.addEventListener('fullscreenchange', handleFullscreenChange);
		return () => {
			window.removeEventListener('keydown', handleKeyDown);
			document.removeEventListener('fullscreenchange', handleFullscreenChange);
		};
	});
</script>

<Sidebar.Provider>
	{#if !isZenMode}
		<AppSidebar />
	{/if}

	<div class="flex min-h-screen w-full flex-col bg-white dark:bg-gray-900">
		{#if !isZenMode}
			<header
				class="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-2 py-2 backdrop-blur-sm sm:px-6 dark:border-gray-700 dark:bg-gray-800/80"
			>
				<div class="flex flex-shrink-0 items-center gap-2">
					{#if currentNoteId}
						<Sidebar.Trigger>
							<Menu class="h-5 w-5" />
							<span class="sr-only">Toggle Sidebar</span>
						</Sidebar.Trigger>
					{/if}
					<Button href="/" variant="ghost" size="sm"><MoveLeft size="38" /></Button>
				</div>
				<div class="flex items-center gap-2">
					<Button
						onclick={openSemanticSearchDialog}
						variant="secondary"
						size="icon"
						title="Search (Ctrl+K or Cmd+K)"
						class="flex-shrink-0"
					>
						<Search class="h-5 w-5" />
					</Button>
					{#if isLoggedIn}
						<Button href="/notes/new" variant="secondary" size="sm">
							<Plus class="mr-1 h-4 w-4" />
							New Note
						</Button>
						<div class="relative">
							<Button
								onclick={saveNote}
								disabled={!isDirty}
								variant="secondary"
								size="icon"
								title="Save note (Ctrl+S or Cmd+S)"
								class="flex-shrink-0"
							>
								<Save class="h-5 w-5" />
							</Button>
							{#if isDirty}
								<span
									class="bg-magenta-400 pointer-events-none absolute top-0 right-0 -mt-1 -mr-1 flex h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-gray-800"
									title="Unsaved changes"
								/>
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
								<Eye class="h-5 w-5" />
							{:else}
								<Pencil class="h-5 w-5" />
							{/if}
						</Button>
					{/if}
				</div>
			</header>
		{/if}

		<!-- Main Content Area -->
		<main
			class="prose prose-base dark:prose-invert prose-headings:font-medium prose-headings:font-[Space_Grotesk] prose-p:font-[Noto_Sans] mx-auto w-full max-w-[800px] flex-grow px-4 py-8 dark:text-gray-300"
		>
			<!-- Tags for mobile, shown above content -->
			<div class="not-prose md:hidden">
				{#if currentNoteId && !isZenMode}
					<Tags noteId={currentNoteId} />
				{/if}
			</div>

			<!-- Tags for desktop, using fixed positioning from the component -->
			<div class="hidden md:block">
				{#if currentNoteId && !isZenMode}
					<Tags noteId={currentNoteId} />
				{/if}
			</div>
			{#if currentMode === 'write' && isLoggedIn}
				<div class="font-[Space_Mono]">
					<MarkdownEditor
						bind:this={markdownEditor}
						value={noteValue}
						key={editorKey}
						readonly={!isLoggedIn}
						on:change={handleEditorChange}
					/>
				</div>
			{:else}
				<div class="preview-container">
					{#key noteValue}
						<Markdown {carta} value={noteValue} />
					{/key}
				</div>
			{/if}
		</main>

		<!-- Related Notes -->
		{#if currentNoteId}
			<aside
				class="mx-auto w-full max-w-[800px] border-t px-4 py-8 dark:border-gray-700"
				aria-labelledby="related-notes-heading"
			>
				<h2 id="related-notes-heading" class="mb-4 font-[Space_Grotesk] text-xl font-semibold">
					Related Notes
				</h2>
				{#if isLoadingRelatedNotes}
					<p>Loading...</p>
				{:else if relatedNotesError}
					<p class="text-red-500">Error: {relatedNotesError}</p>
				{:else if relatedNotes.length > 0}
					<ul class="list-none space-y-2 pl-0 font-[Noto_Sans]">
						{#each relatedNotes as note}
							<li>
								<a
									href="/{note.canonical_path}"
									class="text-blue-600 hover:underline dark:text-blue-400"
								>
									{note.title}
								</a>
								<span class="ml-2 text-xs text-gray-500 dark:text-gray-400"
									>(Score: {note.score.toFixed(3)})</span
								>
							</li>
						{/each}
					</ul>
				{:else}
					<p>No related notes found.</p>
				{/if}
			</aside>
		{/if}

		<!-- Footer Information -->
		<footer
			class="fixed right-4 bottom-4 z-30 rounded-full bg-white/50 px-3 py-1 text-xs text-gray-600 shadow-md backdrop-blur-sm dark:bg-gray-800/50 dark:text-gray-400"
		>
			Word Count: {wordCount}
		</footer>

		<!-- Save Status Notification -->
		{#if saveStatusMessage}
			<div
				class="fixed right-5 bottom-16 z-[100] rounded-md px-4 py-2 text-sm font-medium text-white shadow-lg"
				class:bg-blue-600={saveStatusMessage.includes('Saving') ||
					saveStatusMessage.includes('saved')}
				class:bg-red-600={saveStatusMessage.toLowerCase().includes('error') ||
					saveStatusMessage.includes('must be logged in')}
				role="status"
				aria-live="polite"
			>
				{saveStatusMessage}
			</div>
		{/if}
	</div>
</Sidebar.Provider>
