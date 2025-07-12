<script lang="ts">
	import { getWordCount } from '$lib/utils';

	interface Props {
		content: string;
	}

	let { content }: Props = $props();

	let wordCount = $state(0);

	$effect(() => {
		if (content) {
			const newWordCount = getWordCount(content);
			wordCount = newWordCount;
		} else {
			wordCount = 0;
		}
	});
</script>

<div class="word-count">
	{wordCount} words
</div>

<style>
	.word-count {
		position: fixed;
		bottom: 1rem;
		right: 1rem;
		z-index: 40;
		background: rgba(255, 255, 255, 0.9);
		backdrop-filter: blur(8px);
		padding: 0.375rem 0.5rem;
		border-radius: 0.375rem;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
		transition: all 0.2s ease-in-out;
		opacity: 0.8;
		font-size: 0.75rem;
	}

	@media (min-width: 640px) {
		.word-count {
			bottom: 1.5rem;
			right: 1.5rem;
			padding: 0.5rem 0.75rem;
			border-radius: 0.5rem;
			font-size: 0.875rem;
		}
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