<script lang="ts">
	import { Editor } from '@tiptap/core';
	import { Input } from '$lib/components/ui/input';
	import * as Sheet from '$lib/components/ui/sheet';

	interface Props {
		showTableDialog: boolean;
		tableRows: number;
		tableCols: number;
		editor: Editor | null;
		onClose: () => void;
		onRowsChange: (rows: number) => void;
		onColsChange: (cols: number) => void;
	}

	let {
		showTableDialog,
		tableRows,
		tableCols,
		editor,
		onClose,
		onRowsChange,
		onColsChange
	}: Props = $props();

	function handleInsertTable() {
		if (editor) {
			editor.chain().focus().insertTable({ 
				rows: tableRows, 
				cols: tableCols, 
				withHeaderRow: true 
			}).run();
			onClose();
		}
	}
</script>

<Sheet.Root bind:open={showTableDialog}>
	<Sheet.Content class="bg-white border-l border-gray-200 shadow-xl">
		<Sheet.Header class="border-b border-gray-100 pb-4">
			<Sheet.Title class="text-lg font-semibold text-gray-900">Insert Table</Sheet.Title>
			<Sheet.Description class="text-sm text-gray-600 mt-1">Choose the size of your table</Sheet.Description>
		</Sheet.Header>
		<div class="grid gap-6 py-6">
			<div class="grid grid-cols-2 gap-6">
				<div class="grid gap-3">
					<label for="table-rows" class="text-sm font-medium text-gray-700">Rows</label>
					<Input 
						id="table-rows"
						type="number"
						min="1"
						max="10"
						bind:value={tableRows}
						class="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
					/>
				</div>
				<div class="grid gap-3">
					<label for="table-cols" class="text-sm font-medium text-gray-700">Columns</label>
					<Input 
						id="table-cols"
						type="number"
						min="1"
						max="10"
						bind:value={tableCols}
						class="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
					/>
				</div>
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
				onclick={handleInsertTable}
			>
				Insert Table
			</button>
		</Sheet.Footer>
	</Sheet.Content>
</Sheet.Root> 