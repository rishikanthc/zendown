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
	async function updateEditorContent(newValue: string) {
		if (!milkdownEditor || !isInitialized || isUpdatingFromProp) return;

		try {
			isUpdatingFromProp = true;

			// For significant content changes (like navigation), recreate the editor
			// This is more reliable than trying to update the content in place
			await destroyEditor();
			// Update the value that will be used during initialization
			value = newValue;
			await initializeEditor();
		} catch (error) {
			console.error('Failed to update editor content:', error);
		} finally {
			setTimeout(() => {
				isUpdatingFromProp = false;
			}, 100); // Longer timeout for recreation
		}
	}

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
	$effect(() => {
		// Track both value and key props explicitly
		const newValue = value;
		const currentKey = key;

		if (isInitialized) {
			const currentContent = getCurrentContent();
			// If content is significantly different or key changed, update
			if (newValue !== currentContent || currentKey !== key) {
				updateEditorContent(newValue);
			}
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
