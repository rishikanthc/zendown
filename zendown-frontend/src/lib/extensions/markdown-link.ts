import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export interface MarkdownLinkOptions {
	HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
	interface Commands<ReturnType> {
		markdownLink: {
			/**
			 * Set a markdown link
			 */
			setMarkdownLink: (attributes: { href: string; text?: string }) => ReturnType;
			/**
			 * Unset a markdown link
			 */
			unsetMarkdownLink: () => ReturnType;
		};
	}
}

export const MarkdownLink = Extension.create<MarkdownLinkOptions>({
	name: 'markdownLink',

	addOptions() {
		return {
			HTMLAttributes: {},
		};
	},

	addCommands() {
		return {
			setMarkdownLink:
				(attributes) =>
				({ commands }) => {
					return commands.setLink(attributes);
				},
			unsetMarkdownLink:
				() =>
				({ commands }) => {
					return commands.unsetLink();
				},
		};
	},

	addProseMirrorPlugins() {
		return [
			new Plugin({
				key: new PluginKey('markdownLink'),
				props: {
					handlePaste: (view, event, slice) => {
						const text = event.clipboardData?.getData('text/plain');
						if (!text) return false;

						// Check if pasted text contains markdown link or image syntax
						const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
						const markdownImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
						
						const hasLinks = markdownLinkRegex.test(text);
						const hasImages = markdownImageRegex.test(text);
						
						if (!hasLinks && !hasImages) return false;

						// Prevent default paste behavior
						event.preventDefault();

						const { tr } = view.state;
						const { from, to } = view.state.selection;
						
						// Remove selected text if any
						if (from !== to) {
							tr.delete(from, to);
						}
						
						// Insert the text first
						tr.insertText(text, from);
						
						// Now process the inserted text for markdown patterns
						const newFrom = from;
						const newTo = from + text.length;
						
						// Get the text content in the inserted range
						const insertedText = tr.doc.textBetween(newFrom, newTo);
						
						// Process markdown images first (to avoid conflicts with link processing)
						const imageMatches = [...insertedText.matchAll(markdownImageRegex)];
						
						let offset = 0;
						
						for (let i = imageMatches.length - 1; i >= 0; i--) {
							const match = imageMatches[i];
							const [fullMatch, alt, url] = match;
							const matchIndex = match.index!;
							
							// Create image node
							const imageNode = view.state.schema.nodes.image.create({
								src: url,
								alt: alt || ''
							});
							
							// Replace the markdown syntax with the image node
							const startPos = newFrom + matchIndex + offset;
							const endPos = startPos + fullMatch.length;
							
							tr.replaceWith(startPos, endPos, imageNode);
							offset += 1 - fullMatch.length; // Image node takes 1 position
						}
						
						// Process markdown links
						const linkMatches = [...insertedText.matchAll(markdownLinkRegex)];
						
						for (let i = linkMatches.length - 1; i >= 0; i--) {
							const match = linkMatches[i];
							const [fullMatch, alias, url] = match;
							const matchIndex = match.index!;
							
							// Replace the markdown syntax with the alias text
							const startPos = newFrom + matchIndex + offset;
							const endPos = startPos + fullMatch.length;
							
							tr.replaceWith(startPos, endPos, view.state.schema.text(alias));
							
							// Add link mark to the alias text
							const linkMark = view.state.schema.marks.link.create({ href: url });
							tr.addMark(startPos, startPos + alias.length, linkMark);
							
							offset += alias.length - fullMatch.length;
						}
						
						view.dispatch(tr);
						return true;
					},
					handleKeyDown: (view, event) => {
						// Handle typing markdown link syntax
						if (event.key === ']') {
							const { state } = view;
							const { selection } = state;
							const { $from } = selection;
							
							// Check if we're at the end of a potential markdown link or image
							const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);
							const markdownLinkMatch = textBefore.match(/\[([^\]]*)$/);
							const markdownImageMatch = textBefore.match(/!\[([^\]]*)$/);
							
							if (markdownLinkMatch || markdownImageMatch) {
								// We're inside a markdown link or image, let it type normally
								return false;
							}
						}
						
						if (event.key === ')') {
							const { state } = view;
							const { selection } = state;
							const { $from } = selection;
							
							// Check if we're at the end of a potential markdown link or image URL
							const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);
							const markdownLinkMatch = textBefore.match(/\[([^\]]+)\]\(([^)]*)$/);
							const markdownImageMatch = textBefore.match(/!\[([^\]]*)\]\(([^)]*)$/);
							
							// Check for image match first (priority over link match)
							if (markdownImageMatch) {
								// Complete the markdown image
								event.preventDefault();
								
								const alt = markdownImageMatch[1];
								const url = markdownImageMatch[2];
								
								if (url) {
									// Find the exact position of the markdown syntax
									const markdownStart = $from.pos - textBefore.length + textBefore.lastIndexOf('![');
									const markdownEnd = $from.pos;
									
									const { tr } = state;
									
									// Replace markdown syntax with image node
									const imageNode = state.schema.nodes.image.create({
										src: url,
										alt: alt || ''
									});
									
									tr.replaceWith(markdownStart, markdownEnd, imageNode);
									
									view.dispatch(tr);
									return true;
								}
							}
							
							// Check for link match only if no image match was found
							if (markdownLinkMatch) {
								// Complete the markdown link
								event.preventDefault();
								
								const alias = markdownLinkMatch[1];
								const url = markdownLinkMatch[2];
								
								if (url) {
									// Find the exact position of the markdown syntax
									const markdownStart = $from.pos - textBefore.length + textBefore.lastIndexOf('[');
									const markdownEnd = $from.pos;
									
									const { tr } = state;
									tr.replaceWith(
										markdownStart,
										markdownEnd,
										state.schema.text(alias)
									);
									
									// Add link mark
									const linkMark = state.schema.marks.link.create({ href: url });
									tr.addMark(markdownStart, markdownStart + alias.length, linkMark);
									
									view.dispatch(tr);
									return true;
								}
							}
						}
						
						// Handle space and enter after markdown syntax
						if (event.key === ' ' || event.key === 'Enter') {
							const { state } = view;
							const { selection } = state;
							const { $from } = selection;
							
							// Check for incomplete markdown link or image syntax
							const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);
							
							// Check for incomplete markdown image first: ![alt](url
							const incompleteImageMatch = textBefore.match(/!\[([^\]]*)\]\(([^)]*)$/);
							if (incompleteImageMatch) {
								const alt = incompleteImageMatch[1];
								const url = incompleteImageMatch[2];
								
								if (url) {
									event.preventDefault();
									
									// Find the exact position of the markdown syntax
									const markdownStart = $from.pos - textBefore.length + textBefore.lastIndexOf('![');
									const markdownEnd = $from.pos;
									
									const { tr } = state;
									
									// Replace markdown syntax with image node
									const imageNode = state.schema.nodes.image.create({
										src: url,
										alt: alt || ''
									});
									
									tr.replaceWith(markdownStart, markdownEnd, imageNode);
									
									// Add the space or newline after the image
									const insertText = event.key === 'Enter' ? '\n' : ' ';
									tr.insertText(insertText, markdownStart + 1);
									
									view.dispatch(tr);
									return true;
								}
							}
							
							// Check for incomplete markdown link: [text](url
							const incompleteLinkMatch = textBefore.match(/\[([^\]]+)\]\(([^)]*)$/);
							if (incompleteLinkMatch) {
								const alias = incompleteLinkMatch[1];
								const url = incompleteLinkMatch[2];
								
								if (url) {
									event.preventDefault();
									
									// Find the exact position of the markdown syntax
									const markdownStart = $from.pos - textBefore.length + textBefore.lastIndexOf('[');
									const markdownEnd = $from.pos;
									
									const { tr } = state;
									tr.replaceWith(
										markdownStart,
										markdownEnd,
										state.schema.text(alias)
									);
									
									// Add link mark
									const linkMark = state.schema.marks.link.create({ href: url });
									tr.addMark(markdownStart, markdownStart + alias.length, linkMark);
									
									// Add the space or newline
									const insertText = event.key === 'Enter' ? '\n' : ' ';
									tr.insertText(insertText, markdownStart + alias.length);
									
									view.dispatch(tr);
									return true;
								}
							}
						}
						
						return false;
					},
				},
				appendTransaction: (transactions, oldState, newState) => {
					// Check for markdown link and image patterns in the document and convert them
					const { doc } = newState;
					const { tr } = newState;
					let modified = false;

					// Get all text content as a single string to check for patterns
					const fullText = doc.textContent;

					// Check for complete markdown patterns in the full text
					// Use more precise regex patterns to avoid nested matches
					const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
					const markdownImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;

					// Find all matches in the full text
					const allLinkMatches = [...fullText.matchAll(markdownLinkRegex)];
					const allImageMatches = [...fullText.matchAll(markdownImageRegex)];

					// Collect all matches with their positions and sort by position (reverse order for processing)
					const allMatches = [];

					// Add image matches first (they should take priority)
					for (const match of allImageMatches) {
						const [fullMatch, alt, url] = match;
						const matchIndex = match.index!;

						allMatches.push({
							type: 'image' as const,
							fullMatch,
							alt: alt || '',
							url,
							matchIndex
						});
					}

					// Add link matches, but exclude any that overlap with image matches
					for (const match of allLinkMatches) {
						const [fullMatch, alias, url] = match;
						const matchIndex = match.index!;

						// Check if this link match overlaps with any image match
						const overlapsWithImage = allImageMatches.some(imgMatch => {
							const imgStart = imgMatch.index!;
							const imgEnd = imgStart + imgMatch[0].length;
							const linkStart = matchIndex;
							const linkEnd = matchIndex + fullMatch.length;
							
							// Check for overlap
							return (linkStart < imgEnd && linkEnd > imgStart);
						});

						if (!overlapsWithImage) {
							allMatches.push({
								type: 'link' as const,
								fullMatch,
								alias: alias || '',
								url,
								matchIndex
							});
						}
					}

					// Sort by position in reverse order (process from end to beginning)
					allMatches.sort((a, b) => b.matchIndex - a.matchIndex);

					// Process all matches in order
					for (const match of allMatches) {
						// Find the actual positions in the document
						let currentPos = 0;
						let startPos = -1;
						let endPos = -1;

						doc.descendants((node, pos) => {
							if (node.isText) {
								const text = node.text || '';
								const textStart = currentPos;
								const textEnd = currentPos + text.length;

								// Check if this text node contains part of our match
								if (match.matchIndex >= textStart && match.matchIndex < textEnd) {
									// This is where our match starts
									startPos = pos + (match.matchIndex - textStart);
								}

								if (match.matchIndex + match.fullMatch.length > textStart && match.matchIndex + match.fullMatch.length <= textEnd) {
									// This is where our match ends
									endPos = pos + (match.matchIndex + match.fullMatch.length - textStart);
								}

								currentPos += text.length;
							}
						});

						if (startPos !== -1 && endPos !== -1) {
							try {
								if (match.type === 'image') {
									// Replace markdown syntax with image node
									const imageNode = newState.schema.nodes.image.create({
										src: match.url,
										alt: match.alt
									});
									tr.replaceWith(startPos, endPos, imageNode);
									modified = true;
								} else if (match.type === 'link') {
									// Replace only the markdown syntax with the alias text
									tr.replaceWith(startPos, endPos, newState.schema.text(match.alias));

									// Add link mark to the alias text
									const linkMark = newState.schema.marks.link.create({ href: match.url });
									tr.addMark(startPos, startPos + match.alias.length, linkMark);

									modified = true;
								}
							} catch (error) {
								console.error('Error processing markdown match:', error, match);
							}
						}
					}

					return modified ? tr : null;
				},
			}),
		];
	},
}); 