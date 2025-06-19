// carta-instance.ts
import { Carta, Markdown, type Plugin } from "carta-md";
import min_light from "shiki/themes/min-light.mjs";
// import { wikiLinkPlugin } from "$lib/wikiLinkPlugin";
import min_dark from "shiki/themes/min-dark.mjs";
import one_light from "shiki/themes/one-light.mjs";
// import remarkFrontmatter from "remark-frontmatter";
import "rehype-callouts/theme/vitepress";
import { svelteCustom } from "@cartamd/plugin-component/svelte";
import { initializeComponents } from "@cartamd/plugin-component/svelte";
import { component } from "@cartamd/plugin-component";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.css";
import { math } from "@cartamd/plugin-math";
import { anchor } from "@cartamd/plugin-anchor";
import { code } from "@cartamd/plugin-code";
import DOMPurify from "isomorphic-dompurify";
import rehypeCallouts from "rehype-callouts";
import rehypeMermaid from "rehype-mermaid";
// import cartawiki from "./cartawiki";
import rehypeShiki from "@shikijs/rehype";
import cartaTaskStylesMinimal from "./cartaTasks";
// import { cartaHideFrontmatter } from "./cartaHideFrontmatter";

// import WikiLinkPreview from "./WikiLinkPreview.svelte";

let cachedCarta: Carta | null = null;

const mermaid: Plugin = {
	transformers: [
		{
			execution: "async",
			type: "rehype",
			transform({ processor }) {
				processor.use(rehypeMermaid, { strategy: "img-png" });
			},
		},
	],
};

const shikicode: Plugin = {
	transformers: [
		{
			execution: "async",
			type: "rehype",
			transform({ processor }) {
				processor.use(rehypeShiki, {
					inline: "tailing-curly-colon",
					themes: {
						light: "one-light",
						dark: "everforest-dark",
					},
				});
			},
		},
	],
};

const callouts: Plugin = {
	transformers: [
		{
			execution: "async",
			type: "rehype",
			transform({ processor }) {
				processor.use(rehypeCallouts, { aliases: { note: ["NOTE"] } });
			},
		},
	],
};

// const mapped = [
// 	svelteCustom(
// 		"wiki-link",
// 		(node) =>
// 			node.tagName === "a" &&
// 			node.properties &&
// 			Array.isArray(node.properties.className) &&
// 			node.properties.className.includes("wiki-link"),
// 		WikiLinkPreview,
// 	),
// ];

// const hideFrontmatter: Plugin = {
// 	transformers: [
// 		{
// 			type: "remark",
// 			execution: "sync",
// 			transform({ processor }) {
// 				// Add remark-frontmatter to parse --- yaml --- blocks
// 				processor.use(remarkFrontmatter, ["yaml"]);
// 			},
// 		},
// 	],
// 	// name: "remarkFrontmatterSetup", // Optional name
// };

export function getCartaInstance(
  theme: "dark" | "light",
  forceReinit = false,
  additionalPlugins: Plugin[] = []
) {
	if (!cachedCarta || forceReinit) {
		cachedCarta = new Carta({
			// theme: theme === "dark" ? min_dark : one_light,
			// shikiOptions: {
			// 	themes: [one_light, min_dark],
			// },
			extensions: [
				// hideFrontmatter,
				// cartaHideFrontmatter,
				// code({
				// 	inline: "tailing-curly-colon",
				// 	langs: [
				// 		"javascript",
				// 		"docker",
				// 		"py",
				// 		"yaml",
				// 		"toml",
				// 		"rust",
				// 		"toml",
				// 		"shell",
				// 	],
				// 	theme: one_light,
				// }),
				// cartawiki,
				// cartaTaskStylesMinimal,
				// component(mapped, initializeComponents),
				math(),
				callouts,
				mermaid,
				shikicode,
				anchor(),
				...additionalPlugins
			],
			sanitizer: DOMPurify.sanitize,
		});
	}
	return cachedCarta;
}
