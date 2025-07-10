import { Extension, Node } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { 
	StickyNote, 
	Info, 
	Lightbulb, 
	AlertTriangle, 
	CheckCircle, 
	HelpCircle, 
	AlertCircle, 
	Zap, 
	XCircle, 
	Skull, 
	Bug, 
	BookOpen, 
	Square 
} from '@lucide/svelte';

// Custom Callout Node
export const CalloutNode = Node.create({
	name: 'calloutNode',
	
	group: 'block',
	
	content: 'block+',
	
	addAttributes() {
		return {
			type: {
				default: 'note',
				parseHTML: element => element.getAttribute('data-callout'),
				renderHTML: attributes => {
					return {
						'data-callout': attributes.type,
					};
				},
			},
		};
	},

	parseHTML() {
		return [
			{
				tag: 'div[data-callout]',
			},
		];
	},

	renderHTML({ HTMLAttributes }) {
		return ['div', { class: 'callout', ...HTMLAttributes }, 0];
	},
});

export const Callout = Extension.create({
	name: 'callout',

			addProseMirrorPlugins() {
			return [
				new Plugin({
					key: new PluginKey('callout'),
					props: {
						handleKeyDown: (view, event) => {
							// Check for Enter key after typing a callout pattern
							if (event.key === 'Enter') {
								const { state } = view;
								const { selection } = state;
								const { $from } = selection;
								
								// Check if we're in a blockquote
								let inBlockquote = false;
								let blockquotePos = 0;
								for (let depth = $from.depth; depth > 0; depth--) {
									const node = $from.node(depth);
									if (node.type.name === 'blockquote') {
										inBlockquote = true;
										blockquotePos = $from.before(depth);
										break;
									}
								}
								
								if (inBlockquote) {
									const currentParagraph = $from.parent;
									if (currentParagraph.type.name === 'paragraph') {
										const paragraphText = currentParagraph.textContent || '';
										console.log('Checking for callout pattern on Enter:', paragraphText);
										
										// Check for callout patterns
										const calloutMatch = paragraphText.match(/^\[!([a-zA-Z]+)\]/);
										if (calloutMatch) {
											const calloutType = calloutMatch[1].toLowerCase();
											console.log('Found callout pattern on Enter:', calloutType);
											
											// Remove the callout specifier from the paragraph
											const calloutContent = paragraphText.replace(calloutMatch[0], '').trim();
											console.log('Callout content after removal:', calloutContent);
											
											// Create callout content
											const contentNodes = calloutContent ? [
												state.schema.nodes.paragraph.create(null, [
													state.schema.text(calloutContent)
												])
											] : [
												state.schema.nodes.paragraph.create(null, [])
											];
											
											// Create the callout node
											const calloutNode = state.schema.nodes.calloutNode.create(
												{ type: calloutType },
												contentNodes
											);
											
											// Replace the blockquote with callout
											const tr = state.tr.replaceWith(blockquotePos, blockquotePos + $from.node(-1).nodeSize, calloutNode);
											
											// Set cursor to the end of the callout content
											const calloutEnd = blockquotePos + calloutNode.nodeSize;
											tr.setSelection(TextSelection.create(tr.doc, calloutEnd - 1));
											
											view.dispatch(tr);
											return true; // Prevent default Enter behavior
										}
									}
								}
							}
							return false;
						}
					},
			}),
		];
	},
}); 