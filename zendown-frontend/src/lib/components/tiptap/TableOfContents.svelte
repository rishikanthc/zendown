<script lang="ts">
	import { TextSelection } from '@tiptap/pm/state';
	import type { Editor } from '@tiptap/core';

	interface ToCItem {
		id: string;
		textContent: string;
		level: number;
		itemIndex: number;
		isActive: boolean;
		isScrolledOver: boolean;
	}

	interface Props {
		items?: ToCItem[];
		editor?: Editor | null;
	}

	let { items = [], editor }: Props = $props();

	function onItemClick(e: Event, id: string) {
		e.preventDefault();

		if (editor) {
			const element = editor.view.dom.querySelector(`[data-toc-id="${id}"]`);
			if (!element) return;

			const pos = editor.view.posAtDOM(element, 0);

			// Set focus
			const tr = editor.view.state.tr;
			tr.setSelection(new TextSelection(tr.doc.resolve(pos)));
			editor.view.dispatch(tr);
			editor.view.focus();

			// Update URL
			if (history.pushState) {
				history.pushState(null, '', `#${id}`);
			}

			// Smooth scroll to element
			window.scrollTo({
				top: element.getBoundingClientRect().top + window.scrollY - 100, // Offset for better positioning
				behavior: 'smooth',
			});
		}
	}
</script>

{#if items.length === 0}
	<div class="empty-state">
		<p>Start editing your document to see the outline.</p>
	</div>
{:else}
	{#each items as item, i}
		<div
			class="toc-item"
			class:is-active={item.isActive && !item.isScrolledOver}
			class:is-scrolled-over={item.isScrolledOver}
			style="--level: {item.level}"
		>
			<a
				href="#{item.id}"
				onclick={(e) => onItemClick(e, item.id)}
				data-item-index={item.itemIndex}
			>
				{item.textContent}
			</a>
		</div>
	{/each}
{/if}

<style>
	.empty-state {
		color: #6b7280;
		user-select: none;
		font-size: 0.875rem;
		text-align: center;
		padding: 1rem;
		font-family: 'Noto Sans', sans-serif;
	}

	.toc-item {
		border-radius: 0.25rem;
		padding-left: calc(0.5rem * (var(--level) - 1));
		transition: all 0.15s ease-in-out;
		margin-bottom: 0.125rem;
	}

	.toc-item:hover {
		background-color: #f9fafb;
	}

	.toc-item.is-active a {
		color: #6366f1;
		font-weight: 500;
	}

	.toc-item.is-scrolled-over a {
		color: #9ca3af;
	}

	.toc-item a {
		color: #6b7280;
		display: block;
		text-decoration: none;
		font-size: 0.75rem;
		line-height: 1.3;
		padding: 0.125rem 0.25rem;
		border-radius: 0.25rem;
		transition: color 0.15s ease-in-out;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		font-family: 'Noto Sans', sans-serif;
	}

	/* Dark mode support */
	@media (prefers-color-scheme: dark) {
		.empty-state {
			color: #9ca3af;
		}

		.toc-item:hover {
			background-color: #374151;
		}

		.toc-item.is-active a {
			color: #818cf8;
		}

		.toc-item.is-scrolled-over a {
			color: #6b7280;
		}

		.toc-item a {
			color: #d1d5db;
		}
	}
</style> 