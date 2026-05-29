import { buildSearchResearchQueries } from "./queries";
import type {
  AngleOpportunity,
  CompanyProfile,
  ContentGap,
  RawSearchResult,
  SearchIntent,
  SearchLandscape,
  SearchQueryResult,
  SearchQueryType,
} from "./types";
import type { SearchProvider } from "./provider";

export async function generateSearchLandscape(input: {
  companyProfile: CompanyProfile;
  searchProvider: SearchProvider;
  limitPerQuery?: number;
}): Promise<SearchLandscape> {
  const queryPlan = buildSearchResearchQueries(input.companyProfile);
  const searchedQueries: SearchQueryResult[] = [];

  for (const plannedQuery of queryPlan) {
    const topResults = await input.searchProvider.search(plannedQuery.query, {
      limit: input.limitPerQuery ?? 10,
    });

    searchedQueries.push({
      query: plannedQuery.query,
      queryType: plannedQuery.queryType,
      observedIntent: inferIntent(plannedQuery.query, plannedQuery.queryType),
      topResults,
      dominantContentTypes: unique(topResults.map(inferContentType)),
      topResultThemes: inferThemes(topResults),
      recurringAngles: inferRecurringAngles(topResults),
      notableDomains: unique(topResults.map((result) => result.domain)).slice(0, 8),
      weakSpots: inferWeakSpots(plannedQuery.query, topResults),
    });
  }

  const contentGaps = buildContentGaps(searchedQueries);
  const angleOpportunities = buildAngleOpportunities(input.companyProfile, contentGaps);

  return {
    id: `search_landscape_${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`,
    createdAt: new Date().toISOString(),
    companyName: inferCompanyName(input.companyProfile),
    researchGoal: "Understand current SERP patterns, domain visibility, and content gaps before generating a content plan.",
    queryPlan,
    searchedQueries,
    serpPatterns: buildSerpPatterns(searchedQueries),
    domainVisibility: buildDomainVisibility(searchedQueries),
    contentGaps,
    angleOpportunities,
    recommendedStrategicFocus: buildStrategicFocus(input.companyProfile, contentGaps),
    assumptions: [
      ...input.companyProfile.confidence.assumptions,
      "Search result analysis currently uses deterministic heuristics rather than LLM judgment.",
      "Mock search results are directional only when SERPER_API_KEY is not provided.",
    ],
    risks: [
      "Live SERP results can change by geography, personalization, and freshness.",
      "Heuristic analysis may miss nuanced positioning, intent, or competitive differences.",
      "Search volume and keyword difficulty are not included yet.",
    ],
  };
}

function inferIntent(query: string, queryType: SearchQueryType): SearchIntent {
  const lower = query.toLowerCase();
  if (lower.includes("template")) return "template";
  if (queryType === "comparison" || /\bbest\b|alternatives?|vs\b/.test(lower)) return "comparison";
  if (queryType === "commercial" || /\bsoftware\b|\btool\b|\bplatform\b/.test(lower)) return "commercial";
  if (lower.startsWith("how to") || lower.includes("what is")) return "informational";
  if (queryType === "product_wedge") return "transactional";
  return "informational";
}

function inferContentType(result: RawSearchResult): string {
  const text = `${result.title} ${result.url}`.toLowerCase();
  if (/\bbest\b|\btools\b|alternatives?/.test(text)) return "comparison/listicle";
  if (text.includes("template")) return "template";
  if (/guide|how to|what is|blog/.test(text)) return "guide/blog";
  if (isProductDomain(result.domain) || /software|platform|tool/.test(text)) return "landing page";
  if (/docs|github|nextjs|vercel/.test(text)) return "technical docs";
  return "article";
}

function inferThemes(results: RawSearchResult[]): string[] {
  return unique(results.flatMap((result) => {
    const text = `${result.title} ${result.snippet ?? ""}`.toLowerCase();
    const themes: string[] = [];
    if (/seo|serp|keyword|topical/.test(text)) themes.push("SEO strategy and optimization");
    if (/ai|writing|writer|generation/.test(text)) themes.push("AI writing and generation");
    if (/workflow|calendar|operations|approval/.test(text)) themes.push("content workflow");
    if (/github|next\.js|markdown|mdx|cms/.test(text)) themes.push("publishing infrastructure");
    if (/saas|startup|founder/.test(text)) themes.push("SaaS startup growth");
    if (/agency|freelancer|service/.test(text)) themes.push("agency versus software");
    return themes;
  })).slice(0, 6);
}

function inferRecurringAngles(results: RawSearchResult[]): string[] {
  const contentTypes = unique(results.map(inferContentType));
  const themes = inferThemes(results);
  return [...contentTypes.map((type) => `${type} format dominates`), ...themes].slice(0, 8);
}

