<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import { Crepe } from '@milkdown/crepe';
	import { listener, listenerCtx } from '@milkdown/plugin-listener';
	import { commonmark } from '@milkdown/preset-commonmark';
	import { gfm } from '@milkdown/preset-gfm';
	import { editorViewCtx } from '@milkdown/core';

	// Import Crepe styles
	import '@milkdown/crepe/theme/common/style.css';
	import '@milkdown/crepe/theme/frame.css';

	const dispatch = createEventDispatcher<{
		change: string;
		ready: void;
	}>();

	let {
		value = '',
		readonly = false,
		placeholder = 'Start typing...',
		key = 0
	}: {
		value?: string;
		readonly?: boolean;
		placeholder?: string;
		key?: number;
	} = $props();

	let editorContainer: HTMLElement;
	let crepeInstance: Crepe | undefined;
	let isInitialized = false;
	let isUpdatingFromProp = false;
	let lastPropKey = key;

	async function initializeEditor() {
		if (!editorContainer || crepeInstance) return;

		try {
			crepeInstance = new Crepe({
				root: editorContainer,
				defaultValue: value,
				placeholder
			});

			// Configure the underlying editor with necessary presets and plugins
			crepeInstance.editor
				.use(commonmark)
				.use(gfm)
				.use(listener)
				.config((ctx) => {
					const listenerCtxValue = ctx.get(listenerCtx);
					listenerCtxValue.markdownUpdated((ctx, markdown, prevMarkdown) => {
						if (!isUpdatingFromProp && markdown !== value) {
							dispatch('change', markdown);
						}
					});
				});

			await crepeInstance.create();

			// Set readonly mode after creation if needed
			if (readonly) {
				await updateReadonlyMode(readonly);
			}

			isInitialized = true;
			dispatch('ready');
		} catch (error) {
			console.error('Failed to initialize Crepe editor:', error);
		}
	}

	async function destroyEditor() {
		if (crepeInstance) {
			try {
				await crepeInstance.destroy();
			} catch (error) {
				console.error('Failed to destroy Crepe editor:', error);
			} finally {
				crepeInstance = undefined;
				isInitialized = false;
			}
		}
	}

	// Update editor content
	async function updateEditorContent(newValue: string) {
		if (!crepeInstance || !isInitialized) return;

		const currentContent = getCurrentContent();
		if (currentContent === newValue) {
			return; // No need to update if content is the same
		}

		try {
			isUpdatingFromProp = true;
			await crepeInstance.setMarkdown(newValue);
		} catch (error) {
			console.error('Failed to update editor content, recreating editor:', error);
			// Fallback: recreate editor if update fails
			await destroyEditor();
			await initializeEditor();
		} finally {
			setTimeout(() => {
				isUpdatingFromProp = false;
			}, 50);
		}
	}

	// Get current content from editor
	function getCurrentContent(): string {
		if (!crepeInstance || !isInitialized) return value;

		try {
			return crepeInstance.getMarkdown();
		} catch (error) {
			console.error('Failed to get current content:', error);
			return value;
		}
	}

	// Expose methods for parent component
	export function getContent(): string {
		return getCurrentContent();
	}

	export function focus() {
		if (crepeInstance && isInitialized) {
			try {
				crepeInstance.focus();
			} catch (error) {
				console.error('Failed to focus editor:', error);
			}
		}
	}

	// Handle readonly mode changes
	async function updateReadonlyMode(isReadonly: boolean) {
		if (crepeInstance && isInitialized) {
			try {
				// Use Crepe's underlying editor to set editable state
				crepeInstance.editor.action((ctx) => {
					const editorView = ctx.get(editorViewCtx);
					editorView.setProps({
						editable: () => !isReadonly
					});
				});
			} catch (error) {
				console.error('Failed to update readonly mode:', error);
				// Fallback: just add/remove pointer-events via CSS class
			}
		}
	}

	// Only recreate editor when key changes (different note) or initial load
	$effect(() => {
		if (key !== lastPropKey) {
			// Key changed - this means we're loading a different note
			lastPropKey = key;
			if (isInitialized) {
				destroyEditor().then(() => initializeEditor());
			}
		} else if (isInitialized && value !== getCurrentContent()) {
			// Same note, but content prop changed - update without recreating
			updateEditorContent(value);
		}
	});

	// Handle readonly prop changes
	$effect(() => {
		if (isInitialized) {
			updateReadonlyMode(readonly);
		}
	});

	onMount(() => {
		// Initialize editor after DOM is ready
		if (editorContainer) {
			initializeEditor();
		}
	});

	onDestroy(() => {
		destroyEditor();
	});
</script>

<div bind:this={editorContainer} class="m-0 mx-auto pl-0"></div>

<style>
	:global(.milkdown .editor) {
		max-width: 800px;
		margin: 0 auto;
		padding: 0;
	}
	/* Override Crepe styles if needed */
</style>
