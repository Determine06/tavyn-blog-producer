import type { RawSearchResult } from "./types";

export type SearchProvider = {
  search(query: string, options?: { limit?: number }): Promise<RawSearchResult[]>;
};

export class MockSearchProvider implements SearchProvider {
  async search(query: string, options: { limit?: number } = {}): Promise<RawSearchResult[]> {
    const limit = options.limit ?? 10;
    const lowerQuery = query.toLowerCase();
    const resultBank = lowerQuery.includes("github") || lowerQuery.includes("next.js")
      ? technicalPublishingResults(query)
      : lowerQuery.includes("best") || lowerQuery.includes("alternative") || lowerQuery.includes("tools")
        ? comparisonResults(query)
        : lowerQuery.includes("how to") || lowerQuery.includes("workflow") || lowerQuery.includes("plan")
          ? educationalResults(query)
          : productResults(query);

    return resultBank.slice(0, limit).map((result, index) => ({
      position: index + 1,
      ...result,
    }));
  }
}

export class SerperSearchProvider implements SearchProvider {
  private readonly apiKey: string;

  constructor(apiKey = process.env.SERPER_API_KEY) {
    if (!apiKey) {
      throw new Error("SERPER_API_KEY is required to use SerperSearchProvider.");
    }
    this.apiKey = apiKey;
  }

  async search(query: string, options: { limit?: number } = {}): Promise<RawSearchResult[]> {
    const limit = options.limit ?? 10;
    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": this.apiKey,
      },
      body: JSON.stringify({ q: query, num: limit }),
    });

    if (!response.ok) {
      throw new Error(`Serper search failed for "${query}": ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as { organic?: Array<{ title?: string; link?: string; snippet?: string; position?: number }> };

    return (data.organic ?? []).slice(0, limit).map((result, index) => {
      const url = result.link ?? "";
      return {
        position: result.position ?? index + 1,
        title: result.title ?? "Untitled result",
        url,
        domain: getDomain(url),
        snippet: result.snippet,
      };
    });
  }
}

export function getDefaultSearchProvider(): SearchProvider {
  if (process.env.SERPER_API_KEY) {
    return new SerperSearchProvider();
  }

  return new MockSearchProvider();
}

function educationalResults(query: string): Omit<RawSearchResult, "position">[] {
  return [
    result("How to Create an SEO Content Plan That Actually Works", "https://ahrefs.com/blog/seo-content-plan/", "Step-by-step SEO planning guidance for content teams."),
    result("SEO Content Strategy: A Practical Guide", "https://www.semrush.com/blog/seo-content-strategy/", "A broad guide to keyword research, planning, and optimization."),
    result(`${titleCase(query)}: Founder Guide`, "https://www.contentharmony.com/blog/seo-content-workflow/", "Workflow advice for briefs, approvals, and content calendars."),
    result("The Complete Guide to SaaS Content Marketing", "https://www.animalz.co/blog/saas-content-marketing/", "Strategic SaaS content guidance with examples."),
    result("How to Build Topical Authority", "https://www.clearscope.io/blog/topical-authority", "Explains topic clusters and authority building."),
    result("Content Workflow Management for Small Teams", "https://coschedule.com/blog/content-workflow", "Covers planning and publishing workflow basics."),
  ];
}

function comparisonResults(query: string): Omit<RawSearchResult, "position">[] {
  return [
    result(`Best ${titleCase(query)} in 2026`, "https://www.g2.com/categories/content-marketing-software", "Compare popular content marketing tools and user reviews."),
    result("Best AI SEO Tools for Content Teams", "https://www.jasper.ai/blog/ai-seo-tools", "A list of AI tools focused on content writing and optimization."),
    result("Top SEO Content Tools Compared", "https://www.surferseo.com/blog/best-seo-tools/", "Compares tools for SERP analysis, briefs, and writing."),
    result("Best AI Writing Software", "https://www.copy.ai/blog/best-ai-writing-tools", "A broad list of AI writing tools for marketers."),
    result("SEO Agency vs Software: Which Should Startups Choose?", "https://www.singlegrain.com/seo/seo-agency-vs-software/", "Discusses tradeoffs between services and software."),
    result("Content Operations Platforms Compared", "https://www.marketmuse.com/blog/content-operations-platforms/", "Comparison of enterprise-oriented content operations platforms."),
  ];
}

function technicalPublishingResults(query: string): Omit<RawSearchResult, "position">[] {
  return [
    result(`How to ${titleCase(query)}`, "https://nextjs.org/docs/app/building-your-application/configuring/mdx", "Official docs for publishing markdown and MDX in Next.js."),
    result("Git-Based CMS for Markdown Sites", "https://decapcms.org/docs/intro/", "Open source Git-based CMS workflow for static sites."),
    result("Contentlayer: Content SDK for TypeScript", "https://contentlayer.dev/docs/getting-started", "Developer-focused content pipeline for code-based websites."),
    result("Publish Blog Posts with GitHub Actions", "https://github.blog/changelog/", "Examples of automating publishing workflows with GitHub."),
    result("Headless CMS for Next.js", "https://www.sanity.io/nextjs", "CMS-driven publishing for Next.js websites."),
    result("Managing Markdown Content in Next.js", "https://vercel.com/guides/loading-static-file-nextjs-api-route", "Technical guide for static content workflows."),
  ];
}

function productResults(query: string): Omit<RawSearchResult, "position">[] {
  return [
    result(`${titleCase(query)} Software`, "https://www.surferseo.com/", "SEO content editor and optimization platform."),
    result("AI Blog Writer for Marketing Teams", "https://www.jasper.ai/", "AI writing platform for marketers and teams."),
    result("Content Brief Software", "https://www.clearscope.io/", "SEO content optimization and brief software."),
    result("AI Content Workflow Platform", "https://www.copy.ai/", "AI content generation workflows for go-to-market teams."),
    result("SEO Content Planning Tool", "https://www.marketmuse.com/", "Content planning and optimization software."),
    result("Content Calendar and Workflow Software", "https://coschedule.com/", "Marketing calendar and content workflow platform."),
  ];
}

function result(title: string, url: string, snippet: string): Omit<RawSearchResult, "position"> {
  return {
    title,
    url,
    domain: getDomain(url),
    snippet,
  };
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function titleCase(value: string): string {
  return value.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}
