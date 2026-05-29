import type {
  CompanyProfile,
  FunnelStage,
  ReaderStage,
  SearchQueryPlan,
  SearchQueryType,
  SearchResearchQuery,
} from "./types";

type CandidateQuery = Omit<SearchResearchQuery, "id"> & { score: number };

const maxQueryWords = 10;

export function buildSearchResearchQueries(companyProfile: CompanyProfile): SearchResearchQuery[] {
  const candidates = buildCandidates(companyProfile);
  const sortedCandidates = candidates.sort((a, b) => b.score - a.score);
  const picked: CandidateQuery[] = [];
  const seen = new Set<string>();

  addByPredicate(sortedCandidates, picked, seen, (query) => query.queryType === "core_category");
  addByPredicate(sortedCandidates, picked, seen, (query) => query.queryType === "problem_aware");
  addByPredicate(sortedCandidates, picked, seen, (query) => query.queryType === "problem_aware");
  addByPredicate(sortedCandidates, picked, seen, (query) => query.queryType === "solution_aware");
  addByPredicate(sortedCandidates, picked, seen, (query) => query.queryType === "solution_aware");
  addByPredicate(sortedCandidates, picked, seen, (query) => query.queryType === "product_wedge" && query.funnelStage === "mofu");
  addByPredicate(sortedCandidates, picked, seen, (query) => query.queryType === "commercial");
  addByPredicate(sortedCandidates, picked, seen, (query) => query.queryType === "vendor_aware");
  addByPredicate(sortedCandidates, picked, seen, (query) => query.queryType === "comparison");
  addByPredicate(sortedCandidates, picked, seen, (query) => query.queryType === "product_wedge" && query.funnelStage === "bofu");

  fillStage(sortedCandidates, picked, seen, "tofu", 4);
  fillStage(sortedCandidates, picked, seen, "mofu", 4);
  fillStage(sortedCandidates, picked, seen, "bofu", 4);

  return picked.slice(0, 12).sort(byFunnelStage).map((query, index) => ({
    id: `sq_${String(index + 1).padStart(2, "0")}`,
    query: query.query,
    queryType: query.queryType,
    funnelStage: query.funnelStage,
    readerStage: query.readerStage,
    whySearchThis: query.whySearchThis,
    sourceSignals: query.sourceSignals,
  }));
}

function byFunnelStage(a: CandidateQuery, b: CandidateQuery): number {
  const stageOrder: Record<FunnelStage, number> = {
    tofu: 0,
    mofu: 1,
    bofu: 2,
  };

  return stageOrder[a.funnelStage] - stageOrder[b.funnelStage] || b.score - a.score;
}

export function buildSearchQueryPlan(companyProfile: CompanyProfile): SearchQueryPlan {
  const queries = buildSearchResearchQueries(companyProfile);

  return {
    generatedAt: new Date().toISOString(),
    companyName: inferCompanyName(companyProfile),
    totalQueries: queries.length,
    queries,
  };
}

