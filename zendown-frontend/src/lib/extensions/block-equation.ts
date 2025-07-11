import { Node, Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import katex from 'katex';

// Custom Block Equation Node
export const BlockEquationNode = Node.create({
	name: 'blockEquationNode',
	
	group: 'block',
	
	content: '',
	
	addAttributes() {
		return {
			content: {
				default: '',
				parseHTML: element => {
					const content = element.getAttribute('data-content') || '';
					// Don't do any processing here - return the content as-is
					return content;
				},
				renderHTML: attributes => {
					return {
						'data-content': attributes.content,
					};
				},
			},
		};
	},

	parseHTML() {
		return [
			{
				tag: 'div[data-block-equation]',
				getAttrs: (element) => {
					// Extract the content from the data-content attribute
					const content = element.getAttribute('data-content');
					return { content };
				},
			},
		];
	},

	renderHTML({ HTMLAttributes }) {
		// Try to get content from different possible attribute names
		let content = HTMLAttributes.content || HTMLAttributes['data-content'] || '';
		
		// Clean up the content - remove quotes but preserve LaTeX line breaks
		if (typeof content === 'string') {
			// Remove outer quotes if present (handle both single and double quotes)
			content = content.replace(/^["']|["']$/g, '');
			
			// IMPORTANT: Don't unescape backslashes here as it breaks LaTeX line breaks
			// LaTeX uses \\ for line breaks, so we need to preserve them
			
			// Remove any remaining quotes that might be inside the content
			content = content.replace(/^["']|["']$/g, '');
		}
		
		let renderedContent = '';
		
		try {
			// For block equations, we need to pass the content WITHOUT the $$ delimiters
			// KaTeX's displayMode: true handles the block display automatically
			let latexContent = content.replace(/^\$\$|\$\$$/g, '').trim();
			
			// Final cleanup - remove any remaining quotes from the LaTeX content
			latexContent = latexContent.replace(/^["']|["']$/g, '');
			
			renderedContent = katex.renderToString(latexContent, {
				displayMode: true,
				throwOnError: false,
				strict: false,
			});
		} catch (error) {
			console.error('KaTeX rendering error:', error);
			renderedContent = `<span class="katex-error">${content}</span>`;
		}

		return [
			'div',
			{
				class: 'block-equation',
				'data-block-equation': 'true',
				style: 'margin: 1em 0; text-align: center;',
				...HTMLAttributes,
			}
		];
	},
});

export const BlockEquation = Extension.create({
	name: 'blockEquationExtension',

	addProseMirrorPlugins() {
		
		return [
			// Decoration plugin to render KaTeX content
			new Plugin({
				key: new PluginKey('blockEquationDecoration'),
				props: {
					decorations: (state) => {
						const { doc } = state;
						const decorations: Decoration[] = [];
						
						doc.descendants((node, pos) => {
							if (node.type.name === 'blockEquationNode') {
								const content = node.attrs.content || '';
								if (content) {
									try {
										// Clean up the content
										let latexContent = content.replace(/^\$\$|\$\$$/g, '').trim();
										latexContent = latexContent.replace(/^["']|["']$/g, '');
										
										// Render with KaTeX
										const renderedContent = katex.renderToString(latexContent, {
											displayMode: true,
											throwOnError: false,
											strict: false,
										});
										
										// Create decoration
										const decoration = Decoration.widget(pos, () => {
											const div = document.createElement('div');
											div.innerHTML = renderedContent;
											return div;
										});
										
										decorations.push(decoration);
									} catch (error) {
										console.error('KaTeX rendering error in decoration:', error);
									}
								}
							}
						});
						
						return DecorationSet.create(doc, decorations);
					},
				},
			}),
			new Plugin({
				key: new PluginKey('blockEquation'),
				props: {
					handleKeyDown: (view, event) => {
						// Check for Enter key to complete block equations
						if (event.key === 'Enter') {
							const { state } = view;
							const { selection } = state;
							const { $from } = selection;
							
							// Check if we're in a paragraph that might be part of a block equation
							if ($from.parent.type.name === 'paragraph') {
								const paragraphText = $from.parent.textContent || '';
								
								// Check if this paragraph contains a closing $$
								if (paragraphText.trim() === '$$') {
									// Look for the opening $$ in previous paragraphs
									let equationContent = '';
									let startParagraphPos = -1;
									
									// Walk backwards through the document to find the opening $$
									let currentPos = $from.start();
									let foundOpening = false;
									
									while (currentPos > 0) {
										const $pos = state.doc.resolve(currentPos - 1);
										const node = $pos.parent;
										
										if (node.type.name === 'paragraph') {
											const nodeText = node.textContent || '';
											
											if (nodeText.trim() === '$$') {
												// Found opening $$
												startParagraphPos = $pos.start();
												foundOpening = true;
												break;
											} else if (nodeText.trim()) {
												// This is part of the equation content
												// For multi-line equations, we want to preserve the line breaks
												if (equationContent) {
													equationContent = nodeText.trim() + '\n' + equationContent;
												} else {
													equationContent = nodeText.trim();
												}
											}
										}
										
										currentPos = $pos.start();
									}
									
									if (foundOpening && equationContent.trim()) {
										// We have a complete block equation
										event.preventDefault();
										
										// Create the block equation node with the full equation including $$ delimiters
										// Store the raw LaTeX content without any escaping
										const fullEquation = `$$${equationContent.trim()}$$`;
										const blockEquationNode = state.schema.nodes.blockEquationNode.create(
											{ content: fullEquation }
										);
										
										// Calculate the position to replace (from start of opening paragraph to end of current paragraph)
										const endPos = $from.start() + $from.parent.nodeSize;
										
										// Replace the block equation syntax with the node
										const tr = state.tr.replaceWith(
											startParagraphPos, 
											endPos, 
											blockEquationNode
										);
										
										view.dispatch(tr);
										return true;
									}
								}
							}
						}
						return false;
					}
				},
				appendTransaction: (transactions, oldState, newState) => {
					const tr = newState.tr;
					let modified = false;
					
					// Check for complete block equation patterns in the document
					const { doc } = newState;
					
					// Collect all paragraph nodes and their positions
					const paragraphs: Array<{ node: any; pos: number; text: string }> = [];
					doc.descendants((node, pos) => {
						if (node.type.name === 'paragraph') {
							paragraphs.push({
								node,
								pos,
								text: node.textContent || ''
							});
						}
					});
					
					// Look for block equation patterns across consecutive paragraphs
					for (let i = 0; i < paragraphs.length; i++) {
						const currentParagraph = paragraphs[i];
						const currentText = currentParagraph.text.trim();
						
						// Check if this paragraph starts with $$
						if (currentText === '$$') {
							// Look for the closing $$ in subsequent paragraphs
							let equationContent = '';
							let endParagraphIndex = -1;
							
							for (let j = i + 1; j < paragraphs.length; j++) {
								const nextParagraph = paragraphs[j];
								const nextText = nextParagraph.text.trim();
								
								if (nextText === '$$') {
									// Found closing $$
									endParagraphIndex = j;
									break;
								} else {
									// This is part of the equation content
									// For multi-line equations, we want to preserve the line breaks
									if (equationContent) {
										equationContent += '\n';
									}
									equationContent += nextText;
								}
							}
							
							if (endParagraphIndex !== -1 && equationContent.trim()) {
								// Create the block equation node with the full equation including $$ delimiters
								// Store the raw LaTeX content without any escaping
								const fullEquation = `$$${equationContent.trim()}$$`;
								const blockEquationNode = newState.schema.nodes.blockEquationNode.create(
									{ content: fullEquation }
								);
								
								// Calculate the positions to replace (from start of opening paragraph to end of closing paragraph)
								const startPos = currentParagraph.pos;
								const endPos = paragraphs[endParagraphIndex].pos + paragraphs[endParagraphIndex].node.nodeSize;
								
								// Replace the block equation syntax with the node
								tr.replaceWith(startPos, endPos, blockEquationNode);
								modified = true;
								
								// Skip the paragraphs we just processed
								i = endParagraphIndex;
							}
						}
					}
					
					return modified ? tr : null;
				}
			}),
		];
	}
}); 