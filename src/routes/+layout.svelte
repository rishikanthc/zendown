<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	import { onMount, onDestroy, setContext } from 'svelte';
	import SemanticSearchDialog from '$lib/components/ui/semantic-search-dialog/SemanticSearchDialog.svelte';

	let { children } = $props();

	let showSemanticSearchDialog = $state(false);

	function openSemanticSearchDialog() {
		showSemanticSearchDialog = true;
		if (typeof document !== 'undefined') {
			document.body.classList.add('modal-open');
		}
	}

	setContext('openSemanticSearchDialog', openSemanticSearchDialog);

	function closeSemanticSearchDialog() {
		showSemanticSearchDialog = false;
		if (typeof document !== 'undefined') {
			document.body.classList.remove('modal-open');
		}
	}

	function handleGlobalKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			if (showSemanticSearchDialog) {
				closeSemanticSearchDialog();
			}
		}
		// Handle Cmd+K or Ctrl+K for semantic search
		if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
			event.preventDefault();
			if (showSemanticSearchDialog) {
				// If dialog is already open, Cmd+K could optionally close it or do nothing.
				// For now, let's make it toggle or simply re-focus if that's handled internally.
				// Or, just ensure it doesn't open another instance.
				// The current SemanticSearchDialog handles its own focus and state when 'open' prop changes.
			} else {
				openSemanticSearchDialog();
			}
		}
	}

	onMount(() => {
		if (typeof window !== 'undefined') {
			window.addEventListener('keydown', handleGlobalKeyDown);
		}
		return () => {
			if (typeof window !== 'undefined') {
				window.removeEventListener('keydown', handleGlobalKeyDown);
				// Ensure modal-open is removed if the layout unmounts while dialog is open
				if (showSemanticSearchDialog && typeof document !== 'undefined') {
					document.body.classList.remove('modal-open');
				}
			}
		};
	});
</script>

<svelte:head>
	<title>{$page.data.siteTitle}</title>
</svelte:head>

{@render children()}

{#if showSemanticSearchDialog}
	<SemanticSearchDialog open={showSemanticSearchDialog} onClose={closeSemanticSearchDialog} />
{/if}