function inferWeakSpots(query: string, results: RawSearchResult[]): string[] {
  const combined = `${query} ${results.map((result) => `${result.title} ${result.snippet ?? ""} ${result.url}`).join(" ")}`.toLowerCase();
  const weakSpots: string[] = [];

  if (/ai|writer|writing/.test(combined)) weakSpots.push("generic AI writing focus");
  if (!/founder/.test(combined)) weakSpots.push("lacks founder perspective");
  if (!/saas/.test(combined)) weakSpots.push("lacks SaaS-specific angle");
  if (!/workflow|approval|operations|calendar/.test(combined)) weakSpots.push("lacks workflow detail");
  if (!/publish|github|next\.js|cms|markdown|mdx/.test(combined)) weakSpots.push("talks about writing but not publishing");
  if (!/github|code-based|next\.js|developer/.test(combined)) weakSpots.push("lacks GitHub/code-based publishing angle");
  if (/marketing teams|enterprise|content teams/.test(combined) && !/founder-led/.test(combined)) weakSpots.push("too broad for founders");

  return unique(weakSpots);
}

function buildContentGaps(searchedQueries: SearchQueryResult[]): ContentGap[] {
  const spotMap = new Map<string, string[]>();
  for (const result of searchedQueries) {
    for (const weakSpot of result.weakSpots) {
      spotMap.set(weakSpot, [...(spotMap.get(weakSpot) ?? []), result.query]);
    }
  }

  const gapByWeakSpot: Record<string, Omit<ContentGap, "relatedQueries" | "priority">> = {
    "generic AI writing focus": {
      gap: "SERPs over-index on AI writing instead of end-to-end blog operations.",
      gapType: "product_gap",
      whyItMatters: "Tavyn can separate itself from commodity AI writing tools by owning planning, review, and publishing.",
      suggestedContentAngle: "Why AI blog writers are not enough for founder-led SaaS SEO.",
    },
    "too broad for founders": {
      gap: "Existing content is aimed at marketing teams, not founders running lean SaaS companies.",
      gapType: "audience_gap",
      whyItMatters: "Founder-led teams need lighter workflows and clearer tradeoffs than mature content teams.",
      suggestedContentAngle: "A founder's guide to running SaaS blog operations without hiring a content team.",
    },
    "talks about writing but not publishing": {
      gap: "Many results stop at drafts and do not address publishing handoff.",
      gapType: "workflow_gap",
      whyItMatters: "Publishing friction is where content consistency often breaks down.",
      suggestedContentAngle: "From SEO brief to approved draft to published SaaS blog post.",
    },
    "lacks workflow detail": {
      gap: "SERPs mention strategy but rarely show the operating workflow.",
      gapType: "depth_gap",
      whyItMatters: "A concrete workflow makes Tavyn's operational value easier to understand.",
      suggestedContentAngle: "The lightweight SaaS blog workflow: plan, brief, approve, publish.",
    },
    "lacks SaaS-specific angle": {
      gap: "Broad SEO advice does not map to SaaS categories, ICPs, and product-led conversion.",
      gapType: "pov_gap",
      whyItMatters: "SaaS founders need content tied to product positioning and qualified demand.",
      suggestedContentAngle: "How to build an SEO content plan around a SaaS product category.",
    },
    "lacks GitHub/code-based publishing angle": {
      gap: "Technical publishing searches are separated from SEO content operations.",
      gapType: "product_gap",
      whyItMatters: "Tavyn's direct publishing wedge can bridge content strategy and code-based websites.",
      suggestedContentAngle: "How to publish SEO blog posts to a Next.js or GitHub-backed SaaS site.",
    },
    "lacks founder perspective": {
      gap: "Current results rarely explain how to preserve founder POV in SEO content.",
      gapType: "pov_gap",
      whyItMatters: "Founder perspective is a defensible way to avoid generic AI content.",
      suggestedContentAngle: "How to turn founder perspective into SEO content that still ranks.",
    },
  };

  return [...spotMap.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 7)
    .map(([weakSpot, relatedQueries]) => ({
      ...gapByWeakSpot[weakSpot],
      relatedQueries: unique(relatedQueries),
      priority: relatedQueries.length >= 5 ? "high" : relatedQueries.length >= 3 ? "medium" : "low",
    }))
    .filter(Boolean) as ContentGap[];
}

function buildAngleOpportunities(companyProfile: CompanyProfile, gaps: ContentGap[]): AngleOpportunity[] {
  // TODO: Replace these deterministic mappings with LLM-assisted synthesis once the pipeline adds model calls.
  return gaps.slice(0, 5).map((gap) => ({
    angle: gap.suggestedContentAngle,
    evidenceFromSearch: `${gap.relatedQueries.length} searched queries showed: ${gap.gap}`,
    whyCompanyCanWin: companyProfile.messaging.positioning,
    recommendedCluster: inferCluster(gap),
    businessValue: gap.priority === "high" ? "high" : "medium",
    seoOpportunity: gap.relatedQueries.length >= 4 ? "high" : "medium",
  }));
}

