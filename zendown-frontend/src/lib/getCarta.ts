import { Carta, Markdown, type Plugin } from "carta-md";
import min_light from "shiki/themes/min-light.mjs";
import min_dark from "shiki/themes/min-dark.mjs";
import one_light from "shiki/themes/one-light.mjs";
import "rehype-callouts/theme/vitepress";
import { svelteCustom } from "@cartamd/plugin-component/svelte";
import { initializeComponents } from "@cartamd/plugin-component/svelte";
import { component } from "@cartamd/plugin-component";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.css";
import { math } from "@cartamd/plugin-math";
import { anchor } from "@cartamd/plugin-anchor";
import { code } from "@cartamd/plugin-code";
import { attachment } from "@cartamd/plugin-attachment";
import DOMPurify from "isomorphic-dompurify";
import rehypeCallouts from "rehype-callouts";
import rehypeMermaid from "rehype-mermaid";
import rehypeShiki from "@shikijs/rehype";
import { api } from "./api";

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

export function getCartaInstance(theme: "dark" | "light", forceReinit = false) {
	if (!cachedCarta || forceReinit) {
		cachedCarta = new Carta({
			extensions: [
				mermaid,	
                shikicode,
				math(),
				callouts,
				anchor(),
				attachment({
					upload: async (file: File) => {
						try {
							const attachment = await api.uploadAttachment(file);
							return attachment.url;
						} catch (error) {
							console.error('Failed to upload attachment:', error);
							return null;
						}
					},
					supportedMimeTypes: [
						'image/jpeg',
						'image/jpg', 
						'image/png',
						'image/svg+xml',
						'image/gif',
						'image/webp'
					]
				})
			],
			sanitizer: DOMPurify.sanitize,
		});
	}
	return cachedCarta;
} 