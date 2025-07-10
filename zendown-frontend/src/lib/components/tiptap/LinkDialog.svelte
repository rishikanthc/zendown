<script lang="ts">
	import { Editor } from '@tiptap/core';
	import { Input } from '$lib/components/ui/input';
	import * as Sheet from '$lib/components/ui/sheet';

	interface Props {
		showLinkDialog: boolean;
		linkUrl: string;
		editor: Editor | null;
		onClose: () => void;
		onUrlChange: (url: string) => void;
	}

	let {
		showLinkDialog,
		linkUrl,
		editor,
		onClose,
		onUrlChange
	}: Props = $props();

	function handleInsertLink() {
		if (linkUrl && editor) {
			editor.chain().focus().setLink({ href: linkUrl }).run();
			onClose();
			onUrlChange('');
		}
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			handleInsertLink();
		}
	}
</script>

<Sheet.Root bind:open={showLinkDialog}>
	<Sheet.Content class="bg-white border-l border-gray-200 shadow-xl">
		<Sheet.Header class="border-b border-gray-100 pb-4">
			<Sheet.Title class="text-lg font-semibold text-gray-900">Insert Link</Sheet.Title>
			<Sheet.Description class="text-sm text-gray-600 mt-1">Enter the URL for your link or use markdown syntax: [text](url)</Sheet.Description>
		</Sheet.Header>
		<div class="grid gap-6 py-6">
			<div class="grid gap-3">
				<label for="link-url" class="text-sm font-medium text-gray-700">URL</label>
				<Input 
					id="link-url"
					bind:value={linkUrl}
					placeholder="https://example.com"
					class="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
					onkeydown={handleKeyDown}
				/>
			</div>
			<div class="text-xs text-gray-600 bg-gray-50 p-4 rounded-lg border border-gray-100">
				<strong class="text-gray-700">Tip:</strong> You can also type markdown link syntax directly in the editor: <code class="bg-white px-2 py-1 rounded border text-gray-800 font-mono">[link text](https://example.com)</code>
			</div>
		</div>
		<Sheet.Footer class="border-t border-gray-100 pt-4">
			<button 
				class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
				onclick={onClose}
			>
				Cancel
			</button>
			<button 
				class="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors ml-auto"
				onclick={handleInsertLink}
			>
				Insert Link
			</button>
		</Sheet.Footer>
	</Sheet.Content>
</Sheet.Root> 