function buildCandidates(companyProfile: CompanyProfile): CandidateQuery[] {
  return [
    ...companyProfile.seo.informationalKeywords.slice(0, 4).map((query, index) => candidate({
      query,
      queryType: "problem_aware",
      funnelStage: "tofu",
      readerStage: "problem-aware",
      whySearchThis: "Tests how buyers research the problem before they know they need Tavyn's full blog operations workflow.",
      sourceSignals: ["seo.informationalKeywords", "pains", "primaryICP.description"],
      score: 100 - index,
    })),
    ...companyProfile.seo.commercialKeywords.slice(0, 5).map((query, index) => candidate({
      query,
      queryType: commercialTypeFor(query),
      funnelStage: "bofu",
      readerStage: commercialTypeFor(query) === "vendor_aware" ? "vendor-aware" : "product-aware",
      whySearchThis: "Tests purchase-stage language around tools, software, and alternatives buyers may compare against Tavyn.",
      sourceSignals: ["seo.commercialKeywords", "messaging.positioning", "buyingTriggers"],
      score: 92 - index,
    })),
    ...companyProfile.seo.coreTopics.slice(0, 3).map((query, index) => candidate({
      query,
      queryType: "core_category",
      funnelStage: "tofu",
      readerStage: "problem-aware",
      whySearchThis: "Tests the core category language Tavyn may need to educate and rank around.",
      sourceSignals: ["seo.coreTopics", "companySummary", "primaryICP.name"],
      score: 88 - index,
    })),
    ...companyProfile.seo.blogAngles.slice(0, 3).map((angle, index) => candidate({
      query: simplifyBlogAngle(angle),
      queryType: "solution_aware",
      funnelStage: "mofu",
      readerStage: "solution-aware",
      whySearchThis: "Tests workflow and system language buyers use once they know they need a better content process.",
      sourceSignals: ["seo.blogAngles", "goals", "desiredOutcomes"],
      score: 84 - index,
    })),
    ...companyProfile.pains.slice(0, 4).map((pain, index) => candidate({
      query: queryFromPain(pain),
      queryType: "problem_aware",
      funnelStage: "tofu",
      readerStage: "problem-aware",
      whySearchThis: "Tests problem-language from the ICP's actual pains rather than only SEO keyword lists.",
      sourceSignals: ["pains", "primaryICP.roles", "primaryICP.description"],
      score: 80 - index,
    })),
    ...companyProfile.goals.slice(0, 4).map((goal, index) => candidate({
      query: queryFromGoal(goal),
      queryType: "solution_aware",
      funnelStage: "mofu",
      readerStage: "solution-aware",
      whySearchThis: "Tests workflow and system language buyers use once they know they need a better content process.",
      sourceSignals: ["goals", "desiredOutcomes", "messaging.valueProposition"],
      score: 94 - index,
    })),
    ...companyProfile.buyingTriggers.slice(0, 3).map((trigger, index) => candidate({
      query: queryFromBuyingTrigger(trigger),
      queryType: "vendor_aware",
      funnelStage: "bofu",
      readerStage: "vendor-aware",
      whySearchThis: "Tests purchase-trigger searches where a founder may be ready to replace an agency, freelancer, or manual workflow.",
      sourceSignals: ["buyingTriggers", "objections", "messaging.positioning"],
      score: 74 - index,
    })),
    ...comparisonCandidates(companyProfile),
    ...productWedgeCandidates(companyProfile),
  ];
}

function productWedgeCandidates(companyProfile: CompanyProfile): CandidateQuery[] {
  const words = companyProfile.messaging.wordsToUse.join(" ");
  const combined = `${companyProfile.companySummary} ${companyProfile.messaging.positioning} ${words}`;
  const candidates: CandidateQuery[] = [];

  if (/github|code-based/i.test(combined)) {
    candidates.push(candidate({
      query: "GitHub blog publishing tool",
      queryType: "product_wedge",
      funnelStage: "bofu",
      readerStage: "product-aware",
      whySearchThis: "Tests Tavyn's code-based publishing wedge against existing GitHub and static-site publishing options.",
      sourceSignals: ["companySummary", "messaging.wordsToUse", "pains"],
      score: 96,
    }));
    candidates.push(candidate({
      query: "publish blog posts to Next.js site",
      queryType: "product_wedge",
      funnelStage: "mofu",
      readerStage: "solution-aware",
      whySearchThis: "Tests whether the SERP connects SEO blog operations with direct publishing to code-based SaaS sites.",
      sourceSignals: ["companySummary", "desiredOutcomes", "seo.informationalKeywords"],
      score: 87,
    }));
  }

  if (/email-native|approval/i.test(combined)) {
    candidates.push(candidate({
      query: "email approval workflow for blog content",
      queryType: "product_wedge",
      funnelStage: "mofu",
      readerStage: "solution-aware",
      whySearchThis: "Tests whether Tavyn's email-native approval workflow has an existing search category or needs category creation.",
      sourceSignals: ["messaging.valueProposition", "messaging.positioning", "messaging.wordsToUse"],
      score: 82,
    }));
  }

  return candidates;
}

function comparisonCandidates(companyProfile: CompanyProfile): CandidateQuery[] {
  const combined = `${companyProfile.messaging.positioning} ${companyProfile.objections.join(" ")} ${companyProfile.buyingTriggers.join(" ")}`;
  const candidates: CandidateQuery[] = [
    candidate({
      query: "best AI SEO tools for SaaS",
      queryType: "comparison",
      funnelStage: "bofu",
      readerStage: "vendor-aware",
      whySearchThis: "Tests comparison SERPs where Tavyn may eventually need to be positioned against AI SEO tools.",
      sourceSignals: ["seo.commercialKeywords", "objections", "messaging.positioning"],
      score: 86,
    }),
  ];

  if (/agency|retainer|freelancer/i.test(combined)) {
    candidates.push(candidate({
      query: "SEO agency alternative for startups",
      queryType: "comparison",
      funnelStage: "bofu",
      readerStage: "vendor-aware",
      whySearchThis: "Tests Tavyn's agency-alternative positioning for founders who want execution without retainers or heavy management.",
      sourceSignals: ["messaging.positioning", "buyingTriggers", "desiredOutcomes"],
      score: 85,
    }));
  }

  return candidates;
}

