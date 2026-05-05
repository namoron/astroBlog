import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { marked } from "marked";
import { createClient } from "microcms-js-sdk";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(rootDir, ".env");
const mediaCache = new Map();

function parseArgs() {
  const args = new Set(process.argv.slice(2));

  return {
    collection: args.has("--work") ? "work" : "blog",
    dryRun: args.has("--dry-run"),
    publish: args.has("--publish"),
  };
}

async function loadEnv() {
  const text = await fs.readFile(envPath, "utf8");
  const env = {};

  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) {
      continue;
    }

    env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }

  return env;
}

async function walkMarkdownFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...await walkMarkdownFiles(fullPath));
    } else if (entry.isFile() && /\.(md|mdx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

function toSlug(filePath, contentDir) {
  const relative = path.relative(contentDir, filePath).replace(/\\/g, "/");
  return relative.replace(/\/index\.mdx?$/, "").replace(/\.mdx?$/, "");
}

function toAssetPublicPath(collection, slug, assetPath) {
  return `/cms-assets/${collection}/${slug}/${path.basename(assetPath)}`;
}

function getMimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    ".gif": "image/gif",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
  };

  return mimeTypes[extension] ?? "application/octet-stream";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findLocalAsset(collection, markdownDir, rawPath) {
  if (!rawPath.startsWith("./") && !rawPath.startsWith("../")) {
    return undefined;
  }

  const candidates = [
    path.resolve(markdownDir, rawPath),
    path.resolve(rootDir, "public", collection, rawPath.replace(/^\.\//, "")),
    path.resolve(rootDir, "public", rawPath.replace(/^\.\//, "")),
  ];

  for (const candidate of candidates) {
    try {
      const stats = await fs.stat(candidate);

      if (stats.isFile()) {
        return candidate;
      }
    } catch {
      // Try the next candidate.
    }
  }

  return undefined;
}

async function uploadMedia(serviceDomain, apiKey, sourcePath) {
  if (mediaCache.has(sourcePath)) {
    return mediaCache.get(sourcePath);
  }

  const stats = await fs.stat(sourcePath);

  if (stats.size > 5 * 1024 * 1024) {
    throw new Error(
      `Media upload limit exceeded: ${path.relative(rootDir, sourcePath)} is ${Math.ceil(stats.size / 1024 / 1024)}MB. Upload it manually in microCMS or reduce the file size.`,
    );
  }

  const data = await fs.readFile(sourcePath);
  const formData = new FormData();
  formData.append(
    "file",
    new Blob([data], { type: getMimeType(sourcePath) }),
    path.basename(sourcePath),
  );

  let response;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    response = await fetch(`https://${serviceDomain}.microcms-management.io/api/v1/media`, {
      method: "POST",
      headers: {
        "X-MICROCMS-API-KEY": apiKey,
      },
      body: formData,
    });

    if (response.status !== 429) {
      break;
    }

    await sleep(3000 * (attempt + 1));
  }

  if (!response.ok) {
    throw new Error(`Media upload failed: ${response.status} ${await response.text()}`);
  }

  const media = await response.json();
  mediaCache.set(sourcePath, media.url);

  return media.url;
}

async function copyLocalAsset(collection, slug, sourcePath) {
  const publicPath = toAssetPublicPath(collection, slug, sourcePath);
  const destinationPath = path.join(rootDir, "public", publicPath);

  await fs.mkdir(path.dirname(destinationPath), { recursive: true });
  await fs.copyFile(sourcePath, destinationPath);

  return publicPath;
}

async function resolveAssetUrl({ collection, slug, markdownDir, rawPath, serviceDomain, apiKey }) {
  const sourcePath = await findLocalAsset(collection, markdownDir, rawPath);

  if (!sourcePath) {
    return rawPath;
  }

  try {
    return await uploadMedia(serviceDomain, apiKey, sourcePath);
  } catch (error) {
    if (!String(error?.message ?? error).includes("Media upload limit exceeded")) {
      throw error;
    }

    return await copyLocalAsset(collection, slug, sourcePath);
  }
}

async function rewriteAssetPaths({ collection, slug, markdownDir, content, serviceDomain, apiKey }) {
  const replacements = new Map();
  const markdownImagePattern = /!\[([^\]]*)\]\((\.{1,2}\/[^)]+)\)/g;
  const htmlImagePattern = /(<img\b[^>]*\bsrc=["'])(\.{1,2}\/[^"']+)(["'][^>]*>)/g;

  for (const match of content.matchAll(markdownImagePattern)) {
    replacements.set(
      match[2],
      await resolveAssetUrl({ collection, slug, markdownDir, rawPath: match[2], serviceDomain, apiKey }),
    );
  }

  for (const match of content.matchAll(htmlImagePattern)) {
    replacements.set(
      match[2],
      await resolveAssetUrl({ collection, slug, markdownDir, rawPath: match[2], serviceDomain, apiKey }),
    );
  }

  let rewritten = content;

  for (const [from, to] of replacements) {
    rewritten = rewritten.replaceAll(from, to);
  }

  return rewritten;
}

function toIsoDate(value) {
  if (!value) {
    return undefined;
  }

  return new Date(value).toISOString();
}

async function resolveHeroImage({ collection, slug, markdownDir, heroImage, serviceDomain, apiKey }) {
  if (!heroImage) {
    return undefined;
  }

  return await resolveAssetUrl({
    collection,
    slug,
    markdownDir,
    rawPath: String(heroImage),
    serviceDomain,
    apiKey,
  });
}

async function createOrUpdate(client, endpoint, contentId, content, publish) {
  try {
    await client.create({
      endpoint,
      contentId,
      content,
      isDraft: !publish,
    });
    return "created";
  } catch (error) {
    const message = String(error?.message ?? error);

    if (!message.includes("409") && !message.includes("already exists")) {
      throw error;
    }

    await client.update({
      endpoint,
      contentId,
      content,
    });
    return "updated";
  }
}

async function main() {
  const { collection, dryRun, publish } = parseArgs();
  const env = await loadEnv();
  const serviceDomain = env.MICROCMS_SERVICE_DOMAIN;
  const apiKey = env.MICROCMS_API_KEY;
  const endpoint =
    collection === "work"
      ? env.MICROCMS_WORK_ENDPOINT
      : env.MICROCMS_BLOG_ENDPOINT;

  if (!serviceDomain || !apiKey || !endpoint) {
    throw new Error(`Missing microCMS env vars for ${collection}.`);
  }

  const contentDir = path.join(rootDir, "src", "content", collection);
  const files = await walkMarkdownFiles(contentDir);
  const client = createClient({ serviceDomain, apiKey });

  for (const file of files) {
    const slug = toSlug(file, contentDir);
    const markdownDir = path.dirname(file);
    const parsed = matter(await fs.readFile(file, "utf8"));
    const contentId = slug.replaceAll("/", "-").toLowerCase();

    if (dryRun) {
      console.log(`[dry-run] ${collection}/${slug} -> ${endpoint}/${contentId}`);
      continue;
    }

    const markdown = await rewriteAssetPaths({
      collection,
      slug,
      markdownDir,
      content: parsed.content,
      serviceDomain,
      apiKey,
    });
    const html = await marked.parse(markdown);
    const heroImage = await resolveHeroImage({
      collection,
      slug,
      markdownDir,
      heroImage: parsed.data.heroImage,
      serviceDomain,
      apiKey,
    });
    const content = {
      slug,
      title: parsed.data.title,
      description: parsed.data.description ?? "",
      content: html,
      pubDate: toIsoDate(parsed.data.pubDate),
      updatedDate: toIsoDate(parsed.data.updatedDate),
      heroImage,
    };

    const result = await createOrUpdate(client, endpoint, contentId, content, publish);
    console.log(`[${result}] ${collection}/${slug} -> ${endpoint}/${contentId}`);
    await sleep(1000);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
