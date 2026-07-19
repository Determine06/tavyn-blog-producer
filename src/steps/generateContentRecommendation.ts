import { logInfo, logStep, logSuccess } from "../lib/logger.js";
import { runStructuredPromptFile } from "../llm/runStructuredPromptFile.js";
import {
  CompanyProfileSchema,
  type CompanyProfile,
} from "../types/companyProfile.schema.js";
import {
  ContentRecommendationDecisionSchema,
  ContentRecommendationSchema,
  type ContentRecommendation,
  type ContentRecommendationDecision,
} from "../types/contentRecommendation.schema.js";
import {
  QueryRecommendationsSchema,
  type QueryRecommendations,
} from "../types/queryRecommendations.schema.js";
import {
  SerpResultsSchema,
  type SerpResults,
} from "../types/serpResults.schema.js";

type SourceRecommendation =
  QueryRecommendations["territory_recommendations"][number]["recommendations"][number];
type SourceSerp = SerpResults["query_serps"][number];

export async function generateContentRecommendation(
  companyProfile: CompanyProfile,
  queryRecommendations: QueryRecommendations,
  serpResults: SerpResults,
  runId: string,
): Promise<ContentRecommendation> {
  logStep("Starting SERP-informed content recommendation generation");

  const validatedCompanyProfile = CompanyProfileSchema.parse(companyProfile);
  const validatedQueryRecommendations =
    QueryRecommendationsSchema.parse(queryRecommendations);
  const validatedSerpResults = SerpResultsSchema.parse(serpResults);

  validateWebsiteUrls(
    validatedCompanyProfile.website_url,
    validatedQueryRecommendations.website_url,
    validatedSerpResults.website_url,
  );

  const sourceRecommendations = flattenRecommendations(
    validatedQueryRecommendations,
  );
  validateRecommendationAndSerpIntegrity(
    sourceRecommendations,
    validatedSerpResults.query_serps,
  );

  const generatedAt = new Date().toISOString();
  const input = `<content_recommendation_input>
  <schema_version>1.0.0</schema_version>
  <run_id>${runId}</run_id>
  <generated_at>${generatedAt}</generated_at>

  <company_profile>
    ${JSON.stringify(validatedCompanyProfile, null, 2)}
  </company_profile>

  <query_recommendations>
    ${JSON.stringify(validatedQueryRecommendations, null, 2)}
  </query_recommendations>

  <serp_results>
    ${JSON.stringify(validatedSerpResults, null, 2)}
  </serp_results>
</content_recommendation_input>`;

  logInfo(`Selected recommendations received: ${sourceRecommendations.length}`);
  logInfo(`SERP records received: ${validatedSerpResults.query_serps.length}`);

  const decision =
    await runStructuredPromptFile<ContentRecommendationDecision>({
      promptFileName: "generate-content-recommendation.md",
      runtimeInput: input,
      schema: ContentRecommendationDecisionSchema,
      fallbackSchemaName: "ContentRecommendationDecisionSchema",
    });

  validateDecisionIntegrity(
    decision,
    sourceRecommendations,
    validatedSerpResults.query_serps,
  );

  const contentRecommendations = decision.analyses.map((analysis, index) => {
    const sourceRecommendation = sourceRecommendations[index];

    if (sourceRecommendation === undefined) {
      throw new Error(
        `Cannot generate content recommendation because analysis ${index} has no matching source recommendation.`,
      );
    }

    return {
      recommendation_id: sourceRecommendation.recommendation_id,
      recommendation_rank: sourceRecommendation.recommendation_rank,
      query_id: sourceRecommendation.query_id,
      territory: sourceRecommendation.territory,
      primary_query: sourceRecommendation.query,
      serp_analysis: analysis.serp_analysis,
      editorial_recommendation: analysis.editorial_recommendation,
    };
  });
  const warnings = uniqueOrdered([
    ...validatedQueryRecommendations.warnings,
    ...validatedSerpResults.warnings,
    ...contentRecommendations.flatMap((recommendation) =>
      recommendation.editorial_recommendation.warnings.map(
        (warning) => `${recommendation.query_id}: ${warning}`,
      ),
    ),
  ]);

  const contentRecommendation = ContentRecommendationSchema.parse({
    schema_version: "1.0.0",
    run_id: runId,
    generated_at: generatedAt,
    source_artifacts: [
      "company-profile.json",
      "query-recommendations.json",
      "serp-results.json",
    ],
    status: "complete",
    warnings,
    website_url: validatedCompanyProfile.website_url,
    source_profile: {
      company_name:
        validatedCompanyProfile.company_identity.company_name.value,
      product_category:
        validatedCompanyProfile.company_identity.product_category.value,
      primary_icp:
        validatedCompanyProfile.icp_and_audience.primary_icp.value,
    },
    content_recommendations: contentRecommendations,
    summary: buildSummary(contentRecommendations),
  });

  logInfo(
    `Analyses generated: ${contentRecommendation.summary.recommendations_analyzed}`,
  );
  logInfo(
    `Problem-demand recommendation count: ${contentRecommendation.summary.problem_demand_count}`,
  );
  logInfo(
    `Solution-demand recommendation count: ${contentRecommendation.summary.solution_demand_count}`,
  );
  logInfo(
    `High-confidence count: ${contentRecommendation.summary.high_confidence_count}`,
  );
  logInfo(
    `Medium-confidence count: ${contentRecommendation.summary.medium_confidence_count}`,
  );
  logInfo(
    `Low-confidence count: ${contentRecommendation.summary.low_confidence_count}`,
  );
  logInfo(
    `Mixed-intent count: ${contentRecommendation.summary.mixed_intent_count}`,
  );
  logInfo(
    `Insufficient-SERP count: ${contentRecommendation.summary.insufficient_serp_count}`,
  );

  for (const recommendation of contentRecommendation.content_recommendations) {
    logInfo(
      `Recommended title for ${recommendation.query_id}: ${recommendation.editorial_recommendation.recommended_title}`,
    );
  }

  logSuccess("SERP-informed content recommendation generation completed");

  return contentRecommendation;
}