function fillStage(
  candidates: CandidateQuery[],
  picked: CandidateQuery[],
  seen: Set<string>,
  funnelStage: FunnelStage,
  targetCount: number,
): void {
  while (picked.filter((query) => query.funnelStage === funnelStage).length < targetCount) {
    const beforeCount = picked.length;
    addByPredicate(candidates, picked, seen, (query) => query.funnelStage === funnelStage);
    if (picked.length === beforeCount) break;
  }
}

function addByPredicate(
  candidates: CandidateQuery[],
  picked: CandidateQuery[],
  seen: Set<string>,
  predicate: (query: CandidateQuery) => boolean,
): void {
  addCandidate(candidates.find((query) => predicate(query) && !seen.has(normalizeKey(query.query))), picked, seen);
}

function candidate(input: CandidateQuery): CandidateQuery {
  return {
    ...input,
    query: normalizeQuery(input.query),
  };
}

function addCandidate(candidateQuery: CandidateQuery | undefined, picked: CandidateQuery[], seen: Set<string>): void {
  if (!candidateQuery?.query) return;

  const key = normalizeKey(candidateQuery.query);
  if (seen.has(key)) return;

  picked.push(candidateQuery);
  seen.add(key);
}

function commercialTypeFor(query: string): SearchQueryType {
  const lower = query.toLowerCase();
  if (lower.includes("alternative")) return "comparison";
  if (lower.includes("tool") || lower.includes("software") || lower.includes("automation")) return "commercial";
  return "vendor_aware";
}

function simplifyBlogAngle(value: string): string {
  return normalizeQuery(value
    .replace(/\bcan\b/gi, "")
    .replace(/\bteams\b/gi, "teams")
    .replace(/\s+/g, " "));
}

function queryFromPain(value: string): string {
  if (/consistent|publishing/i.test(value)) return "how to publish SaaS blog posts consistently";
  if (/time|research|outline|write|revise/i.test(value)) return "how to manage a SaaS blog as a founder";
  if (/content plan|roadmap/i.test(value)) return "how to create an SEO content plan";
  if (/generic AI/i.test(value)) return "AI blog writer for SaaS";
  if (/github|code-based/i.test(value)) return "GitHub blog publishing workflow";
  return value;
}

function queryFromGoal(value: string): string {
  if (/topical authority/i.test(value)) return "topical authority for SaaS startups";
  if (/consistent schedule/i.test(value)) return "SEO content workflow for startups";
  if (/positioning|founder perspective/i.test(value)) return "founder-led content strategy";
  if (/publish.*website/i.test(value)) return "publish blog posts to Next.js site";
  if (/content plans/i.test(value)) return "SEO content planning for SaaS";
  return value;
}

function queryFromBuyingTrigger(value: string): string {
  if (/agency/i.test(value)) return "SEO agency alternative for startups";
  if (/AI writing tools/i.test(value)) return "AI blog writer for SaaS";
  if (/GitHub|code-based/i.test(value)) return "GitHub blog publishing tool";
  if (/start investing in SEO/i.test(value)) return "SEO content planning tool";
  return value;
}

function normalizeQuery(value: string): string {
  const words = value
    .replace(/[?.!]+$/g, "")
    .replace(/[“”]/g, "\"")
    .replace(/[’]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, maxQueryWords);

  while (words.length > 0 && /^(for|to|with|without|and|or|the|a|an|of)$/i.test(words[words.length - 1])) {
    words.pop();
  }

  return words.join(" ");
}

function normalizeKey(value: string): string {
  return value.toLowerCase().trim();
}

function inferCompanyName(companyProfile: CompanyProfile): string {
  if (/tavyn/i.test(companyProfile.companySummary)) return "Tavyn AI";

  const firstSentence = companyProfile.companySummary.split(".")[0] ?? "";
  const beforeIs = firstSentence.split(/\s+is\s+/i)[0]?.trim();
  if (beforeIs && beforeIs.length <= 50) return beforeIs;

  const match = companyProfile.companySummary.match(/^([A-Z][A-Za-z0-9 ]{1,40})/);
  return match?.[1]?.trim() || "Unknown Company";
}
