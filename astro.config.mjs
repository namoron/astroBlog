import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";

import tailwind from "@astrojs/tailwind";
import remarkCodeTitles from "remark-flexible-code-titles";

// https://astro.build/config
export default defineConfig({
  site: "https://example.com",
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
  // markdown: {
  //   remarkPlugins: [remarkCodeTitles],
  // },
  // integrations: [
  //   tailwind({
  //     // Example: Provide a custom path to a Tailwind config file
  //     configFile: "./tailwind.config.mjs",
  //   }),
  // ],
});
