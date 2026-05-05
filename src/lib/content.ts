import { createClient, type MicroCMSImage, type MicroCMSListContent } from "microcms-js-sdk";
import { getCollection, type CollectionEntry } from "astro:content";

type CollectionName = "blog" | "work";
type LocalEntry<T extends CollectionName> = CollectionEntry<T>;

export type ContentPost = {
  id: string;
  slug: string;
  title: string;
  description: string;
  pubDate: Date;
  updatedDate?: Date;
  heroImage?: string;
};

export type MicroCmsPost = ContentPost & {
  source: "microcms";
  content: string;
};

export type LocalPost<T extends CollectionName> = ContentPost & {
  source: "local";
  entry: LocalEntry<T>;
};

export type PostWithSource<T extends CollectionName> = MicroCmsPost | LocalPost<T>;

type MicroCmsContent = MicroCMSListContent & {
  slug?: string;
  title: string;
  description?: string;
  content?: string;
  pubDate?: string;
  updatedDate?: string;
  heroImage?: MicroCMSImage | string;
};

const serviceDomain = import.meta.env.MICROCMS_SERVICE_DOMAIN;
const apiKey = import.meta.env.MICROCMS_API_KEY;
const endpoints = {
  blog: import.meta.env.MICROCMS_BLOG_ENDPOINT,
  work: import.meta.env.MICROCMS_WORK_ENDPOINT,
};

const hasMicroCmsConfig = Boolean(serviceDomain && apiKey);

const client = hasMicroCmsConfig
  ? createClient({
      serviceDomain,
      apiKey,
    })
  : null;

function toDate(value: string | Date | undefined, fallback: string | Date): Date {
  return new Date(value ?? fallback);
}

function toHeroImage(heroImage: MicroCmsContent["heroImage"]): string | undefined {
  if (!heroImage) {
    return undefined;
  }

  if (typeof heroImage === "string") {
    return heroImage;
  }

  return heroImage.url;
}

function normalizeMicroCmsPost(post: MicroCmsContent): MicroCmsPost {
  const publishedAt = post.publishedAt ?? post.createdAt;

  return {
    source: "microcms",
    id: post.id,
    slug: post.slug ?? post.id,
    title: post.title,
    description: post.description ?? "",
    content: post.content ?? "",
    pubDate: toDate(post.pubDate, publishedAt),
    updatedDate: post.updatedDate ? new Date(post.updatedDate) : undefined,
    heroImage: toHeroImage(post.heroImage),
  };
}

function normalizeLocalPost<T extends CollectionName>(entry: LocalEntry<T>): LocalPost<T> {
  return {
    source: "local",
    id: entry.id,
    slug: entry.id,
    title: entry.data.title,
    description: entry.data.description,
    pubDate: entry.data.pubDate,
    updatedDate: entry.data.updatedDate,
    heroImage: entry.data.heroImage,
    entry,
  };
}

async function getMicroCmsPosts(endpoint: string): Promise<MicroCmsPost[]> {
  if (!client) {
    return [];
  }

  const posts = await client.getAllContents<MicroCmsContent>({
    endpoint,
    queries: {
      orders: "-pubDate",
    },
  });

  return posts.map(normalizeMicroCmsPost);
}

async function getLocalPosts<T extends CollectionName>(collection: T): Promise<LocalPost<T>[]> {
  const posts = await getCollection(collection);
  return posts.map((post) => normalizeLocalPost(post as LocalEntry<T>));
}

export async function getPosts<T extends CollectionName>(
  collection: T,
): Promise<PostWithSource<T>[]> {
  const endpoint = endpoints[collection];
  const posts =
    hasMicroCmsConfig && endpoint
      ? await getMicroCmsPosts(endpoint)
      : await getLocalPosts(collection);

  return posts.sort((a, b) => b.pubDate.valueOf() - a.pubDate.valueOf()) as PostWithSource<T>[];
}
