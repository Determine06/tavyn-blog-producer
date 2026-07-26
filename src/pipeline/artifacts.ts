import { readFile } from "node:fs/promises";

import type { PipelineStageId } from "./stages.js";
import { getStagesThrough } from "./stages.js";

export type RunContextLike = {
  websiteUrl: string;
  targetDomain: string;
  locationCode: number;
  languageCode: string;
  country: string;
  device: "desktop";
};

export type PipelineArtifactPaths = {
  safeHostname: string;
  crawlContext: string;
  companyProfile: string;
  seedKeywords: string;
  keywordMetrics: string;
  queryValidation: string;
  confirmedQueries: string;
  queryOpportunities: string;
  queryRecommendations: string;
  serpResults: string;
  contentRecommendation: string;
  competitorLandscape: string;
  companyReport: string | null;
};

export function createSafeHostname(websiteUrl: string): string {
  return new URL(websiteUrl).hostname
    .replace(/^www\./, "")
    .replace(/[^a-zA-Z0-9-]/g, "-")
    .toLowerCase();
}

export function slugify(value: string): string {
  const slug = value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (slug.length === 0) {
    throw new Error(`Cannot slugify empty value from "${value}".`);
  }

  return slug;
}

export function createStaticArtifactPaths(
  websiteUrl: string,
  artifactRoot = "artifacts",
): Omit<PipelineArtifactPaths, "companyReport"> {
  const safeHostname = createSafeHostname(websiteUrl);
  const companyArtifactRoot = `${artifactRoot}/${safeHostname}`;

  return {
    safeHostname,
    crawlContext: `${companyArtifactRoot}/crawl-context.json`,
    companyProfile: `${companyArtifactRoot}/company-profile.json`,
    seedKeywords: `${companyArtifactRoot}/seed-keywords.json`,
    keywordMetrics: `${companyArtifactRoot}/keyword_metrics.json`,
    queryValidation: `${companyArtifactRoot}/query-validations.json`,
    confirmedQueries: `${companyArtifactRoot}/confirmed-queries.json`,
    queryOpportunities: `${companyArtifactRoot}/query-opportunities.json`,
    queryRecommendations: `${companyArtifactRoot}/query-recommendations.json`,
    serpResults: `${companyArtifactRoot}/serp-results.json`,
    contentRecommendation: `${companyArtifactRoot}/content-recommendation.json`,
    competitorLandscape: `${companyArtifactRoot}/competitor-landscape.json`,
  };
}

export function createPipelineArtifactPaths(
  websiteUrl: string,
  companyName: string | null,
  artifactRoot = "artifacts",
): PipelineArtifactPaths {
  const staticPaths = createStaticArtifactPaths(websiteUrl, artifactRoot);

  return {
    ...staticPaths,
    companyReport:
      companyName === null
        ? null
        : `${artifactRoot}/${staticPaths.safeHostname}/${slugify(companyName)}-report.json`,
  };
}

export async function resolveArtifactPathsForStop(
  websiteUrl: string,
  stopAfter: PipelineStageId,
  artifactRoot = "artifacts",
): Promise<string[]> {
  const staticPaths = createStaticArtifactPaths(websiteUrl, artifactRoot);
  const stages = getStagesThrough(stopAfter);
  const paths: string[] = [];

  for (const stage of stages) {
    if (stage === "company-report") {
      paths.push(await resolveCompanyReportPath(websiteUrl, artifactRoot));
    } else {
      paths.push(getStaticArtifactPath(staticPaths, stage));
    }
  }

  return paths;
}

export function getStaticArtifactPath(
  paths: Omit<PipelineArtifactPaths, "companyReport">,
  stage: Exclude<PipelineStageId, "company-report">,
): string {
  switch (stage) {
    case "crawl-context":
      return paths.crawlContext;
    case "company-profile":
      return paths.companyProfile;
    case "seed-keywords":
      return paths.seedKeywords;
    case "keyword-metrics":
      return paths.keywordMetrics;
    case "query-validation":
      return paths.queryValidation;
    case "confirmed-queries":
      return paths.confirmedQueries;
    case "query-opportunities":
      return paths.queryOpportunities;
    case "query-recommendations":
      return paths.queryRecommendations;
    case "serp-results":
      return paths.serpResults;
    case "content-recommendation":
      return paths.contentRecommendation;
    case "competitor-landscape":
      return paths.competitorLandscape;
  }
}

async function resolveCompanyReportPath(
  websiteUrl: string,
  artifactRoot = "artifacts",
): Promise<string> {
  const staticPaths = createStaticArtifactPaths(websiteUrl, artifactRoot);
  const companyProfile = JSON.parse(
    await readFile(staticPaths.companyProfile, "utf8"),
  ) as {
    company_identity?: {
      company_name?: {
        value?: unknown;
      };
    };
  };
  const companyName = companyProfile.company_identity?.company_name?.value;

  if (typeof companyName !== "string" || companyName.length === 0) {
    throw new Error(
      `Cannot resolve company-report artifact path because ${staticPaths.companyProfile} has no company name.`,
    );
  }

  return `${artifactRoot}/${staticPaths.safeHostname}/${slugify(companyName)}-report.json`;
}
