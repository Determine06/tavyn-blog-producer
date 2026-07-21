import { randomUUID } from "node:crypto";

import { env } from "./config/env.js";
import { runCachedStep } from "./cache/runCachedStep.js";
import {
  logError,
  logInfo,
  logRunSummary,
  logSuccess,
} from "./lib/logger.js";

type CliOptions = {
  websiteUrl: string;
  forceCrawl: boolean;
  forceProfile: boolean;
  forceSeedKeywords: boolean;
  forceQueryCandidates: boolean;
  forceSerp: boolean;
  forceQueryMetrics: boolean;
  forceQueryValidation: boolean;
  forceQueryOpportunities: boolean;
  forceQueryRecommendations: boolean;
  forceContentRecommendation: boolean;
  forceCompetitorLandscape: boolean;
  forceCompanyReport: boolean;
};

type RunContext = {
  runId: string;
  websiteUrl: string;
  targetDomain: string;
  locationCode: number;
  languageCode: string;
  country: string;
  device: "desktop";
  generatedAt: string;
};

function parseCliOptions(argv: string[]): CliOptions {
  const forceCrawl = argv.includes("--force-crawl");
  const forceProfile = argv.includes("--force-profile");
  const forceSeedKeywords = argv.includes("--force-seed-keywords");
  const forceQueryCandidates =
    argv.includes("--force-query-candidates") ||
    argv.includes("--force-clusters");
  const forceSerp = argv.includes("--force-serp");
  const forceQueryMetrics = argv.includes("--force-query-metrics");
  const forceQueryValidation = argv.includes("--force-query-validation");
  const forceQueryOpportunities = argv.includes(
    "--force-query-opportunities",
  );
  const forceQueryRecommendations = argv.includes(
    "--force-query-recommendations",
  );
  const forceContentRecommendation = argv.includes(
    "--force-content-recommendation",
  );
  const forceCompetitorLandscape = argv.includes(
    "--force-competitor-landscape",
  );
  const forceCompanyReport = argv.includes("--force-company-report");
  const urlArgs = argv.filter((arg) => !arg.startsWith("--"));

  return {
    websiteUrl: urlArgs[0] ?? "https://tavyn.dev/",
    forceCrawl,
    forceProfile,
    forceSeedKeywords,
    forceQueryCandidates,
    forceSerp,
    forceQueryMetrics,
    forceQueryValidation,
    forceQueryOpportunities,
    forceQueryRecommendations,
    forceContentRecommendation,
    forceCompetitorLandscape,
    forceCompanyReport,
  };
}

function createRunContext(websiteUrl: string): RunContext {
  const normalizedUrl = new URL(normalizeWebsiteUrlInput(websiteUrl));

  return {
    runId: randomUUID(),
    websiteUrl: normalizedUrl.toString(),
    targetDomain: normalizedUrl.hostname.replace(/^www\./, ""),
    locationCode: 2840,
    languageCode: "en",
    country: "United States",
    device: "desktop",
    generatedAt: new Date().toISOString(),
  };
}

function normalizeWebsiteUrlInput(websiteUrl: string): string {
  const trimmedWebsiteUrl = websiteUrl.trim();

  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmedWebsiteUrl)) {
    return trimmedWebsiteUrl;
  }

  return `https://${trimmedWebsiteUrl}`;
}

function createSafeHostname(websiteUrl: string): string {
  return new URL(websiteUrl).hostname
    .replace(/^www\./, "")
    .replace(/[^a-zA-Z0-9-]/g, "-")
    .toLowerCase();
}