function validateWebsiteUrls(
  companyProfileWebsiteUrl: string,
  queryRecommendationsWebsiteUrl: string,
  serpResultsWebsiteUrl: string,
): void {
  if (
    companyProfileWebsiteUrl !== queryRecommendationsWebsiteUrl ||
    companyProfileWebsiteUrl !== serpResultsWebsiteUrl
  ) {
    throw new Error(
      `Cannot generate content recommendation because website_url values differ: company-profile=${companyProfileWebsiteUrl}, query-recommendations=${queryRecommendationsWebsiteUrl}, serp-results=${serpResultsWebsiteUrl}.`,
    );
  }
}

function flattenRecommendations(
  queryRecommendations: QueryRecommendations,
): SourceRecommendation[] {
  return queryRecommendations.territory_recommendations.flatMap(
    (territoryRecommendation) => territoryRecommendation.recommendations,
  );
}

function validateRecommendationAndSerpIntegrity(
  recommendations: SourceRecommendation[],
  querySerps: SourceSerp[],
): void {
  ensureUniqueRecommendationAndQueryIds(
    recommendations,
    "query recommendations",
  );
  ensureUniqueRecommendationAndQueryIds(querySerps, "SERP results");

  const serpsByRecommendationId = buildUniqueSerpsByRecommendationId(querySerps);
  const recommendationsByRecommendationId =
    buildUniqueRecommendationsByRecommendationId(recommendations);

  for (const recommendation of recommendations) {
    const querySerp = serpsByRecommendationId.get(
      recommendation.recommendation_id,
    );

    if (querySerp === undefined) {
      throw new Error(
        `Cannot generate content recommendation because recommendation ${recommendation.recommendation_id} has no matching SERP result.`,
      );
    }

    validateMatchedIdentity(recommendation, querySerp);
  }

  for (const querySerp of querySerps) {
    if (
      !recommendationsByRecommendationId.has(querySerp.recommendation_id)
    ) {
      throw new Error(
        `Cannot generate content recommendation because SERP result ${querySerp.recommendation_id} has no matching query recommendation.`,
      );
    }
  }
}

function validateDecisionIntegrity(
  decision: ContentRecommendationDecision,
  recommendations: SourceRecommendation[],
  querySerps: SourceSerp[],
): void {
  if (decision.analyses.length !== recommendations.length) {
    throw new Error(
      `Cannot generate content recommendation because the LLM returned ${decision.analyses.length} analyses for ${recommendations.length} selected recommendations.`,
    );
  }

  if (decision.analyses.length !== querySerps.length) {
    throw new Error(
      `Cannot generate content recommendation because the LLM returned ${decision.analyses.length} analyses for ${querySerps.length} SERP records.`,
    );
  }

  for (const [index, analysis] of decision.analyses.entries()) {
    const recommendation = recommendations[index];

    if (recommendation === undefined) {
      throw new Error(
        `Cannot generate content recommendation because analysis ${index} has no matching source recommendation.`,
      );
    }

    if (analysis.recommendation_id !== recommendation.recommendation_id) {
      throw new Error(
        `Cannot generate content recommendation because analysis ${index} recommendation_id differs: ${analysis.recommendation_id} !== ${recommendation.recommendation_id}.`,
      );
    }

    if (analysis.query_id !== recommendation.query_id) {
      throw new Error(
        `Cannot generate content recommendation because analysis ${index} query_id differs: ${analysis.query_id} !== ${recommendation.query_id}.`,
      );
    }

    if (analysis.territory !== recommendation.territory) {
      throw new Error(
        `Cannot generate content recommendation because analysis ${index} territory differs: ${analysis.territory} !== ${recommendation.territory}.`,
      );
    }

    if (analysis.query !== recommendation.query) {
      throw new Error(
        `Cannot generate content recommendation because analysis ${index} query differs: ${analysis.query} !== ${recommendation.query}.`,
      );
    }
  }
}

