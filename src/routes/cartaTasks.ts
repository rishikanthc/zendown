// src/lib/cartaTaskStylesMinimal.ts
import { visit } from "unist-util-visit";
import type { Root, Element } from "hast";
import type { Plugin as UnifiedPlugin } from "unified";
import type { Plugin as CartaPlugin } from "carta-md";

// URL-encoded white checkmark SVG with fully encoded characters
const whiteCheckSvgUrl = `data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%2016%2016%22%20fill=%22none%22%3E%3Cpath%20d=%22M4%208%20L7%2011%20L12%205%22%20stroke=%22white%22%20stroke-width=%222%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22/%3E%3C/svg%3E`;

const rehypeMinimalTaskStyles: UnifiedPlugin<[], Root> = () => {
	return function transformer(tree: Root) {
		visit(tree, "element", (node: Element) => {
			// Target list items that are task list items.
			if (
				node.tagName === "li" &&
				node.properties?.className?.includes("task-list-item")
			) {
				// Update LI styling.
				const liClasses = (
					(node.properties?.className as string[]) || []
				).filter((cls) => cls !== "task-list-item");
				liClasses.push("list-none", "relative", "pl-0", "mb-1");
				node.properties.className = [...new Set(liClasses)];

				// Look for input checkboxes among LI's children.
				if (node.children && Array.isArray(node.children)) {
					for (let i = 0; i < node.children.length; i++) {
						const child = node.children[i];
						if (
							child.type === "element" &&
							child.tagName === "input" &&
							child.properties?.type === "checkbox"
						) {
							// Ensure the checkbox can be styled as a peer.
							child.properties.className = [
								...((child.properties.className as string[]) || []),
								"peer", // Required for peer-checked to work.
								"h-4",
								"w-4",
								"rounded-[2px]",
								"bg-blue-500",
								"flex",
								"items-center",
								"justify-center",
								"appearance-none",
								"dark:bg-gray-700",
								"cursor-pointer",
								"flex-shrink-0",
							];

							// Remove disabled if present.
							delete child.properties.disabled;

							// Create a new span element that will display the checkmark.
							const checkmarkSpan: Element = {
								type: "element",
								tagName: "span",
								properties: {
									// Position over the input.
									className: [
										"absolute",
										"inset-0",
										"bg-center",
										"bg-no-repeat",
										"bg-contain",
										"opacity-0",
										"peer-checked:opacity-100",
										"pointer-events-none",
									],
									// Use inline style for the background image.
									style: `background-image: url("${whiteCheckSvgUrl}")`,
								},
								children: [],
							};

							// Wrap the original checkbox and the checkmark span inside a relative container.
							const wrapper: Element = {
								type: "element",
								tagName: "span",
								properties: {
									className: ["relative", "inline-block"],
								},
								children: [child, checkmarkSpan],
							};

							// Replace the checkbox node with the new wrapper.
							node.children[i] = wrapper;
						}
					}
				}
			}
		});
	};
};

const cartaTaskStylesMinimal: CartaPlugin = {
	transformers: [
		{
			execution: "sync",
			type: "rehype",
			transform({ processor }) {
				processor.use(rehypeMinimalTaskStyles);
			},
		},
	],
};

export default cartaTaskStylesMinimal;
