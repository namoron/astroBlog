import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import partytown from "@astrojs/partytown";
import tailwindcss from "@tailwindcss/vite";
import remarkLinkCard from "remark-link-card";
import rehypeRaw from "rehype-raw";
import rehypeExternalLinks from "rehype-external-links";
// https://astro.build/config
export default defineConfig({
  site: "https://namorz.com",
  integrations: [
    mdx(),
    sitemap(),
    partytown({
      // Adds dataLayer.push as a forwarding-event.
      config: {
        forward: ["dataLayer.push"],
      },
    }),
  ],

  markdown: {
    remarkPlugins: [[remarkLinkCard, { shortenUrl: true }]],
    rehypePlugins: [rehypeRaw, [rehypeExternalLinks, { target: "_blank" }]],
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
