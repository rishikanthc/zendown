<script lang="ts">
	import { Editor } from '@tiptap/core';
	
	// Lucide icons
	import BoldIcon from '@lucide/svelte/icons/bold';
	import ItalicIcon from '@lucide/svelte/icons/italic';
	import UnderlineIcon from '@lucide/svelte/icons/underline';
	import StrikethroughIcon from '@lucide/svelte/icons/strikethrough';
	import CodeIcon from '@lucide/svelte/icons/code';
	import Heading1Icon from '@lucide/svelte/icons/heading-1';
	import Heading2Icon from '@lucide/svelte/icons/heading-2';
	import Heading3Icon from '@lucide/svelte/icons/heading-3';
	import ListIcon from '@lucide/svelte/icons/list';
	import ListOrderedIcon from '@lucide/svelte/icons/list-ordered';
	import LinkIcon from '@lucide/svelte/icons/link';
	import TableIcon from '@lucide/svelte/icons/table';
	import Code2Icon from '@lucide/svelte/icons/code-2';
	import QuoteIcon from '@lucide/svelte/icons/quote';
	import MinusIcon from '@lucide/svelte/icons/minus';
	import UndoIcon from '@lucide/svelte/icons/undo';
	import RedoIcon from '@lucide/svelte/icons/redo';
	import SquareFunctionIcon from '@lucide/svelte/icons/square-function';

	interface Props {
		editor: Editor | null;
		editorState: {
			isBold: boolean;
			isItalic: boolean;
			isUnderline: boolean;
			isStrike: boolean;
			isCode: boolean;
			isHeading1: boolean;
			isHeading2: boolean;
			isHeading3: boolean;
			isBulletList: boolean;
			isOrderedList: boolean;
			isCodeBlock: boolean;
			isBlockquote: boolean;
			isLink: boolean;
			isTable: boolean;
		};
		onLinkClick: () => void;
		onTableClick: () => void;
		onAddTableRow: () => void;
		onAddTableColumn: () => void;
		onDeleteTableRow: () => void;
		onDeleteTableColumn: () => void;
	}

	let {
		editor,
		editorState,
		onLinkClick,
		onTableClick,
		onAddTableRow,
		onAddTableColumn,
		onDeleteTableRow,
		onDeleteTableColumn
	}: Props = $props();
</script>

