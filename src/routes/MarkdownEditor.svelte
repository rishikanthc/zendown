<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import { Editor, rootCtx, defaultValueCtx, editorViewCtx, serializerCtx } from '@milkdown/core';
	import { nord } from '@milkdown/theme-nord';
	import { commonmark } from '@milkdown/preset-commonmark';
	import { gfm } from '@milkdown/preset-gfm';
	import { history } from '@milkdown/plugin-history';
	import { math } from '@milkdown/plugin-math';
	import { prism } from '@milkdown/plugin-prism';
	import { clipboard } from '@milkdown/plugin-clipboard';
	import { cursor } from '@milkdown/plugin-cursor';
	import { listener, listenerCtx } from '@milkdown/plugin-listener';

	// Import Milkdown styles
	import '@milkdown/theme-nord/style.css';

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
	let milkdownEditor: Editor | undefined;
	let isInitialized = false;
	let isUpdatingFromProp = false;

	async function initializeEditor() {
		if (!editorContainer || milkdownEditor) return;

		try {
			milkdownEditor = await Editor.make()
				.config((ctx) => {
					ctx.set(rootCtx, editorContainer);
					ctx.set(defaultValueCtx, value);

					ctx.get(listenerCtx).markdownUpdated((ctx, markdown, prevMarkdown) => {
						if (!isUpdatingFromProp && markdown !== value) {
							dispatch('change', markdown);
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

			isInitialized = true;
			dispatch('ready');
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
				isInitialized = false;
			}
		}
	}

	// Update editor content when value prop changes
	// async function updateEditorContent(newValue: string) {
	// 	if (!milkdownEditor || !isInitialized || isUpdatingFromProp) return;

	// 	// Check if the new value is actually different from current content
	// 	const currentContent = getCurrentContent();
	// 	if (currentContent === newValue) {
	// 		return; // No need to update if content is the same
	// 	}

	// 	try {
	// 		isUpdatingFromProp = true;

	// 		// For significant content changes (like navigation), recreate the editor
	// 		// This is more reliable than trying to update the content in place
	// 		await destroyEditor();
	// 		await initializeEditor();
	// 	} catch (error) {
	// 		console.error('Failed to update editor content:', error);
	// 	} finally {
	// 		setTimeout(() => {
	// 			isUpdatingFromProp = false;
	// 		}, 100); // Longer timeout for recreation
	// 	}
	// }

	// Get current content from editor
	function getCurrentContent(): string {
		if (!milkdownEditor || !isInitialized) return value;

		try {
			let content = value;
			milkdownEditor.action((ctx) => {
				const view = ctx.get(editorViewCtx);
				const serializer = ctx.get(serializerCtx);
				content = serializer(view.state.doc);
			});
			return content;
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
		if (milkdownEditor && isInitialized) {
			milkdownEditor.action((ctx) => {
				const view = ctx.get(editorViewCtx);
				view.focus();
			});
		}
	}

	// Effect to handle value prop changes and key changes (for forced recreation)
	let prevEditorComponentKey = $state(key); // Initialize with the initial key prop from parent
	let prevValuePropForEffect = $state(value); // Track the value prop passed to this effect in previous run

	$effect(() => {
		const newPropValue = value; // Current 'value' prop from parent (NotePanel)
		const newEditorComponentKey = key; // Current 'key' prop from parent (NotePanel)

		if (isInitialized) {
			// Only proceed if the editor has been initialized at least once
			if (newEditorComponentKey !== prevEditorComponentKey) {
				// The editor's 'key' prop has changed. This is a strong signal to re-initialize,
				// typically meaning a completely different note is being loaded or a forced refresh.
				// The `newPropValue` (which is the current `value` prop) will be used by `updateEditorContent`.
				updateEditorContent(newPropValue);
			} else if (newPropValue !== prevValuePropForEffect) {
				// The 'key' prop is the same, but the 'value' prop from the parent has changed.
				// This indicates the parent (NotePanel) wants to update the content.
				// We should compare `newPropValue` with the editor's *actual* internal content
				// to avoid unnecessary updates if they are already in sync.
				const editorInternalContent = getCurrentContent();
				if (newPropValue !== editorInternalContent) {
					// Only update if the new prop value actually differs from what the editor currently holds.
					updateEditorContent(newPropValue);
				}
			}
		}

		// Update trackers for the next $effect run, reflecting the props just processed.
		prevEditorComponentKey = newEditorComponentKey;
		prevValuePropForEffect = newPropValue;
	});

	// Update editor content when value prop changes.
	// This function now explicitly takes the new markdown to use.
	async function updateEditorContent(newMarkdown: string) {
		if (!isInitialized) {
			// This guard might be redundant given the $effect's isInitialized check, but it's safe.
			return;
		}

		try {
			isUpdatingFromProp = true; // Signal that the upcoming content change is driven by a prop

			// Destroy and re-initialize the editor. This is the most reliable way to
			// ensure the editor starts fresh with the newMarkdown, especially for Milkdown's defaultValueCtx.
			// The `initializeEditor` function uses the component's `value` prop for defaultValueCtx.
			// Since this `updateEditorContent` is called with `newMarkdown` (which comes from the `value` prop in the $effect),
			// the `value` prop of the component will be up-to-date when `initializeEditor` reads it.
			await destroyEditor();
			await initializeEditor(); // This will use the latest `value` prop of the MarkdownEditor component.
		} catch (error) {
			console.error('Failed to update editor content:', error);
		} finally {
			// Short timeout to allow editor to fully initialize and render
			// before re-enabling dispatches of 'change' events from the editor itself.
			setTimeout(() => {
				isUpdatingFromProp = false;
			}, 50); // Adjusted timeout, can be tweaked.
		}
	}

	onMount(() => {
		// Initialize editor after DOM is ready
		if (editorContainer) {
			initializeEditor().then(() => {
				// After the first initialization attempt, set the 'previous' state trackers
				// to match the props that were used for this initial setup.
				// This correctly baselines the $effect logic.
				prevEditorComponentKey = key;
				prevValuePropForEffect = value;
			});
		}
	});

	onDestroy(() => {
		destroyEditor();
	});
</script>

<div bind:this={editorContainer} class="milkdown-editor min-h-[400px]" class:readonly></div>

<style>
	.milkdown-editor {
		display: flex;
		flex-direction: column;
	}

	.milkdown-editor.readonly {
		pointer-events: none;
		opacity: 0.7;
	}

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
		min-height: inherit;
		height: 100%;
		padding: 0;
	}

	:global(.milkdown .ProseMirror) {
		padding: 0.5rem;
		min-height: inherit;
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
		flex-grow: 1;
	}
</style>