function validateMatchedIdentity(
  recommendation: SourceRecommendation,
  querySerp: SourceSerp,
): void {
  if (querySerp.query_id !== recommendation.query_id) {
    throw new Error(
      `Cannot generate content recommendation because ${recommendation.recommendation_id} query_id differs between recommendation and SERP result: ${recommendation.query_id} !== ${querySerp.query_id}.`,
    );
  }

  if (querySerp.territory !== recommendation.territory) {
    throw new Error(
      `Cannot generate content recommendation because ${recommendation.recommendation_id} territory differs between recommendation and SERP result: ${recommendation.territory} !== ${querySerp.territory}.`,
    );
  }

  if (querySerp.query !== recommendation.query) {
    throw new Error(
      `Cannot generate content recommendation because ${recommendation.recommendation_id} query differs between recommendation and SERP result: ${recommendation.query} !== ${querySerp.query}.`,
    );
  }
}

function ensureUniqueRecommendationAndQueryIds(
  records: Array<{ recommendation_id: string; query_id: string }>,
  sourceName: string,
): void {
  const recommendationIds = new Set<string>();
  const queryIds = new Set<string>();

  for (const record of records) {
    if (recommendationIds.has(record.recommendation_id)) {
      throw new Error(
        `Cannot generate content recommendation because ${sourceName} contain duplicate recommendation_id ${record.recommendation_id}.`,
      );
    }

    recommendationIds.add(record.recommendation_id);

    if (queryIds.has(record.query_id)) {
      throw new Error(
        `Cannot generate content recommendation because ${sourceName} contain duplicate query_id ${record.query_id}.`,
      );
    }

    queryIds.add(record.query_id);
  }
}

function buildUniqueSerpsByRecommendationId(
  querySerps: SourceSerp[],
): Map<string, SourceSerp> {
  const serpsByRecommendationId = new Map<string, SourceSerp>();

  for (const querySerp of querySerps) {
    if (serpsByRecommendationId.has(querySerp.recommendation_id)) {
      throw new Error(
        `Cannot generate content recommendation because SERP results contain duplicate recommendation_id ${querySerp.recommendation_id}.`,
      );
    }

    serpsByRecommendationId.set(querySerp.recommendation_id, querySerp);
  }

  return serpsByRecommendationId;
}

function buildUniqueRecommendationsByRecommendationId(
  recommendations: SourceRecommendation[],
): Map<string, SourceRecommendation> {
  const recommendationsByRecommendationId = new Map<
    string,
    SourceRecommendation
  >();

  for (const recommendation of recommendations) {
    if (
      recommendationsByRecommendationId.has(recommendation.recommendation_id)
    ) {
      throw new Error(
        `Cannot generate content recommendation because query recommendations contain duplicate recommendation_id ${recommendation.recommendation_id}.`,
      );
    }

    recommendationsByRecommendationId.set(
      recommendation.recommendation_id,
      recommendation,
    );
  }

  return recommendationsByRecommendationId;
}

function buildSummary(
  recommendations: ContentRecommendation["content_recommendations"],
): ContentRecommendation["summary"] {
  return {
    recommendations_received: recommendations.length,
    recommendations_analyzed: recommendations.length,
    problem_demand_count: recommendations.filter(
      (recommendation) => recommendation.territory === "problem_demand",
    ).length,
    solution_demand_count: recommendations.filter(
      (recommendation) => recommendation.territory === "solution_demand",
    ).length,
    high_confidence_count: recommendations.filter(
      (recommendation) =>
        recommendation.editorial_recommendation.confidence === "high",
    ).length,
    medium_confidence_count: recommendations.filter(
      (recommendation) =>
        recommendation.editorial_recommendation.confidence === "medium",
    ).length,
    low_confidence_count: recommendations.filter(
      (recommendation) =>
        recommendation.editorial_recommendation.confidence === "low",
    ).length,
    mixed_intent_count: recommendations.filter(
      (recommendation) =>
        recommendation.serp_analysis.dominant_intent === "mixed",
    ).length,
    insufficient_serp_count: recommendations.filter(
      (recommendation) =>
        recommendation.serp_analysis.serp_consistency === "insufficient",
    ).length,
  };
}

function uniqueOrdered(values: string[]): string[] {
  const seen = new Set<string>();
  const uniqueValues: string[] = [];

  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      uniqueValues.push(value);
    }
  }

  return uniqueValues;
}
