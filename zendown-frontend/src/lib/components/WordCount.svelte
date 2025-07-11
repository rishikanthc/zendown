<script lang="ts">
	import { getWordCount } from '$lib/utils';

	interface Props {
		content: string;
		class?: string;
	}

	let { content = '', class: className = '' }: Props = $props();

	// Calculate word count reactively
	let wordCount = $derived(getWordCount(content));
	
	// Debug logging to see when content changes
	$effect(() => {
		console.log('WordCount: Content changed, new word count:', wordCount, 'Content length:', content.length);
	});
	
	// Force reactivity by watching content changes
	$effect(() => {
		// This effect will run whenever content changes
		const newWordCount = getWordCount(content);
		console.log('WordCount effect triggered:', newWordCount);
	});
</script>

{#if wordCount > 0}
	<div 
		class="word-count {className}"
		class:zen-mode={typeof window !== 'undefined' && document.documentElement.classList.contains('zen-mode')}
	>
		<span class="word-count-text">{wordCount} word{wordCount === 1 ? '' : 's'}</span>
	</div>
{/if}

<style>
	.word-count {
		position: fixed;
		bottom: 1.5rem;
		right: 1.5rem;
		z-index: 40;
		background: rgba(255, 255, 255, 0.9);
		backdrop-filter: blur(8px);
		padding: 0.5rem 0.75rem;
		border-radius: 0.5rem;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
		transition: all 0.2s ease-in-out;
		opacity: 0.8;
	}

	.word-count:hover {
		opacity: 1;
		box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
		transform: translateY(-1px);
	}

	.word-count.zen-mode {
		background: rgba(0, 0, 0, 0.8);
		color: rgba(255, 255, 255, 0.9);
	}

	.word-count-text {
		font-size: 0.875rem;
		font-weight: 500;
		color: #6b7280;
		letter-spacing: 0.025em;
	}

	.word-count.zen-mode .word-count-text {
		color: rgba(255, 255, 255, 0.8);
	}

	/* Dark mode support */
	@media (prefers-color-scheme: dark) {
		.word-count {
			background: rgba(17, 24, 39, 0.9);
		}
		
		.word-count-text {
			color: #d1d5db;
		}
	}
</style> 