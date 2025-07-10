import { Node, Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
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
					console.log('🔍 BlockEquation: parseHTML - raw content from element:', JSON.stringify(content));
					// Don't do any processing here - return the content as-is
					return content;
				},
				renderHTML: attributes => {
					console.log('🔍 BlockEquation: renderHTML in addAttributes - content:', JSON.stringify(attributes.content));
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
			},
		];
	},

	renderHTML({ HTMLAttributes }) {
		console.log('🔍 BlockEquation: renderHTML called with HTMLAttributes:', HTMLAttributes);
		
		// Try to get content from different possible attribute names
		let content = HTMLAttributes.content || HTMLAttributes['data-content'] || '';
		console.log('🔍 BlockEquation: Content from attributes:', content);
		
		// Clean up the content - remove quotes but preserve LaTeX line breaks
		if (typeof content === 'string') {
			// Remove outer quotes if present (handle both single and double quotes)
			content = content.replace(/^["']|["']$/g, '');
			
			// IMPORTANT: Don't unescape backslashes here as it breaks LaTeX line breaks
			// LaTeX uses \\ for line breaks, so we need to preserve them
			
			// Remove any remaining quotes that might be inside the content
			content = content.replace(/^["']|["']$/g, '');
		}
		
		console.log('🔍 BlockEquation: Final content to render:', JSON.stringify(content));
		
		let renderedContent = '';
		
		try {
			// For block equations, we need to pass the content WITHOUT the $$ delimiters
			// KaTeX's displayMode: true handles the block display automatically
			let latexContent = content.replace(/^\$\$|\$\$$/g, '').trim();
			
			// Final cleanup - remove any remaining quotes from the LaTeX content
			latexContent = latexContent.replace(/^["']|["']$/g, '');
			
			console.log('🔍 BlockEquation: LaTeX content for KaTeX:', JSON.stringify(latexContent));
			console.log('🔍 BlockEquation: KaTeX input (raw):', latexContent);
			
			renderedContent = katex.renderToString(latexContent, {
				displayMode: true,
				throwOnError: false,
			});
			console.log('🔍 BlockEquation: KaTeX output:', renderedContent);
			console.log('🔍 BlockEquation: KaTeX rendered successfully');
			console.log('🔍 BlockEquation: Final HTML structure being returned');
		} catch (error) {
			console.error('KaTeX rendering error:', error);
			renderedContent = `<span class="katex-error">${content}</span>`;
		}

		// Create a DOM element to render the KaTeX content
		const container = document.createElement('div');
		container.className = 'block-equation';
		container.setAttribute('data-block-equation', 'true');
		container.style.margin = '1em 0';
		container.style.textAlign = 'center';
		container.innerHTML = renderedContent;

		return container;
	},
});

export const BlockEquation = Extension.create({
	name: 'blockEquationExtension',

	addProseMirrorPlugins() {
		console.log('🔍 BlockEquation: Extension loaded and ProseMirror plugins added');
		
		return [
			new Plugin({
				key: new PluginKey('blockEquation'),
				props: {
					handleKeyDown: (view, event) => {
						console.log('🔍 BlockEquation: handleKeyDown called with key:', event.key);
						
						// Check for Enter key to complete block equations
						if (event.key === 'Enter') {
							const { state } = view;
							const { selection } = state;
							const { $from } = selection;
							
							console.log('🔍 BlockEquation: Enter key pressed, checking for block equation');
							console.log('🔍 BlockEquation: Current node type:', $from.parent.type.name);
							
							// Check if we're in a paragraph that might be part of a block equation
							if ($from.parent.type.name === 'paragraph') {
								const paragraphText = $from.parent.textContent || '';
								console.log('🔍 BlockEquation: Paragraph text:', JSON.stringify(paragraphText));
								
								// Check if this paragraph contains a closing $$
								if (paragraphText.trim() === '$$') {
									console.log('🔍 BlockEquation: Found closing $$ in current paragraph');
									
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
											console.log('🔍 BlockEquation: Checking previous paragraph with text:', JSON.stringify(nodeText));
											
											if (nodeText.trim() === '$$') {
												// Found opening $$
												startParagraphPos = $pos.start();
												foundOpening = true;
												console.log('🔍 BlockEquation: Found opening $$ at position:', startParagraphPos);
												break;
											} else if (nodeText.trim()) {
												// This is part of the equation content
												// For multi-line equations, we want to preserve the line breaks
												if (equationContent) {
													equationContent = nodeText.trim() + '\n' + equationContent;
												} else {
													equationContent = nodeText.trim();
												}
												console.log('🔍 BlockEquation: Added to equation content:', JSON.stringify(nodeText.trim()));
												console.log('🔍 BlockEquation: Current equation content:', JSON.stringify(equationContent));
											}
										}
										
										currentPos = $pos.start();
									}
									
									if (foundOpening && equationContent.trim()) {
										console.log('🔍 BlockEquation: Found complete block equation with content:', JSON.stringify(equationContent));
										
										// We have a complete block equation
										event.preventDefault();
										
										// Create the block equation node with the full equation including $$ delimiters
										// Store the raw LaTeX content without any escaping
										const fullEquation = `$$${equationContent.trim()}$$`;
										console.log('🔍 BlockEquation: Creating block equation with content:', fullEquation);
										console.log('🔍 BlockEquation: Raw equation content before storage:', equationContent.trim());
										console.log('🔍 BlockEquation: Content being stored in node:', JSON.stringify(fullEquation));
										const blockEquationNode = state.schema.nodes.blockEquationNode.create(
											{ content: fullEquation }
										);
										
										// Calculate the position to replace (from start of opening paragraph to end of current paragraph)
										const endPos = $from.start() + $from.parent.nodeSize;
										
										console.log('🔍 BlockEquation: Replacing from', startParagraphPos, 'to', endPos);
										
										// Replace the block equation syntax with the node
										const tr = state.tr.replaceWith(
											startParagraphPos, 
											endPos, 
											blockEquationNode
										);
										
										view.dispatch(tr);
										console.log('🔍 BlockEquation: Block equation created successfully!');
										return true;
									} else {
										console.log('🔍 BlockEquation: No opening $$ found or empty equation content');
									}
								} else {
									console.log('🔍 BlockEquation: Current paragraph is not a closing $$');
								}
							} else {
								console.log('🔍 BlockEquation: Not in a paragraph node');
							}
						}
						return false;
					}
				},
				appendTransaction: (transactions, oldState, newState) => {
					console.log('🔍 BlockEquation: appendTransaction called');
					
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
					
					console.log('🔍 BlockEquation: Found', paragraphs.length, 'paragraphs');
					
					// Look for block equation patterns across consecutive paragraphs
					for (let i = 0; i < paragraphs.length; i++) {
						const currentParagraph = paragraphs[i];
						const currentText = currentParagraph.text.trim();
						
						console.log('🔍 BlockEquation: Checking paragraph', i, 'with text:', JSON.stringify(currentText));
						
						// Check if this paragraph starts with $$
						if (currentText === '$$') {
							console.log('🔍 BlockEquation: Found opening $$ at paragraph', i);
							
							// Look for the closing $$ in subsequent paragraphs
							let equationContent = '';
							let endParagraphIndex = -1;
							
							for (let j = i + 1; j < paragraphs.length; j++) {
								const nextParagraph = paragraphs[j];
								const nextText = nextParagraph.text.trim();
								
								console.log('🔍 BlockEquation: Checking next paragraph', j, 'with text:', JSON.stringify(nextText));
								
								if (nextText === '$$') {
									// Found closing $$
									endParagraphIndex = j;
									console.log('🔍 BlockEquation: Found closing $$ at paragraph', j);
									break;
								} else {
									// This is part of the equation content
									// For multi-line equations, we want to preserve the line breaks
									if (equationContent) {
										equationContent += '\n';
									}
									equationContent += nextText;
									console.log('🔍 BlockEquation: Added to equation content (appendTransaction):', JSON.stringify(nextText));
									console.log('🔍 BlockEquation: Current equation content (appendTransaction):', JSON.stringify(equationContent));
								}
							}
							
							if (endParagraphIndex !== -1 && equationContent.trim()) {
								console.log('🔍 BlockEquation: Found complete block equation with content:', JSON.stringify(equationContent));
								
								// Create the block equation node with the full equation including $$ delimiters
								// Store the raw LaTeX content without any escaping
								const fullEquation = `$$${equationContent.trim()}$$`;
								console.log('🔍 BlockEquation: Creating block equation with content:', fullEquation);
								console.log('🔍 BlockEquation: Raw equation content before storage:', equationContent.trim());
								console.log('🔍 BlockEquation: Content being stored in node (appendTransaction):', JSON.stringify(fullEquation));
								const blockEquationNode = newState.schema.nodes.blockEquationNode.create(
									{ content: fullEquation }
								);
								
								// Calculate the positions to replace (from start of opening paragraph to end of closing paragraph)
								const startPos = currentParagraph.pos;
								const endPos = paragraphs[endParagraphIndex].pos + paragraphs[endParagraphIndex].node.nodeSize;
								
								console.log('🔍 BlockEquation: Replacing from', startPos, 'to', endPos);
								
								// Replace the block equation syntax with the node
								tr.replaceWith(startPos, endPos, blockEquationNode);
								modified = true;
								console.log('🔍 BlockEquation: Block equation created in appendTransaction');
								
								// Skip the paragraphs we just processed
								i = endParagraphIndex;
							} else {
								console.log('🔍 BlockEquation: No closing $$ found or empty equation content');
							}
						}
					}
					
					if (modified) {
						console.log('🔍 BlockEquation: Returning modified transaction');
					} else {
						console.log('🔍 BlockEquation: No modifications made');
					}
					
					return modified ? tr : null;
				}
			}),
		];
	}
}); 