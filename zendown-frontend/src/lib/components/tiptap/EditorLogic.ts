import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Color from '@tiptap/extension-color';
import TextStyle from '@tiptap/extension-text-style';
import ListItem from '@tiptap/extension-list-item';
import Strike from '@tiptap/extension-strike';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { createLowlight, all } from 'lowlight';
import Blockquote from '@tiptap/extension-blockquote';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import HardBreak from '@tiptap/extension-hard-break';
import Highlight from '@tiptap/extension-highlight';
import Typography from '@tiptap/extension-typography';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Mathematics from '@tiptap/extension-mathematics';
import { MarkdownLink } from '../../extensions/markdown-link';
import { Callout, CalloutNode } from '../../extensions/callout';
import { BlockEquation, BlockEquationNode } from '../../extensions/block-equation';
import { api } from '../../api';
import TableOfContents from '@tiptap/extension-table-of-contents';
import { getHierarchicalIndexes } from '@tiptap/extension-table-of-contents';

// Import KaTeX CSS for mathematics rendering
import 'katex/dist/katex.min.css';

export interface EditorState {
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
}

export function createEditor(element: HTMLElement, options: {
	content?: string;
	placeholder?: string;
	readonly?: boolean;
	onUpdate?: (content: string) => void;
	onTransaction?: () => void;
	onTableOfContentsUpdate?: (items: any[]) => void;
}) {
	const { content = '', placeholder = 'Start writing your thoughts...', readonly = false, onUpdate, onTransaction, onTableOfContentsUpdate } = options;

	// Create lowlight instance
	const lowlight = createLowlight(all);

			return new Editor({
		element: element,
		extensions: [
			StarterKit.configure({
				codeBlock: false,
				blockquote: false,
				horizontalRule: false,
				hardBreak: false,
			}),
			Image.configure({
				HTMLAttributes: {
					class: 'max-w-full h-auto rounded-lg',
				},
			}),
			Link.configure({
				openOnClick: false,
				HTMLAttributes: {
					class: 'text-blue-600 hover:text-blue-800 underline',
				},
				protocols: ['http', 'https', 'mailto', 'tel'],
				autolink: true,
			}),
			MarkdownLink.configure({
				HTMLAttributes: {
					class: 'text-blue-600 hover:text-blue-800 underline',
				},
			}),
			Placeholder.configure({
				placeholder,
			}),
			Color.configure({ types: [TextStyle.name, ListItem.name] }),
			TextStyle,
			Underline,
			TextAlign.configure({
				types: ['heading', 'paragraph'],
			}),
			CodeBlockLowlight.configure({
				lowlight,
				HTMLAttributes: {
					class: 'code-block',
				},
			}),
			Blockquote.configure({
				HTMLAttributes: {
					class: 'border-l-4 border-gray-300 pl-4 italic text-gray-600',
				},
			}),
			CalloutNode,
			Callout,
			BlockEquationNode,
			BlockEquation,
			HorizontalRule.configure({
				HTMLAttributes: {
					class: 'border-t border-gray-300 my-4',
				},
			}),
			HardBreak,
			Highlight.configure({
				HTMLAttributes: {
					class: 'bg-yellow-200 px-1 rounded',
				},
			}),
			Typography,
			Mathematics.configure({
				katexOptions: {
					maxSize: 300,
				},
				shouldRender: (state, pos, node) => {
					const $pos = state.doc.resolve(pos);
					return node.type.name === 'text' && $pos.parent.type.name !== 'codeBlock';
				},
			}),
			Table.configure({
				resizable: true,
				HTMLAttributes: {
					class: 'border-collapse table-auto w-full',
				},
			}),
			TableRow.configure({
				HTMLAttributes: {
					class: 'border-b border-gray-300',
				},
			}),
			TableHeader.configure({
				HTMLAttributes: {
					class: 'border border-gray-300 bg-gray-100 px-4 py-2 font-semibold text-left',
				},
			}),
			TableCell.configure({
				HTMLAttributes: {
					class: 'border border-gray-300 px-4 py-2',
				},
			}),
			TableOfContents.configure({
				getIndex: getHierarchicalIndexes,
				onUpdate(content) {
					if (onTableOfContentsUpdate) {
						onTableOfContentsUpdate(content);
					}
				},
			}),
		],
		content: content || '',
		editable: !readonly,
		onUpdate: ({ editor }) => {
			if (onUpdate) {
				onUpdate(editor.getHTML());
			}
		},
		onTransaction: () => {
			if (onTransaction) {
				onTransaction();
			}
		},
	});
}

export function updateEditorState(editor: Editor | null): EditorState {
	if (!editor) {
		return {
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
		};
	}

	return {
		isBold: editor.isActive('bold'),
		isItalic: editor.isActive('italic'),
		isUnderline: editor.isActive('underline'),
		isStrike: editor.isActive('strike'),
		isCode: editor.isActive('code'),
		isHeading1: editor.isActive('heading', { level: 1 }),
		isHeading2: editor.isActive('heading', { level: 2 }),
		isHeading3: editor.isActive('heading', { level: 3 }),
		isBulletList: editor.isActive('bulletList'),
		isOrderedList: editor.isActive('orderedList'),
		isCodeBlock: editor.isActive('codeBlock'),
		isBlockquote: editor.isActive('blockquote'),
		isLink: editor.isActive('link'),
		isTable: editor.isActive('table'),
	};
}

export async function handleImageUpload(file: File): Promise<string | null> {
	try {
		const attachment = await api.uploadAttachment(file);
		return attachment.url;
	} catch (error) {
		console.error('Failed to upload image:', error);
		return null;
	}
}

export function handlePaste(event: ClipboardEvent, editor: Editor | null) {
	const items = event.clipboardData?.items;
	if (!items || !editor) return;

	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		if (item.type.indexOf('image') !== -1) {
			const file = item.getAsFile();
			if (file) {
				event.preventDefault();
				handleImageUpload(file).then(url => {
					if (url && editor) {
						editor.chain().focus().setImage({ src: url }).run();
					}
				});
			}
		}
	}
}

export function handleDrop(event: DragEvent, editor: Editor | null) {
	event.preventDefault();
	const files = event.dataTransfer?.files;
	if (!files || !editor) return;

	for (let i = 0; i < files.length; i++) {
		const file = files[i];
		if (file.type.startsWith('image/')) {
			handleImageUpload(file).then(url => {
				if (url && editor) {
					editor.chain().focus().setImage({ src: url }).run();
				}
			});
		}
	}
}

export function addTableRow(editor: Editor | null) {
	if (editor) {
		editor.chain().focus().addRowAfter().run();
	}
}

export function addTableColumn(editor: Editor | null) {
	if (editor) {
		editor.chain().focus().addColumnAfter().run();
	}
}

export function deleteTableRow(editor: Editor | null) {
	if (editor) {
		editor.chain().focus().deleteRow().run();
	}
}

export function deleteTableColumn(editor: Editor | null) {
	if (editor) {
		editor.chain().focus().deleteColumn().run();
	}
} 