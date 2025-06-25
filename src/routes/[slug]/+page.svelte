<script lang="ts">
	import NotePanel from '../NotePanel.svelte';
	import type { PageData } from './+page.server';

	let { data }: { data: PageData } = $props();
</script>

<div class="h-full w-full">
	<NotePanel content={data.note.content} id={data.note.id} />
</div>