<div class="flex flex-wrap items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 bg-background/50 backdrop-blur-sm">
	{#if editor}
		<!-- Text formatting -->
		<div class="flex items-center gap-1">
			<button 
				class="p-1.5 sm:p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors {editorState.isBold ? 'text-foreground bg-gray-100 shadow-sm' : ''}"
				onclick={() => editor?.chain().focus().toggleBold().run()}
				title="Bold"
			>
				<BoldIcon class="h-4 w-4" />
			</button>
			<button 
				class="p-1.5 sm:p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors {editorState.isItalic ? 'text-foreground bg-gray-100 shadow-sm' : ''}"
				onclick={() => editor?.chain().focus().toggleItalic().run()}
				title="Italic"
			>
				<ItalicIcon class="h-4 w-4" />
			</button>
			<button 
				class="p-1.5 sm:p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors {editorState.isUnderline ? 'text-foreground bg-gray-100 shadow-sm' : ''}"
				onclick={() => editor?.chain().focus().toggleUnderline().run()}
				title="Underline"
			>
				<UnderlineIcon class="h-4 w-4" />
			</button>
			<button 
				class="p-1.5 sm:p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors {editorState.isStrike ? 'text-foreground bg-gray-100 shadow-sm' : ''}"
				onclick={() => editor?.chain().focus().toggleStrike().run()}
				title="Strikethrough"
			>
				<StrikethroughIcon class="h-4 w-4" />
			</button>
			<button 
				class="p-1.5 sm:p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors {editorState.isCode ? 'text-foreground bg-gray-100 shadow-sm' : ''}"
				onclick={() => editor?.chain().focus().toggleCode().run()}
				title="Code"
			>
				<CodeIcon class="h-4 w-4" />
			</button>
		</div>

		<div class="w-px h-4 bg-border hidden sm:block"></div>

		<!-- Headings -->
		<div class="flex items-center gap-1">
			<button 
				class="p-1.5 sm:p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors {editorState.isHeading1 ? 'text-foreground bg-gray-100 shadow-sm' : ''}"
				onclick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
				title="Heading 1"
			>
				<Heading1Icon class="h-4 w-4" />
			</button>
			<button 
				class="p-1.5 sm:p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors {editorState.isHeading2 ? 'text-foreground bg-gray-100 shadow-sm' : ''}"
				onclick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
				title="Heading 2"
			>
				<Heading2Icon class="h-4 w-4" />
			</button>
			<button 
				class="p-1.5 sm:p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors {editorState.isHeading3 ? 'text-foreground bg-gray-100 shadow-sm' : ''}"
				onclick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
				title="Heading 3"
			>
				<Heading3Icon class="h-4 w-4" />
			</button>
		</div>

		<div class="w-px h-4 bg-border hidden sm:block"></div>

		<!-- Lists -->
		<div class="flex items-center gap-1">
			<button 
				class="p-1.5 sm:p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors {editorState.isBulletList ? 'text-foreground bg-gray-100 shadow-sm' : ''}"
				onclick={() => editor?.chain().focus().toggleBulletList().run()}
				title="Bullet List"
			>
				<ListIcon class="h-4 w-4" />
			</button>
			<button 
				class="p-1.5 sm:p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors {editorState.isOrderedList ? 'text-foreground bg-gray-100 shadow-sm' : ''}"
				onclick={() => editor?.chain().focus().toggleOrderedList().run()}
				title="Ordered List"
			>
				<ListOrderedIcon class="h-4 w-4" />
			</button>
		</div>

		<div class="w-px h-4 bg-border hidden sm:block"></div>

		<!-- Links, Tables, and Math -->
		<div class="flex items-center gap-1">
			<button 
				class="p-1.5 sm:p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors {editorState.isLink ? 'text-foreground bg-gray-100 shadow-sm' : ''}"
				onclick={onLinkClick}
				title="Insert Link"
			>
				<LinkIcon class="h-4 w-4" />
			</button>
			<button 
				class="p-1.5 sm:p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
				onclick={onTableClick}
				title="Insert Table"
			>
				<TableIcon class="h-4 w-4" />
			</button>
			<button 
				class="p-1.5 sm:p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
				onclick={() => {
					const mathExpression = prompt('Enter LaTeX math expression (e.g., \\frac{1}{2}):');
					if (mathExpression && editor) {
						editor.chain().focus().insertContent(`$${mathExpression}$`).run();
					}
				}}
				title="Insert Math Expression"
			>
				<SquareFunctionIcon class="h-4 w-4" />
			</button>
		</div>

		<div class="w-px h-4 bg-border hidden sm:block"></div>

		<!-- Table Management -->
		{#if editor && editorState.isTable}
			<div class="flex items-center gap-1">
				<button 
					class="p-1.5 sm:p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
					onclick={onAddTableRow}
					title="Add Row"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
					</svg>
				</button>
				<button 
					class="p-1.5 sm:p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
					onclick={onAddTableColumn}
					title="Add Column"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
					</svg>
				</button>
				<button 
					class="p-1.5 sm:p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
					onclick={onDeleteTableRow}
					title="Delete Row"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"/>
					</svg>
				</button>
				<button 
					class="p-1.5 sm:p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
					onclick={onDeleteTableColumn}
					title="Delete Column"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
					</svg>
				</button>
			</div>
		{/if}

		<div class="w-px h-4 bg-border hidden sm:block"></div>

		<!-- Blocks -->
		<div class="flex items-center gap-1">
			<button 
				class="p-1.5 sm:p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors {editorState.isCodeBlock ? 'text-foreground bg-gray-100 shadow-sm' : ''}"
				onclick={() => editor?.chain().focus().toggleCodeBlock().run()}
				title="Code Block"
			>
				<Code2Icon class="h-4 w-4" />
			</button>
			<button 
				class="p-1.5 sm:p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors {editorState.isBlockquote ? 'text-foreground bg-gray-100 shadow-sm' : ''}"
				onclick={() => editor?.chain().focus().toggleBlockquote().run()}
				title="Blockquote"
			>
				<QuoteIcon class="h-4 w-4" />
			</button>
			<button 
				class="p-1.5 sm:p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
				onclick={() => editor?.chain().focus().setHorizontalRule().run()}
				title="Horizontal Rule"
			>
				<MinusIcon class="h-4 w-4" />
			</button>
		</div>

		<div class="w-px h-4 bg-border hidden sm:block"></div>

		<!-- History -->
		<div class="flex items-center gap-1">
			<button 
				class="p-1.5 sm:p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
				onclick={() => editor?.chain().focus().undo().run()}
				title="Undo"
			>
				<UndoIcon class="h-4 w-4" />
			</button>
			<button 
				class="p-1.5 sm:p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
				onclick={() => editor?.chain().focus().redo().run()}
				title="Redo"
			>
				<RedoIcon class="h-4 w-4" />
			</button>
		</div>
	{:else}
		<div class="flex items-center gap-2 text-muted-foreground">
			<span class="text-sm">Loading editor...</span>
		</div>
	{/if}
</div> 