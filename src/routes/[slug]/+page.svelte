<script lang="ts">
	import NotePanel from '../NotePanel.svelte';
	import type { PageData } from './+page.server';

	let { data }: { data: PageData } = $props();
</script>

<div class="flex h-screen w-full flex-col dark:bg-gray-900">
	<header class="sticky top-0 right-0 z-20 px-4 py-3 sm:px-6">
		<a
			href="/"
			class="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
		>
			Back to Notes
		</a>
	</header>

	<div class="overflow-y-auto">
		<NotePanel initialContent={data.note.content} />
	</div>
</div>
