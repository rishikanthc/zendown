<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Editor } from '@tiptap/core';
	
	// Import modular components
	import { Toolbar, LinkDialog, TableDialog, EditorContent, TableOfContents, createEditor, updateEditorState, handlePaste, handleDrop, addTableRow, addTableColumn, deleteTableRow, deleteTableColumn } from './components/tiptap';
	import type { EditorState } from './components/tiptap';

	interface Props {
		value?: string;
		onChange?: (value: string) => void;
		onSave?: (isAutoSave?: boolean) => void;
		placeholder?: string;
		readonly?: boolean;
		showToolbar?: boolean;
		isZenMode?: boolean;
	}

	let {
		value = $bindable(''),
		onChange,
		onSave,
		placeholder = 'Start writing your thoughts...',
		readonly = false,
		showToolbar = true,
		isZenMode = false
	}: Props = $props();

	let editor = $state<Editor | null>(null);
	let editorContentComponent: any;

	// Reactive state for toolbar buttons
	let editorState = $state<EditorState>({
		isBold: false,
		isItalic: false,
		isUnderline: false,
		isStrike: false,
		isCode: false,
		isHeading1: false,
		isHeading2: false,
		isHeading3: false,
		isBulletList: false,
		isOrderedList: false,
		isCodeBlock: false,
		isBlockquote: false,
		isLink: false,
		isTable: false,
	});

	// Auto-save functionality
	let saveTimeout: number;
	let lastSavedContent = '';
	let isSettingContent = $state(false); // Flag to prevent auto-save when setting content programmatically
	
	// Dialog states
	let showLinkDialog = $state(false);
	let showTableDialog = $state(false);
	let linkUrl = $state('');
	let tableRows = $state(3);
	let tableCols = $state(3);

	// Table of contents state
	let tableOfContentsItems = $state<any[]>([]);

	function handleContentChange() {
		if (!editor || readonly || isSettingContent) return;

		const content = editor.getHTML();
		if (onChange) {
			onChange(content);
		}

		// Update editor state for toolbar
		editorState = updateEditorState(editor);

		// Only auto-save if content has actually changed from last saved content
		if (content !== lastSavedContent) {
			// Auto-save after 2 seconds of inactivity
			clearTimeout(saveTimeout);
			saveTimeout = setTimeout(() => {
				if (onSave) {
					onSave(true); // Pass true to indicate this is an auto-save
					lastSavedContent = content;
				}
			}, 2000);
		}
	}

	function handleTransaction() {
		// Update editor state on every transaction
		editorState = updateEditorState(editor);
	}

	function handleTableOfContentsUpdate(items: any[]) {
		tableOfContentsItems = items;
	}

	// Dialog handlers
	function handleLinkClick() {
		showLinkDialog = true;
	}

	function handleTableClick() {
		showTableDialog = true;
	}

	function handleLinkClose() {
		showLinkDialog = false;
	}

	function handleTableClose() {
		showTableDialog = false;
	}

	function handleLinkUrlChange(url: string) {
		linkUrl = url;
	}

	function handleTableRowsChange(rows: number) {
		tableRows = rows;
	}

	function handleTableColsChange(cols: number) {
		tableCols = cols;
	}

	// Table management handlers
	function handleAddTableRow() {
		addTableRow(editor);
	}

	function handleAddTableColumn() {
		addTableColumn(editor);
	}

	function handleDeleteTableRow() {
		deleteTableRow(editor);
	}

	function handleDeleteTableColumn() {
		deleteTableColumn(editor);
	}

	onMount(() => {
		if (!editorContentComponent?.element) return;

		editor = createEditor(editorContentComponent.element, {
			content: value,
			placeholder,
			readonly,
			onUpdate: handleContentChange,
			onTransaction: handleTransaction,
			onTableOfContentsUpdate: handleTableOfContentsUpdate,
		});

		// Set initial content
		if (value && editor) {
			isSettingContent = true;
			editor.commands.setContent(value);
			lastSavedContent = value;
			// Reset the flag after a short delay to allow the editor to update
			setTimeout(() => {
				isSettingContent = false;
			}, 100);
		}

		// Add event listeners
		editorContentComponent.element.addEventListener('paste', (e: ClipboardEvent) => handlePaste(e, editor));
		editorContentComponent.element.addEventListener('drop', (e: DragEvent) => handleDrop(e, editor));
		editorContentComponent.element.addEventListener('dragover', (e: DragEvent) => e.preventDefault());
	});

	onDestroy(() => {
		if (editor) {
			editor.destroy();
		}
		clearTimeout(saveTimeout);
	});

	// Update content when value prop changes
	$effect(() => {
		if (editor && value !== editor.getHTML()) {
			isSettingContent = true;
			editor.commands.setContent(value);
			lastSavedContent = value;
			// Reset the flag after a short delay to allow the editor to update
			setTimeout(() => {
				isSettingContent = false;
			}, 100);
		}
	});

	// Update readonly state
	$effect(() => {
		if (editor) {
			editor.setEditable(!readonly);
		}
	});
