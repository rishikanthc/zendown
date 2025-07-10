import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// adapter-static generates a static site
		adapter: adapter({
			// default options are shown. On some platforms
			// these options are set automatically — see below
			pages: 'build',
			assets: 'build',
			fallback: '404.html',
			precompress: false,
			strict: true
		}),
		// Ensure all routes are prerendered
		prerender: {
			handleHttpError: ({ path, referrer, message }) => {
				// ignore missing links
				if (message.includes('Not found')) {
					return;
				}

				// otherwise, fail the build
				throw new Error(message);
			}
		},
		// Configure routing for SPA
		paths: {
			base: ''
		}
	}
};

export default config; 