function slugify(value: string): string {
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

async function main(): Promise<void> {
  try {
    const {
      websiteUrl,
      forceCrawl,
      forceProfile,
      forceSeedKeywords,
      forceQueryCandidates,
      forceSerp,
      forceQueryMetrics,
      forceQueryValidation,
      forceQueryOpportunities,
      forceQueryRecommendations,
      forceContentRecommendation,
      forceCompetitorLandscape,
      forceCompanyReport,
    } = parseCliOptions(process.argv.slice(2));
    const runContext = createRunContext(websiteUrl);
    const safeHostname = createSafeHostname(runContext.websiteUrl);
    const crawlArtifactPath = `artifacts/${safeHostname}/crawl-context.json`;
    const companyProfileArtifactPath = `artifacts/${safeHostname}/company-profile.json`;
    const seedKeywordsArtifactPath = `artifacts/${safeHostname}/seed-keywords.json`;
    const keywordMetricsArtifactPath = `artifacts/${safeHostname}/keyword_metrics.json`;
    const queryValidationArtifactPath = `artifacts/${safeHostname}/query-validations.json`;
    const confirmedQueriesArtifactPath = `artifacts/${safeHostname}/confirmed-queries.json`;
    const queryOpportunitiesArtifactPath =
      `artifacts/${safeHostname}/query-opportunities.json`;
    const queryRecommendationsArtifactPath =
      `artifacts/${safeHostname}/query-recommendations.json`;
    const serpResultsArtifactPath =
      `artifacts/${safeHostname}/serp-results.json`;
    const contentRecommendationArtifactPath =
      `artifacts/${safeHostname}/content-recommendation.json`;
    const competitorLandscapeArtifactPath =
      `artifacts/${safeHostname}/competitor-landscape.json`;

    logSuccess("Environment validation passed");
    logInfo(`Firecrawl API key loaded: ${env.FIRECRAWL_API_KEY.length > 0}`);
    logInfo(`Run ID: ${runContext.runId}`);
    logInfo(`Target domain: ${runContext.targetDomain}`);
    logInfo(
      `Search market: ${runContext.country}, ${runContext.languageCode}`,
    );
    logInfo(`Device: ${runContext.device}`);
    logInfo(`Company profile website URL: ${runContext.websiteUrl}`);
    logInfo(`forceCrawl: ${forceCrawl}`);
    logInfo(`forceProfile: ${forceProfile}`);
    logInfo(`forceSeedKeywords: ${forceSeedKeywords}`);
    logInfo(`forceQueryCandidates: ${forceQueryCandidates}`);
    logInfo(`forceSerp: ${forceSerp}`);
    logInfo(`forceQueryMetrics: ${forceQueryMetrics}`);
    logInfo(`forceQueryValidation: ${forceQueryValidation}`);
    logInfo(`forceQueryOpportunities: ${forceQueryOpportunities}`);
    logInfo(`forceQueryRecommendations: ${forceQueryRecommendations}`);
    logInfo(`forceContentRecommendation: ${forceContentRecommendation}`);
    logInfo(`forceCompetitorLandscape: ${forceCompetitorLandscape}`);
    logInfo(`forceCompanyReport: ${forceCompanyReport}`);
    logInfo(`Crawl artifact path: ${crawlArtifactPath}`);
    logInfo(`Company profile artifact path: ${companyProfileArtifactPath}`);
    logInfo(`Seed keywords artifact path: ${seedKeywordsArtifactPath}`);
    logInfo(`Keyword metrics artifact path: ${keywordMetricsArtifactPath}`);
    logInfo(`Query validation artifact path: ${queryValidationArtifactPath}`);
    logInfo(`Confirmed queries artifact path: ${confirmedQueriesArtifactPath}`);
    logInfo(
      `Query opportunities artifact path: ${queryOpportunitiesArtifactPath}`,
    );
    logInfo(
      `Query recommendations artifact path: ${queryRecommendationsArtifactPath}`,
    );
    logInfo(`SERP results artifact path: ${serpResultsArtifactPath}`);
    logInfo(
      `Content recommendation artifact path: ${contentRecommendationArtifactPath}`,
    );
    logInfo(
      `Competitor landscape artifact path: ${competitorLandscapeArtifactPath}`,
    );

    const crawlResult = await runCachedStep({
      stepName: "company-profile-crawl",
      artifactPath: crawlArtifactPath,
      force: forceCrawl,
      run: async () => {
        const { generateCompanyProfileContext } = await import(
          "./steps/generateCompanyProfile.js"
        );

        return generateCompanyProfileContext(runContext.websiteUrl);
      },
    });
    const companyProfileContext = crawlResult.data;

    logInfo(`Crawl cache hit: ${crawlResult.cacheHit}`);
    logInfo(`Crawl step ran: ${crawlResult.didRun}`);
    logInfo(
      `Crawl context page count: ${companyProfileContext.pages.length}`,
    );
    logInfo(
      `Crawl context combined markdown length: ${companyProfileContext.combinedMarkdown.length}`,
    );

    const shouldForceProfile = forceProfile || crawlResult.didRun;

    if (crawlResult.didRun && !forceProfile) {
      logInfo(
        "Company profile regeneration required because the crawl artifact changed.",
      );
    }

    const companyProfileResult = await runCachedStep({
      stepName: "company-profile-generation",
      artifactPath: companyProfileArtifactPath,
      force: shouldForceProfile,
      run: async () => {
        const { generateCompanyProfileFromContext } = await import(
          "./steps/generateCompanyProfile.js"
        );

        return generateCompanyProfileFromContext(companyProfileContext);
      },
    });
    const companyProfile = companyProfileResult.data;

    logInfo(`Company profile cache hit: ${companyProfileResult.cacheHit}`);
    logInfo(`Company profile step ran: ${companyProfileResult.didRun}`);
    logInfo(
      `Overall confidence: ${companyProfile.profile_quality.overall_confidence}`,
    );

    const companySlug = slugify(
      companyProfile.company_identity.company_name.value,
    );
    const companyReportArtifactPath =
      `artifacts/${safeHostname}/${companySlug}-report.json`;

    logInfo(`Company report artifact path: ${companyReportArtifactPath}`);

    const shouldForceSeedKeywords =
      forceSeedKeywords || companyProfileResult.didRun;

    if (companyProfileResult.didRun && !forceSeedKeywords) {
      logInfo(
        "Seed keyword regeneration required because the company profile changed.",
      );
    }

    const seedKeywordsResult = await runCachedStep({
      stepName: "seed-keyword-generation",
      artifactPath: seedKeywordsArtifactPath,
      force: shouldForceSeedKeywords,
      run: async () => {
        const { generateSeedKeywords } = await import(
          "./steps/generateSeedKeywords.js"
        );

        return generateSeedKeywords(companyProfile, runContext.runId);
      },
    });
    const seedKeywords = seedKeywordsResult.data;
    const problemDemandSeedCount =
      seedKeywords.demand_territories.find(
        (territory) => territory.territory_id === "problem_demand",
      )?.seed_keywords.length ?? 0;
    const solutionDemandSeedCount =
      seedKeywords.demand_territories.find(
        (territory) => territory.territory_id === "solution_demand",
      )?.seed_keywords.length ?? 0;
    const totalSeedCount = seedKeywords.demand_territories.reduce(
      (total, territory) => total + territory.seed_keywords.length,
      0,
    );

    logInfo(`Seed keywords cache hit: ${seedKeywordsResult.cacheHit}`);
    logInfo(`Seed keyword step ran: ${seedKeywordsResult.didRun}`);
    logInfo(`Demand territory count: ${seedKeywords.demand_territories.length}`);
    logInfo(`Problem-demand seed count: ${problemDemandSeedCount}`);
    logInfo(`Solution-demand seed count: ${solutionDemandSeedCount}`);
    logInfo(`Total seed count: ${totalSeedCount}`);
    logInfo(
      `Seed generation confidence: ${seedKeywords.generation_quality.overall_confidence}`,
    );
    logSuccess("Seed keyword generation stage completed");

    const keywordMetricsResult = await runCachedStep({
      stepName: "keyword-metrics-generation",
      artifactPath: keywordMetricsArtifactPath,
      force: forceQueryMetrics,
      run: async () => {
        const { generateKeywordMetrics } = await import(
          "./steps/generateKeywordMetrics.js"
        );

        return generateKeywordMetrics(seedKeywords, runContext.runId);
      },
    });
    const keywordMetrics = keywordMetricsResult.data;

    logInfo(`Keyword metrics cache hit: ${keywordMetricsResult.cacheHit}`);
    logInfo(`Keyword metrics step ran: ${keywordMetricsResult.didRun}`);
    logInfo(
      `Problem queries received: ${keywordMetrics.summary.problem_queries_received}`,
    );
    logInfo(
      `Solution queries received: ${keywordMetrics.summary.solution_queries_received}`,
    );
    logInfo(
      `Total queries received: ${keywordMetrics.summary.total_queries_received}`,
    );
    logInfo(
      `Unique queries received: ${keywordMetrics.summary.unique_queries_received}`,
    );
    logInfo(
      `Cross-territory duplicate count: ${keywordMetrics.summary.queries_returned_in_both_sets}`,
    );
    logInfo(
      `Keyword metrics provider cost: ${keywordMetrics.provider.total_cost_usd}`,
    );
    logSuccess("Keyword metrics generation stage completed");

    const shouldForceQueryValidation =
      forceQueryValidation ||
      companyProfileResult.didRun ||
      keywordMetricsResult.didRun;

    if (keywordMetricsResult.didRun && !forceQueryValidation) {
      logInfo(
        "Query validation regeneration required because keyword metrics changed.",
      );
    }

    if (companyProfileResult.didRun && !forceQueryValidation) {
      logInfo(
        "Query validation regeneration required because the company profile changed.",
      );
    }

    const queryValidationResult = await runCachedStep({
      stepName: "query-validation",
      artifactPath: queryValidationArtifactPath,
      force: shouldForceQueryValidation,
      run: async () => {
        const { generateQueryValidation } = await import(
          "./steps/generateQueryValidation.js"
        );

        return generateQueryValidation(
          companyProfile,
          keywordMetrics,
          runContext.runId,
        );
      },
    });
    const queryValidation = queryValidationResult.data;
    const validQueryCount = queryValidation.query_validations.filter(
      (validation) => validation.verdict === "valid",
    ).length;
    const invalidQueryCount =
      queryValidation.query_validations.length - validQueryCount;

    logInfo(`Query validation cache hit: ${queryValidationResult.cacheHit}`);
    logInfo(`Query validation step ran: ${queryValidationResult.didRun}`);
    logInfo(
      `Query validation count: ${queryValidation.query_validations.length}`,
    );
    logInfo(`Valid query count: ${validQueryCount}`);
    logInfo(`Invalid query count: ${invalidQueryCount}`);
    logSuccess("Query validation stage completed");

    const confirmedQueriesResult = await runCachedStep({
      stepName: "confirmed-query-generation",
      artifactPath: confirmedQueriesArtifactPath,
      force: queryValidationResult.didRun || keywordMetricsResult.didRun,
      run: async () => {
        const { generateConfirmedQueries } = await import(
          "./steps/generateQueryValidation.js"
        );

        return generateConfirmedQueries(queryValidation, keywordMetrics);
      },
    });
    const confirmedQueries = confirmedQueriesResult.data;

    logInfo(`Confirmed queries cache hit: ${confirmedQueriesResult.cacheHit}`);
    logInfo(`Confirmed query step ran: ${confirmedQueriesResult.didRun}`);
    logInfo(
      `Total queries evaluated: ${confirmedQueries.summary.total_queries_evaluated}`,
    );
    logInfo(
      `Total queries confirmed: ${confirmedQueries.summary.total_queries_confirmed}`,
    );
    logInfo(
      `Total queries rejected: ${confirmedQueries.summary.total_queries_rejected}`,
    );
    logInfo(
      `Problem-demand confirmed: ${confirmedQueries.summary.problem_queries_confirmed}`,
    );
    logInfo(
      `Solution-demand confirmed: ${confirmedQueries.summary.solution_queries_confirmed}`,
    );
    logSuccess("Confirmed query generation stage completed");

    const shouldForceQueryOpportunities =
      forceQueryOpportunities || confirmedQueriesResult.didRun;

    const queryOpportunitiesResult = await runCachedStep({
      stepName: "query-opportunity-scoring",
      artifactPath: queryOpportunitiesArtifactPath,
      force: shouldForceQueryOpportunities,
      run: async () => {
        const { generateQueryOpportunities } = await import(
          "./steps/generateQueryOpportunities.js"
        );

        return generateQueryOpportunities(
          confirmedQueries,
          runContext.runId,
        );
      },
    });
    const queryOpportunities = queryOpportunitiesResult.data;

    logInfo(
      `Query opportunities cache hit: ${queryOpportunitiesResult.cacheHit}`,
    );
    logInfo(
      `Query opportunity step ran: ${queryOpportunitiesResult.didRun}`,
    );
    logInfo(
      `Problem-demand queries selected: ${queryOpportunities.summary.problem_queries_selected}`,
    );
    logInfo(
      `Solution-demand queries selected: ${queryOpportunities.summary.solution_queries_selected}`,
    );
    logInfo(
      `Total queries selected: ${queryOpportunities.summary.total_queries_selected}`,
    );
    logInfo(`Query opportunities artifact path: ${queryOpportunitiesArtifactPath}`);
    logSuccess("Query opportunity scoring stage completed");

    const shouldForceQueryRecommendations =
      forceQueryRecommendations ||
      companyProfileResult.didRun ||
      queryOpportunitiesResult.didRun;

    const queryRecommendationsResult = await runCachedStep({
      stepName: "query-recommendation-selection",
      artifactPath: queryRecommendationsArtifactPath,
      force: shouldForceQueryRecommendations,
      run: async () => {
        const { generateQueryRecommendations } = await import(
          "./steps/generateQueryRecommendations.js"
        );

        return generateQueryRecommendations(
          companyProfile,
          queryOpportunities,
          runContext.runId,
        );
      },
    });
    const queryRecommendations = queryRecommendationsResult.data;

    logInfo(
      `Query recommendations cache hit: ${queryRecommendationsResult.cacheHit}`,
    );
    logInfo(
      `Query recommendation step ran: ${queryRecommendationsResult.didRun}`,
    );
    logInfo(
      `Problem recommendations selected: ${queryRecommendations.summary.problem_recommendations_selected}`,
    );
    logInfo(
      `Solution recommendations selected: ${queryRecommendations.summary.solution_recommendations_selected}`,
    );
    logInfo(
      `Total recommendations selected: ${queryRecommendations.summary.total_recommendations_selected}`,
    );
    logInfo(
      `Recommendation target fulfilled: ${queryRecommendations.summary.target_fulfilled}`,
    );
    logInfo(
      `Query recommendations artifact path: ${queryRecommendationsArtifactPath}`,
    );
    logSuccess("Query recommendation selection stage completed");

    const shouldForceSerpResults =
      forceSerp || queryRecommendationsResult.didRun;

    if (queryRecommendationsResult.didRun && !forceSerp) {
      logInfo(
        "SERP result regeneration required because query recommendations changed.",
      );
    }

    const serpResultsResult = await runCachedStep({
      stepName: "serper-organic-serp-collection",
      artifactPath: serpResultsArtifactPath,
      force: shouldForceSerpResults,
      run: async () => {
        const { generateSerpResults } = await import(
          "./steps/generateSerpResults.js"
        );

        return generateSerpResults(
          queryRecommendations,
          runContext.runId,
        );
      },
    });
    const serpResults = serpResultsResult.data;

    logInfo(`SERP results cache hit: ${serpResultsResult.cacheHit}`);
    logInfo(`SERP results step ran: ${serpResultsResult.didRun}`);
    logInfo(
      `Recommended queries received: ${serpResults.summary.recommended_queries_received}`,
    );
    logInfo(
      `SERP requests completed: ${serpResults.summary.serp_requests_completed}`,
    );
    logInfo(
      `Total organic results: ${serpResults.summary.total_organic_results}`,
    );
    logInfo(
      `Queries with fewer than ten results: ${serpResults.summary.queries_with_fewer_than_ten_results.length}`,
    );

    if (serpResults.provider.total_credits_used === null) {
      logInfo("Serper credits: not reported");
    } else {
      logInfo(`Serper credits: ${serpResults.provider.total_credits_used}`);
    }

    logInfo(`SERP results artifact path: ${serpResultsArtifactPath}`);
    logSuccess("SERP result collection stage completed");

    const shouldForceContentRecommendation =
      forceContentRecommendation ||
      companyProfileResult.didRun ||
      queryRecommendationsResult.didRun ||
      serpResultsResult.didRun;

    const contentRecommendationResult = await runCachedStep({
      stepName: "serp-informed-content-recommendation",
      artifactPath: contentRecommendationArtifactPath,
      force: shouldForceContentRecommendation,
      run: async () => {
        const { generateContentRecommendation } = await import(
          "./steps/generateContentRecommendation.js"
        );

        return generateContentRecommendation(
          companyProfile,
          queryRecommendations,
          serpResults,
          runContext.runId,
        );
      },
    });
    const contentRecommendation = contentRecommendationResult.data;

    logInfo(
      `Content recommendation cache hit: ${contentRecommendationResult.cacheHit}`,
    );
    logInfo(
      `Content recommendation step ran: ${contentRecommendationResult.didRun}`,
    );
    logInfo(
      `Recommendations received: ${contentRecommendation.summary.recommendations_received}`,
    );
    logInfo(
      `Recommendations analyzed: ${contentRecommendation.summary.recommendations_analyzed}`,
    );
    logInfo(
      `Problem-demand content recommendations: ${contentRecommendation.summary.problem_demand_count}`,
    );
    logInfo(
      `Solution-demand content recommendations: ${contentRecommendation.summary.solution_demand_count}`,
    );
    logInfo(
      `High-confidence recommendations: ${contentRecommendation.summary.high_confidence_count}`,
    );
    logInfo(
      `Medium-confidence recommendations: ${contentRecommendation.summary.medium_confidence_count}`,
    );
    logInfo(
      `Low-confidence recommendations: ${contentRecommendation.summary.low_confidence_count}`,
    );
    logInfo(
      `Mixed-intent recommendations: ${contentRecommendation.summary.mixed_intent_count}`,
    );
    logInfo(
      `Insufficient-SERP recommendations: ${contentRecommendation.summary.insufficient_serp_count}`,
    );
    logInfo(
      `Content recommendation artifact path: ${contentRecommendationArtifactPath}`,
    );
    logSuccess("SERP-informed content recommendation stage completed");

    const shouldForceCompetitorLandscape =
      forceCompetitorLandscape || confirmedQueriesResult.didRun;

    const competitorLandscapeResult = await runCachedStep({
      stepName: "dataforseo-serp-competitor-landscape",
      artifactPath: competitorLandscapeArtifactPath,
      force: shouldForceCompetitorLandscape,
      run: async () => {
        const { generateCompetitorLandscape } = await import(
          "./steps/generateCompetitorLandscape.js"
        );

        return generateCompetitorLandscape(
          confirmedQueries,
          runContext.runId,
        );
      },
    });
    const competitorLandscape = competitorLandscapeResult.data;

    logInfo(
      `Competitor landscape cache hit: ${competitorLandscapeResult.cacheHit}`,
    );
    logInfo(
      `Competitor landscape step ran: ${competitorLandscapeResult.didRun}`,
    );
    logInfo(
      `Competitor landscape confirmed queries received: ${competitorLandscape.scope.confirmed_queries_received}`,
    );
    logInfo(
      `Competitor landscape unique queries submitted: ${competitorLandscape.scope.unique_queries_submitted}`,
    );
    logInfo(
      `Competitor landscape total domains found: ${competitorLandscape.summary.total_domains_found}`,
    );
    logInfo(
      `Competitors included: ${competitorLandscape.summary.competitors_included}`,
    );
    logInfo(
      `Competitor landscape provider cost: ${competitorLandscape.provider.total_cost_usd}`,
    );
    logInfo(
      `Competitor landscape artifact path: ${competitorLandscapeArtifactPath}`,
    );
    logSuccess("Competitor landscape collection stage completed");

    const shouldForceCompanyReport =
      forceCompanyReport ||
      companyProfileResult.didRun ||
      keywordMetricsResult.didRun ||
      confirmedQueriesResult.didRun ||
      queryOpportunitiesResult.didRun ||
      queryRecommendationsResult.didRun ||
      serpResultsResult.didRun ||
      contentRecommendationResult.didRun ||
      competitorLandscapeResult.didRun;

    const companyReportResult = await runCachedStep({
      stepName: "deterministic-company-report-assembly",
      artifactPath: companyReportArtifactPath,
      force: shouldForceCompanyReport,
      run: async () => {
        const { generateCompanyReport } = await import(
          "./steps/generateCompanyReport.js"
        );

        return generateCompanyReport(
          companyProfile,
          keywordMetrics,
          confirmedQueries,
          queryOpportunities,
          queryRecommendations,
          serpResults,
          contentRecommendation,
          competitorLandscape,
          runContext.runId,
        );
      },
    });
    const companyReport = companyReportResult.data;

    logInfo(`Company report cache hit: ${companyReportResult.cacheHit}`);
    logInfo(`Company report step ran: ${companyReportResult.didRun}`);
    logInfo(`Report ID: ${companyReport.report_id}`);
    logInfo(`Report slug: ${companyReport.report_slug}`);
    logInfo(
      `Company report validated query count: ${companyReport.validated_queries.summary.total}`,
    );
    logInfo(
      `Company report competitor count: ${companyReport.competitor_landscape.summary.competitors_included}`,
    );
    logInfo(
      `Company report content-plan item count: ${companyReport.content_plan.summary.selected_count}`,
    );
    logInfo(`Company report artifact path: ${companyReportArtifactPath}`);
    logSuccess("Deterministic company report assembly stage completed");
    logInfo(
      "Pipeline completed with deterministic company report assembly.",
    );
  } catch (error) {
    logError("Local pipeline run failed", error);
    process.exitCode = 1;
  } finally {
    logRunSummary();
  }
}

await main();
