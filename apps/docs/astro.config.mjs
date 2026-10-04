// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import cloudflare from '@astrojs/cloudflare';
import starlight from '@astrojs/starlight';

// MDX 8's markdown engine ("satteri") needs a runtime binding: native on
// Node, WebAssembly in browsers and in Astro 7's workerd-based dev isolation.
// Bun skips satteri's wasm32 optional dependency during install, so
// `scripts/ensure-satteri-wasm.mjs` (postinstall) extracts the vendored
// tarball from vendor/ into the package store. No vite overrides needed.

// https://astro.build/config
export default defineConfig({
	site: 'https://framework.habib.cloud',
	output: 'static',
	adapter: cloudflare({
		// Prerender (and `astro dev` rendering) in Node: workerd cannot load
		// satteri's native N-API binding, which made every page 500 in dev.
		prerenderEnvironment: 'node',
	}),
	integrations: [
		// starlight first: it registers astro-expressive-code, which must come
		// before mdx() so MDX pages get syntax-highlighted code blocks.
		starlight({
			title: 'Framework',
			description: 'Laravel-inspired TypeScript framework on Bun + Hono + Drizzle + Zod',
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/withastro/starlight' }],
			// Versioned docs: the current release is shown in the landing hero and
			// listed on /versions; older versions archive to their own locale once
			// a breaking release ships (Laravel-style docs versioning).
			locales: {
				root: { label: 'English (v0.1)', lang: 'en' },
				ar: { label: 'العربية', lang: 'ar', dir: 'rtl' },
			},
			sidebar: [
				{ label: 'Introduction', link: '/' },
				{ label: 'Getting started', slug: 'getting-started' },
				{ label: 'Helpers', slug: 'helpers' },
				{ label: 'CLI reference', slug: 'cli-reference' },
				{ label: 'Authoring modules', slug: 'modules' },
				{ label: 'Platform guide', slug: 'platform' },
				{ label: 'Testing', slug: 'testing' },
				{ label: 'Deployment', slug: 'deployment' },
				{
					label: 'Reference',
					items: [
						{ label: 'Versions', slug: 'versions' },
						{ label: 'Implementation status', slug: 'status' },
						{ label: 'Architecture decisions', slug: 'decisions' },
				],
			},
		],
		}),
		mdx(),
	],
});