</script>

<div class="editor-container" class:zen-mode={isZenMode}>
	<div class="editor-main">
		{#if showToolbar}
			<div class="toolbar-wrapper">
				<Toolbar 
					{editor}
					{editorState}
					onLinkClick={handleLinkClick}
					onTableClick={handleTableClick}
					onAddTableRow={handleAddTableRow}
					onAddTableColumn={handleAddTableColumn}
					onDeleteTableRow={handleDeleteTableRow}
					onDeleteTableColumn={handleDeleteTableColumn}
				/>
			</div>
		{/if}
		<EditorContent 
			bind:this={editorContentComponent}
			{readonly}
		/>
	</div>
	{#if !isZenMode}
		<div class="editor-sidebar">
			<div class="sidebar-content">
				<div class="sidebar-title">Table of Contents</div>
				<div class="table-of-contents">
					<TableOfContents items={tableOfContentsItems} {editor} />
				</div>
			</div>
		</div>
	{/if}
</div>

<LinkDialog 
	showLinkDialog={showLinkDialog}
	{linkUrl}
	{editor}
	onClose={handleLinkClose}
	onUrlChange={handleLinkUrlChange}
/>

<TableDialog 
	showTableDialog={showTableDialog}
	{tableRows}
	{tableCols}
	{editor}
	onClose={handleTableClose}
	onRowsChange={handleTableRowsChange}
	onColsChange={handleTableColsChange}
/>

<style>
	.editor-container {
		display: flex;
		flex-direction: row;
		min-height: 0;
		gap: 6rem;
		align-items: flex-start;
	}

	.editor-main {
		flex: 0 0 800px;
		display: flex;
		flex-direction: column;
		position: relative;
	}

	.toolbar-wrapper {
		position: sticky;
		top: 0;
		z-index: 10;
		background: rgba(255, 255, 255, 0.95);
		backdrop-filter: blur(8px);
		margin: 0 -1rem;
		padding: 0 1rem;
	}

	.editor-sidebar {
		flex: 0 0 200px;
		position: sticky;
		top: 1rem;
		max-height: calc(100vh - 2rem);
		overflow-y: auto;
		padding: 0;
	}

	.sidebar-content {
		display: flex;
		flex-direction: column;
		height: 100%;
		gap: 0.75rem;
	}

	.sidebar-title {
		font-family: 'Noto Sans', sans-serif;
		font-weight: 500;
		font-size: 0.75rem;
		color: #6b7280;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 0.25rem;
	}

	.table-of-contents {
		display: flex;
		flex-direction: column;
		font-size: 0.75rem;
		gap: 0.125rem;
		overflow: auto;
		text-decoration: none;
		flex: 1;
		font-family: 'Noto Sans', sans-serif;
	}

	/* Zen mode styles */
	.editor-container.zen-mode {
		gap: 0;
		justify-content: center;
		align-items: center;
		height: 100vh;
		padding: 2rem;
	}

	.editor-container.zen-mode .editor-main {
		flex: 1;
		max-width: 800px;
		width: 100%;
		height: 100%;
	}

	.editor-container.zen-mode .toolbar-wrapper {
		position: sticky;
		top: 0;
		z-index: 10;
		background: rgba(255, 255, 255, 0.95);
		backdrop-filter: blur(8px);
		margin: 0;
		padding: 0;
	}

	/* Responsive design */
	@media (max-width: 1024px) {
		.editor-container {
			flex-direction: column-reverse;
			gap: 1rem;
		}

		.editor-main {
			flex: 1;
			min-width: 0;
		}

		.toolbar-wrapper {
			position: sticky;
			top: 0;
			z-index: 10;
			background: rgba(255, 255, 255, 0.95);
			backdrop-filter: blur(8px);
			margin: 0;
			padding: 0 1rem;
		}

		.editor-sidebar {
			flex: 1;
			position: unset;
			height: auto;
			max-height: 200px;
			border-top: 1px solid #e5e7eb;
			padding: 1rem;
		}

		.sidebar-content {
			gap: 0.5rem;
		}

		.table-of-contents {
			max-height: 150px;
		}

		/* Zen mode responsive */
		.editor-container.zen-mode {
			padding: 1rem;
		}
	}

	.tiptap-editor {
		flex: 1;
		overflow-y: auto;
		min-height: 0;
		padding: 1rem;
	}

	.tiptap-editor.readonly {
		opacity: 0.7;
		pointer-events: none;
	}

	:global(.ProseMirror) {
		outline: none;
		font-family: 'Noto Sans', sans-serif;
		line-height: 1.7;
		color: #374151;
	}

	:global(.ProseMirror:first-child) {
		margin-top: 0;
	}

	/* Paragraphs */
	:global(.ProseMirror p) {
		margin: 0.75rem 0;
		font-size: 1rem;
		line-height: 1.7;
	}

	/* Headings with Space Grotesk */
	:global(.ProseMirror h1) {
		font-family: 'Space Grotesk', sans-serif;
		font-size: 2.25rem;
		font-weight: 600;
		margin: 2rem 0 1rem 0;
		color: #111827;
		line-height: 1.2;
		letter-spacing: -0.025em;
	}

	:global(.ProseMirror h2) {
		font-family: 'Space Grotesk', sans-serif;
		font-size: 1.875rem;
		font-weight: 600;
		margin: 1.75rem 0 0.75rem 0;
		color: #111827;
		line-height: 1.3;
		letter-spacing: -0.025em;
	}

	:global(.ProseMirror h3) {
		font-family: 'Space Grotesk', sans-serif;
		font-size: 1.5rem;
		font-weight: 600;
		margin: 1.5rem 0 0.5rem 0;
		color: #111827;
		line-height: 1.4;
		letter-spacing: -0.025em;
	}

	:global(.ProseMirror h4) {
		font-family: 'Space Grotesk', sans-serif;
		font-size: 1.25rem;
		font-weight: 600;
		margin: 1.25rem 0 0.5rem 0;
		color: #111827;
		line-height: 1.4;
		letter-spacing: -0.025em;
	}

	:global(.ProseMirror h5) {
		font-family: 'Space Grotesk', sans-serif;
		font-size: 1.125rem;
		font-weight: 600;
		margin: 1rem 0 0.5rem 0;
		color: #111827;
		line-height: 1.4;
		letter-spacing: -0.025em;
	}

	:global(.ProseMirror h6) {
		font-family: 'Space Grotesk', sans-serif;
		font-size: 1rem;
		font-weight: 600;
		margin: 1rem 0 0.5rem 0;
		color: #111827;
		line-height: 1.4;
		letter-spacing: -0.025em;
	}

	/* Lists */
	:global(.ProseMirror ul) {
		margin: 0.75rem 0;
		padding-left: 1.5rem;
		list-style-type: disc;
	}

	:global(.ProseMirror ul li) {
		margin: 0.375rem 0;
		line-height: 1.6;
		color: #374151;
	}

	:global(.ProseMirror ul li::marker) {
		color: #6b7280;
		font-size: 0.875rem;
	}

	:global(.ProseMirror ol) {
		margin: 0.75rem 0;
		padding-left: 1.5rem;
		list-style-type: decimal;
	}

	:global(.ProseMirror ol li) {
		margin: 0.375rem 0;
		line-height: 1.6;
		color: #374151;
	}

	:global(.ProseMirror ol li::marker) {
		color: #6b7280;
		font-size: 0.875rem;
		font-weight: 500;
	}

	:global(.ProseMirror li p) {
		margin-top: 0.25em;
		margin-bottom: 0.25em;
	}

	/* Nested lists */
	:global(.ProseMirror ul ul) {
		list-style-type: circle;
		margin: 0.25rem 0;
	}

	:global(.ProseMirror ul ul li::marker) {
		color: #9ca3af;
		font-size: 0.75rem;
	}

	:global(.ProseMirror ul ul ul) {
		list-style-type: square;
	}

	:global(.ProseMirror ul ul ul li::marker) {
		color: #d1d5db;
		font-size: 0.75rem;
	}

	:global(.ProseMirror ol ol) {
		list-style-type: lower-alpha;
		margin: 0.25rem 0;
	}

	:global(.ProseMirror ol ol li::marker) {
		color: #9ca3af;
		font-size: 0.75rem;
		font-weight: 500;
	}

	:global(.ProseMirror ol ol ol) {
		list-style-type: lower-roman;
	}

	:global(.ProseMirror ol ol ol li::marker) {
		color: #d1d5db;
		font-size: 0.75rem;
		font-weight: 500;
	}

	/* Blockquotes */
	:global(.ProseMirror blockquote) {
		border-left: 4px solid #e5e7eb;
		padding: 1rem 1.5rem;
		margin: 1.5rem 0;
		font-style: italic;
		color: #6b7280;
		background-color: #f9fafb;
		border-radius: 0 0.5rem 0.5rem 0;
	}

	/* Callouts */
	:global(.ProseMirror .callout) {
		width: 100%;
		padding: 16px;
		border-radius: 8px;
		margin: 16px 0;
		background-color: #f8fafc;
		line-height: 1.6;
		font-size: 14px;
		position: relative;
	}

	/* Callout header with icon and label using pseudo-elements */
	:global(.ProseMirror .callout::before) {
		content: '';
		position: absolute;
		top: 16px;
		left: 16px;
		width: 16px;
		height: 16px;
		background-size: contain;
		background-repeat: no-repeat;
		background-position: center;
		z-index: 1;
	}

	:global(.ProseMirror .callout::after) {
		content: attr(data-callout);
		position: absolute;
		top: 16px;
		left: 40px;
		font-weight: 600;
		font-size: 13px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #374151;
		z-index: 1;
	}

	/* Callout content */
	:global(.ProseMirror .callout) {
		padding: 16px;
		padding-top: 48px;
	}

	:global(.ProseMirror .callout p) {
		margin: 8px 0;
		color: #374151;
	}

	:global(.ProseMirror .callout p:first-child) {
		margin-top: 0;
	}

	:global(.ProseMirror .callout p:last-child) {
		margin-bottom: 0;
	}

	/* Callout type-specific colors and icons */
	:global(.ProseMirror .callout[data-callout='note']) {
		background-color: #f0f9ff;
	}

	:global(.ProseMirror .callout[data-callout='note']::before) {
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%230ea5e9' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M16 4H2v12h14l4 4V4Z'/%3E%3Cpath d='M6 9h4'/%3E%3Cpath d='M6 13h4'/%3E%3C/svg%3E");
	}

	:global(.ProseMirror .callout[data-callout='note']::after) {
		color: #0ea5e9;
	}

	:global(.ProseMirror .callout[data-callout='info']) {
		background-color: #f0f9ff;
	}

	:global(.ProseMirror .callout[data-callout='info']::before) {
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%233b82f6' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpath d='M12 16v-4'/%3E%3Cpath d='M12 8h.01'/%3E%3C/svg%3E");
	}

	:global(.ProseMirror .callout[data-callout='info']::after) {
		color: #3b82f6;
	}

	:global(.ProseMirror .callout[data-callout='tip']) {
		background-color: #f0f9ff;
	}

	:global(.ProseMirror .callout[data-callout='tip']::before) {
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%233b82f6' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpath d='M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3'/%3E%3Cpath d='M12 17h.01'/%3E%3C/svg%3E");
	}

	:global(.ProseMirror .callout[data-callout='tip']::after) {
		color: #3b82f6;
	}

	:global(.ProseMirror .callout[data-callout='important']) {
		background-color: #fdf4ff;
	}

	:global(.ProseMirror .callout[data-callout='important']::before) {
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23a855f7' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z'/%3E%3Cpath d='M12 9v4'/%3E%3Cpath d='M12 17h.01'/%3E%3C/svg%3E");
	}

	:global(.ProseMirror .callout[data-callout='important']::after) {
		color: #a855f7;
	}

	:global(.ProseMirror .callout[data-callout='success']) {
		background-color: #f0fdf4;
	}

	:global(.ProseMirror .callout[data-callout='success']::before) {
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2322c55e' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M22 11.08V12a10 10 0 1 1-5.93-9.14'/%3E%3Cpolyline points='22,4 12,14.01 9,11.01'/%3E%3C/svg%3E");
	}

	:global(.ProseMirror .callout[data-callout='success']::after) {
		color: #22c55e;
	}

	:global(.ProseMirror .callout[data-callout='question']) {
		background-color: #f0f9ff;
	}

	:global(.ProseMirror .callout[data-callout='question']::before) {
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%233b82f6' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpath d='M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3'/%3E%3Cpath d='M12 17h.01'/%3E%3C/svg%3E");
	}

	:global(.ProseMirror .callout[data-callout='question']::after) {
		color: #3b82f6;
	}

	:global(.ProseMirror .callout[data-callout='warning']) {
		background-color: #fffbeb;
	}

	:global(.ProseMirror .callout[data-callout='warning']::before) {
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23f59e0b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z'/%3E%3Cpath d='M12 9v4'/%3E%3Cpath d='M12 17h.01'/%3E%3C/svg%3E");
	}

	:global(.ProseMirror .callout[data-callout='warning']::after) {
		color: #f59e0b;
	}

	:global(.ProseMirror .callout[data-callout='caution']) {
		background-color: #fef2f2;
	}

	:global(.ProseMirror .callout[data-callout='caution']::before) {
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23ef4444' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M13 2L3 14h9l-1 8 10-12h-9l1-8z'/%3E%3C/svg%3E");
	}

	:global(.ProseMirror .callout[data-callout='caution']::after) {
		color: #ef4444;
	}

	:global(.ProseMirror .callout[data-callout='failure']) {
		background-color: #fef2f2;
	}

	:global(.ProseMirror .callout[data-callout='failure']::before) {
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23ef4444' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpath d='m15 9-6 6'/%3E%3Cpath d='m9 9 6 6'/%3E%3C/svg%3E");
	}

	:global(.ProseMirror .callout[data-callout='failure']::after) {
		color: #ef4444;
	}

	:global(.ProseMirror .callout[data-callout='danger']) {
		background-color: #fef2f2;
	}

	:global(.ProseMirror .callout[data-callout='danger']::before) {
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23dc2626' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z'/%3E%3Cpath d='M12 8v4'/%3E%3Cpath d='M12 16h.01'/%3E%3C/svg%3E");
	}

	:global(.ProseMirror .callout[data-callout='danger']::after) {
		color: #dc2626;
	}

	:global(.ProseMirror .callout[data-callout='bug']) {
		background-color: #fef2f2;
	}

	:global(.ProseMirror .callout[data-callout='bug']::before) {
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23f87171' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m8 2 1.88 1.88'/%3E%3Cpath d='M14.12 3.88 16 2'/%3E%3Cpath d='M9 7.13v-1a3.003 3.003 0 0 1 6 0v1'/%3E%3Cpath d='M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6'/%3E%3Cpath d='M12 20v-9'/%3E%3Cpath d='M6.53 9C4.6 8.8 3 7.1 3 5'/%3E%3Cpath d='M6 13H2'/%3E%3Cpath d='M3 21c0-2.1 1.7-3.9 3.8-4'/%3E%3Cpath d='M20.97 5c0 2.1-1.6 3.8-3.5 4'/%3E%3Cpath d='M22 13h-4'/%3E%3Cpath d='M17.2 17c2.1.1 3.8 1.9 3.8 4'/%3E%3C/svg%3E");
	}

	:global(.ProseMirror .callout[data-callout='bug']::after) {
		color: #f87171;
	}

	:global(.ProseMirror .callout[data-callout='example']) {
		background-color: #f0fdf4;
	}

	:global(.ProseMirror .callout[data-callout='example']::before) {
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2310b981' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z'/%3E%3Cpath d='M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z'/%3E%3C/svg%3E");
	}

	:global(.ProseMirror .callout[data-callout='example']::after) {
		color: #10b981;
	}

	:global(.ProseMirror .callout[data-callout='todo']) {
		background-color: #f0f9ff;
	}

	:global(.ProseMirror .callout[data-callout='todo']::before) {
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%233b82f6' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect width='18' height='18' x='3' y='3' rx='2' ry='2'/%3E%3Cpath d='M9 12l2 2 4-4'/%3E%3C/svg%3E");
	}

	:global(.ProseMirror .callout[data-callout='todo']::after) {
		color: #3b82f6;
	}

	/* New callout types */
	:global(.ProseMirror .callout[data-callout='abstract']) {
		background-color: #fef7ff;
	}

	:global(.ProseMirror .callout[data-callout='abstract']::before) {
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23a855f7' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z'/%3E%3Cpolyline points='14,2 14,8 20,8'/%3E%3Cline x1='16' y1='13' x2='8' y2='13'/%3E%3Cline x1='16' y1='17' x2='8' y2='17'/%3E%3Cpolyline points='10,9 9,9 8,9'/%3E%3C/svg%3E");
	}

	:global(.ProseMirror .callout[data-callout='abstract']::after) {
		color: #a855f7;
	}

	:global(.ProseMirror .callout[data-callout='error']) {
		background-color: #fef2f2;
	}

	:global(.ProseMirror .callout[data-callout='error']::before) {
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23ef4444' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpath d='m15 9-6 6'/%3E%3Cpath d='m9 9 6 6'/%3E%3C/svg%3E");
	}

	:global(.ProseMirror .callout[data-callout='error']::after) {
		color: #ef4444;
	}

	/* Dark mode support */
	@media (prefers-color-scheme: dark) {
		.editor-sidebar {
			border-left-color: #374151;
		}

		.sidebar-title {
			color: #f3f4f6;
		}

		@media (max-width: 1024px) {
			.editor-sidebar {
				border-top-color: #374151;
			}
		}

		/* Dark mode code blocks */
		:global(.ProseMirror pre) {
			background-color: #1f2937;
			border-color: #374151;
			color: #f9fafb;
		}

		/* Dark theme syntax highlighting colors */
		:global(.ProseMirror .hljs-comment),
		:global(.ProseMirror .hljs-quote) {
			color: #9ca3af;
		}

		:global(.ProseMirror .hljs-variable),
		:global(.ProseMirror .hljs-template-variable),
		:global(.ProseMirror .hljs-attribute),
		:global(.ProseMirror .hljs-tag),
		:global(.ProseMirror .hljs-name),
		:global(.ProseMirror .hljs-regexp),
		:global(.ProseMirror .hljs-link),
		:global(.ProseMirror .hljs-name),
		:global(.ProseMirror .hljs-selector-id),
		:global(.ProseMirror .hljs-selector-class) {
			color: #f87171;
		}

		:global(.ProseMirror .hljs-number),
		:global(.ProseMirror .hljs-meta),
		:global(.ProseMirror .hljs-built_in),
		:global(.ProseMirror .hljs-builtin-name),
		:global(.ProseMirror .hljs-literal),
		:global(.ProseMirror .hljs-type),
		:global(.ProseMirror .hljs-params) {
			color: #fb923c;
		}

		:global(.ProseMirror .hljs-string),
		:global(.ProseMirror .hljs-symbol),
		:global(.ProseMirror .hljs-bullet) {
			color: #86efac;
		}

		:global(.ProseMirror .hljs-title),
		:global(.ProseMirror .hljs-section) {
			color: #fde047;
		}

		:global(.ProseMirror .hljs-keyword),
		:global(.ProseMirror .hljs-selector-tag) {
			color: #93c5fd;
		}
		:global(.ProseMirror .callout) {
			background-color: #1f2937;
			color: #f9fafb;
		}

		:global(.ProseMirror .callout-header) {
			color: #f9fafb;
		}

		:global(.ProseMirror .callout-label) {
			color: #f9fafb;
		}

		:global(.ProseMirror .callout-content) {
			color: #f9fafb;
		}

		/* Dark mode callout backgrounds */
		:global(.ProseMirror .callout[data-callout='note']) {
			background-color: #0c4a6e;
		}

		:global(.ProseMirror .callout[data-callout='info']) {
			background-color: #1e3a8a;
		}

		:global(.ProseMirror .callout[data-callout='tip']) {
			background-color: #1e3a8a;
		}

		:global(.ProseMirror .callout[data-callout='important']) {
			background-color: #581c87;
		}

		:global(.ProseMirror .callout[data-callout='success']) {
			background-color: #14532d;
		}

		:global(.ProseMirror .callout[data-callout='question']) {
			background-color: #1e3a8a;
		}

		:global(.ProseMirror .callout[data-callout='warning']) {
			background-color: #78350f;
		}

		:global(.ProseMirror .callout[data-callout='caution']) {
			background-color: #7f1d1d;
		}

		:global(.ProseMirror .callout[data-callout='failure']) {
			background-color: #7f1d1d;
		}

		:global(.ProseMirror .callout[data-callout='danger']) {
			background-color: #7f1d1d;
		}

		:global(.ProseMirror .callout[data-callout='bug']) {
			background-color: #7f1d1d;
		}

		:global(.ProseMirror .callout[data-callout='example']) {
			background-color: #14532d;
		}

		:global(.ProseMirror .callout[data-callout='todo']) {
			background-color: #1e3a8a;
		}
	}



	/* Code */
	:global(.ProseMirror code) {
		background-color: #f3f4f6;
		padding: 0.125rem 0.375rem;
		border-radius: 0.375rem;
		font-family: 'JetBrains Mono', 'Fira Code', 'IBM Plex Mono', monospace;
		font-size: 0.875rem;
		color: #dc2626;
	}

	/* Code blocks with syntax highlighting */
	:global(.ProseMirror pre) {
		background-color: #f5f5f5;
		border: none;
		color: #1e293b;
		padding: 1.25rem;
		border-radius: 0.5rem;
		overflow-x: auto;
		margin: 1.5rem 0;
		font-family: 'JetBrains Mono', 'Fira Code', 'IBM Plex Mono', monospace;
		font-size: 0.875rem;
		line-height: 1.6;
		position: relative;
	}

	:global(.ProseMirror pre code) {
		background-color: transparent;
		padding: 0;
		color: inherit;
		font-size: inherit;
	}

	/* Light theme syntax highlighting colors */
	:global(.ProseMirror .hljs-comment),
	:global(.ProseMirror .hljs-quote) {
		color: #64748b;
	}

	:global(.ProseMirror .hljs-variable),
	:global(.ProseMirror .hljs-template-variable),
	:global(.ProseMirror .hljs-attribute),
	:global(.ProseMirror .hljs-tag),
	:global(.ProseMirror .hljs-name),
	:global(.ProseMirror .hljs-regexp),
	:global(.ProseMirror .hljs-link),
	:global(.ProseMirror .hljs-name),
	:global(.ProseMirror .hljs-selector-id),
	:global(.ProseMirror .hljs-selector-class) {
		color: #dc2626;
	}

	:global(.ProseMirror .hljs-number),
	:global(.ProseMirror .hljs-meta),
	:global(.ProseMirror .hljs-built_in),
	:global(.ProseMirror .hljs-builtin-name),
	:global(.ProseMirror .hljs-literal),
	:global(.ProseMirror .hljs-type),
	:global(.ProseMirror .hljs-params) {
		color: #ea580c;
	}

	:global(.ProseMirror .hljs-string),
	:global(.ProseMirror .hljs-symbol),
	:global(.ProseMirror .hljs-bullet) {
		color: #16a34a;
	}

	:global(.ProseMirror .hljs-title),
	:global(.ProseMirror .hljs-section) {
		color: #ca8a04;
	}

	:global(.ProseMirror .hljs-keyword),
	:global(.ProseMirror .hljs-selector-tag) {
		color: #2563eb;
	}

	:global(.ProseMirror .hljs-emphasis) {
		font-style: italic;
	}

	:global(.ProseMirror .hljs-strong) {
		font-weight: 700;
	}

	/* Images */
	:global(.ProseMirror img) {
		max-width: 100%;
		height: auto;
		border-radius: 0.75rem;
		margin: 1.5rem 0;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
	}

	/* Links */
	:global(.ProseMirror a) {
		color: #2563eb;
		text-decoration: underline;
		text-decoration-thickness: 1px;
		text-underline-offset: 2px;
		transition: color 0.15s ease-in-out;
	}

	:global(.ProseMirror a:hover) {
		color: #1d4ed8;
	}

	/* Horizontal rules */
	:global(.ProseMirror hr) {
		border: none;
		border-top: 2px solid #e5e7eb;
		margin: 2.5rem 0;
	}

	/* Highlight */
	:global(.ProseMirror mark) {
		background-color: #fef3c7;
		padding: 0.125rem 0.25rem;
		border-radius: 0.25rem;
		color: #92400e;
	}

	/* Tables */
	:global(.ProseMirror table) {
		border-collapse: separate;
		border-spacing: 0;
		width: 100%;
		margin: 1.5rem 0;
		border-radius: 0.5rem;
		overflow: hidden;
		box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
		border: 1px solid #e5e7eb;
	}

	:global(.ProseMirror table td),
	:global(.ProseMirror table th) {
		border: none;
		border-bottom: 1px solid #e5e7eb;
		border-right: 1px solid #e5e7eb;
		box-sizing: border-box;
		min-width: 1em;
		padding: 0.75rem 1rem;
		position: relative;
		vertical-align: top;
		line-height: 1.5;
	}

	:global(.ProseMirror table th) {
		background-color: #f9fafb;
		font-weight: 600;
		text-align: left;
		color: #374151;
		font-size: 0.875rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		border-bottom: 2px solid #d1d5db;
	}

	:global(.ProseMirror table th:last-child) {
		border-right: none;
	}

	:global(.ProseMirror table td) {
		background-color: #ffffff;
		color: #374151;
		font-size: 0.875rem;
	}

	:global(.ProseMirror table tr:last-child td) {
		border-bottom: none;
	}

	:global(.ProseMirror table tr:hover td) {
		background-color: #f9fafb;
		transition: background-color 0.15s ease-in-out;
	}

	/* Table selection styles */
	:global(.ProseMirror table .selectedCell:after) {
		background: rgba(200, 200, 255, 0.4);
		content: "";
		left: 0;
		right: 0;
		top: 0;
		bottom: 0;
		pointer-events: none;
		position: absolute;
		z-index: 2;
	}

	:global(.ProseMirror table .column-resize-handle) {
		background-color: #3b82f6;
		bottom: -2px;
		position: absolute;
		right: -2px;
		pointer-events: none;
		top: 0;
		width: 4px;
	}

	:global(.ProseMirror table p) {
		margin: 0;
	}

	/* Placeholder */
	:global(.ProseMirror .is-editor-empty:first-child::before) {
		color: #9ca3af;
		content: attr(data-placeholder);
		float: left;
		height: 0;
		pointer-events: none;
		font-style: italic;
	}

	/* Mathematics decorations */
	:global(.Tiptap-mathematics-editor) {
		background-color: #f3f4f6;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		padding: 0.25rem 0.5rem;
		font-family: 'Courier New', monospace;
		font-size: 0.875rem;
		color: #374151;
		margin: 0 0.125rem;
	}

	:global(.Tiptap-mathematics-render) {
		display: inline-block;
		margin: 0 0.125rem;
		vertical-align: middle;
	}


</style>

 