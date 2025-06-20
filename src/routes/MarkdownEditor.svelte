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
	let lastPropKey = key;

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
				// .config(nord)
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

	// Update editor content without destroying/recreating
	async function updateEditorContent(newValue: string) {
		if (!milkdownEditor || !isInitialized) return;

		const currentContent = getCurrentContent();
		if (currentContent === newValue) {
			return; // No need to update if content is the same
		}

		try {
			isUpdatingFromProp = true;

			// Use action to update content without destroying editor
			milkdownEditor.action((ctx) => {
				const view = ctx.get(editorViewCtx);
				const parser = ctx.get(serializerCtx);

				// Create new document from markdown
				const newDoc = view.state.schema.nodeFromJSON(
					view.state.schema.topNodeType.createAndFill().toJSON()
				);

				// Replace content by dispatching a transaction
				const tr = view.state.tr.replaceWith(0, view.state.doc.content.size, newDoc.content);
				view.dispatch(tr);

				// Set the new markdown content
				ctx.set(defaultValueCtx, newValue);
			});
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
	:global(.milkdown .editor) {
		outline: none !important;
		border: none !important;

		/* font-family: 'Noto Sans', sans-serif !important;
		line-height: 1.7 !important;
		color: inherit !important;
		background: transparent !important;
		min-height: inherit; */
		height: 100%;
		padding: 0;
	}
	/* .milkdown-editor {
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
	} */

	/* :global(.milkdown .ProseMirror) {
		padding: 0.5rem;
		min-height: inherit;
		height: 100%;
		box-sizing: border-box;
	} */

	:global(.milkdown .prose) {
		max-width: none !important;
		/* color: inherit !important; */
	}
	/*
	:global(.milkdown-editor .milkdown) {
		padding: 0 !important;
		margin: 0 !important;
		flex-grow: 1;
	} */
</style>