function buildSerpPatterns(searchedQueries: SearchQueryResult[]): SearchLandscape["serpPatterns"] {
  const byContentType = new Map<string, string[]>();

  for (const queryResult of searchedQueries) {
    for (const contentType of queryResult.dominantContentTypes) {
      byContentType.set(contentType, [...(byContentType.get(contentType) ?? []), queryResult.query]);
    }
  }

  return [...byContentType.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 5)
    .map(([contentType, relatedQueries]) => ({
      pattern: `${contentType} results appear frequently`,
      relatedQueries: unique(relatedQueries),
      whyItMatters: `This format is a visible SERP pattern and should inform Tavyn's future content plan.`,
    }));
}

function buildDomainVisibility(searchedQueries: SearchQueryResult[]): SearchLandscape["domainVisibility"] {
  const domainMap = new Map<string, string[]>();

  for (const queryResult of searchedQueries) {
    for (const domain of queryResult.notableDomains) {
      domainMap.set(domain, [...(domainMap.get(domain) ?? []), queryResult.query]);
    }
  }

  return [...domainMap.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 10)
    .map(([domain, appearedForQueries]) => ({
      domain,
      domainType: inferDomainType(domain),
      appearedForQueries: unique(appearedForQueries),
      appearanceCount: appearedForQueries.length,
      observedPositioning: inferDomainPositioning(domain),
      relevanceToCompany: inferDomainRelevance(domain),
    }));
}

function buildStrategicFocus(companyProfile: CompanyProfile, gaps: ContentGap[]): string {
  const focusAreas = unique([
    "founder-led SaaS blog operations",
    "SEO content planning before drafting",
    "founder approval workflows",
    "direct publishing to code-based or CMS-backed sites",
    ...gaps.slice(0, 3).map((gap) => gap.suggestedContentAngle.toLowerCase()),
  ]);

  return `${inferCompanyName(companyProfile)} should focus content on ${focusAreas.slice(0, 5).join(", ")}. The strongest positioning is to avoid generic AI writing language and show how founders move from company profile to content plan, SEO brief, draft approval, and direct publishing.`;
}

function inferCompanyName(companyProfile: CompanyProfile): string {
  const firstSentence = companyProfile.companySummary.split(".")[0] ?? "";
  const beforeIs = firstSentence.split(/\s+is\s+/i)[0]?.trim();
  if (beforeIs) return beforeIs;

  const match = companyProfile.companySummary.match(/^([A-Z][A-Za-z0-9 ]{1,40})/);
  return match?.[1]?.trim() || "Company";
}

function inferCluster(gap: ContentGap): string {
  if (gap.gapType === "product_gap") return "Product-led publishing workflow";
  if (gap.gapType === "audience_gap") return "Founder-led SaaS SEO";
  if (gap.gapType === "workflow_gap" || gap.gapType === "depth_gap") return "Blog operations workflow";
  return "SaaS SEO content strategy";
}

function inferDomainPositioning(domain: string): string {
  if (/surfer|clearscope|marketmuse|semrush|ahrefs/.test(domain)) return "SEO research, optimization, or content planning platform.";
  if (/jasper|copy/.test(domain)) return "AI writing platform.";
  if (/nextjs|vercel|github|contentlayer|decap|sanity/.test(domain)) return "Technical publishing, CMS, or developer workflow.";
  if (/g2/.test(domain)) return "Software comparison marketplace.";
  return "Content marketing or SEO publisher.";
}

function inferDomainType(domain: string): SearchLandscape["domainVisibility"][number]["domainType"] {
  if (/reddit|quora|news\.ycombinator/.test(domain)) return "community";
  if (/youtube|github|nextjs|vercel|contentlayer|decap|sanity/.test(domain)) return "platform";
  if (/animalz|singlegrain|grizzle|marketermilk/.test(domain)) return "agency";
  if (/ahrefs|semrush|hubspot|moz|backlinko/.test(domain)) return "seo_publisher";
  if (/surfer|clearscope|marketmuse|jasper|copy|coschedule/.test(domain)) return "tool_vendor";
  return "other";
}

function inferDomainRelevance(domain: string): "low" | "medium" | "high" {
  if (/surfer|clearscope|marketmuse|jasper|copy|semrush|ahrefs/.test(domain)) return "high";
  if (/nextjs|vercel|github|contentlayer|decap|sanity|g2/.test(domain)) return "medium";
  return "low";
}

function isProductDomain(domain: string): boolean {
  return /surfer|clearscope|marketmuse|jasper|copy|coschedule|sanity/.test(domain);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values.filter(Boolean))];
}
