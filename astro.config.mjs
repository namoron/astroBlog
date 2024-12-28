import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import partytown from "@astrojs/partytown";
import tailwind from "@astrojs/tailwind";
import remarkLinkCard from "remark-link-card";
import rehypeRaw from "rehype-raw";
import rehypeExternalLinks from "rehype-external-links";
// https://astro.build/config
export default defineConfig({
  site: "https://namorz.com",
  integrations: [
    mdx(),
    sitemap(),
    tailwind(),
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
  // integrations: [
  //   tailwind({
  //     // Example: Provide a custom path to a Tailwind config file
  //     configFile: "./tailwind.config.mjs",
  //   }),
  // ],
});
