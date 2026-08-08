import { logInfo, logStep, logSuccess } from "../lib/logger.js";
import { runStructuredPromptFile } from "../llm/runStructuredPromptFile.js";
import {
  CompanyProfileSchema,
  type CompanyProfile,
} from "../types/companyProfile.schema.js";
import {
  QueryOpportunitiesSchema,
  type QueryOpportunities,
} from "../types/queryOpportunities.schema.js";
import {
  QueryRecommendationDecisionSchema,
  QueryRecommendationsSchema,
  type QueryRecommendationDecision,
  type QueryRecommendations,
} from "../types/queryRecommendations.schema.js";

type Territory = "problem_demand" | "solution_demand";
type OpportunityQuery =
  QueryOpportunities["territory_rankings"][number]["queries"][number];

const PROBLEM_DEMAND_TARGET = 1;
const SOLUTION_DEMAND_TARGET = 2;
const TOTAL_RECOMMENDATION_TARGET =
  PROBLEM_DEMAND_TARGET + SOLUTION_DEMAND_TARGET;

export async function generateQueryRecommendations(
  companyProfile: CompanyProfile,
  queryOpportunities: QueryOpportunities,
  runId: string,
): Promise<QueryRecommendations> {
  logStep("Starting query recommendation selection");

  const validatedCompanyProfile = CompanyProfileSchema.parse(companyProfile);
  const validatedQueryOpportunities =
    QueryOpportunitiesSchema.parse(queryOpportunities);

  if (
    validatedCompanyProfile.website_url !==
    validatedQueryOpportunities.website_url
  ) {
    throw new Error(
      `Cannot generate query recommendations because website_url values differ: ${validatedCompanyProfile.website_url} !== ${validatedQueryOpportunities.website_url}.`,
    );
  }

  const generatedAt = new Date().toISOString();
  validateCandidateAvailability(validatedQueryOpportunities);
  const input = `<query_recommendation_input>
  <schema_version>1.2.0</schema_version>
  <run_id>${runId}</run_id>
  <generated_at>${generatedAt}</generated_at>

  <company_profile>
    ${JSON.stringify(validatedCompanyProfile, null, 2)}
  </company_profile>

  <query_opportunities>
    ${JSON.stringify(validatedQueryOpportunities, null, 2)}
  </query_opportunities>
</query_recommendation_input>`;

  const decision =
    await runStructuredPromptFile<QueryRecommendationDecision>({
      promptFileName: "generate-query-recommendations.md",
      runtimeInput: input,
      schema: QueryRecommendationDecisionSchema,
      fallbackSchemaName: "QueryRecommendationDecisionSchema",
    });

  validateDecisionIntegrity(decision, validatedQueryOpportunities);

  const opportunitiesById = buildOpportunitiesById(
    validatedQueryOpportunities,
  );
  const territoryRecommendations = decision.territory_decisions.map(
    (territoryDecision) => {
      const recommendations = territoryDecision.selected_queries.map(
        (selectedQuery, index) => {
          const opportunityQuery = opportunitiesById.get(
            selectedQuery.query_id,
          );

          if (opportunityQuery === undefined) {
            throw new Error(
              `Cannot generate query recommendations because selected query ${selectedQuery.query_id} was not supplied as an opportunity.`,
            );
          }

          return {
            recommendation_id: `${territoryDecision.territory}_recommendation_${String(index + 1).padStart(2, "0")}`,
            recommendation_rank: index + 1,
            query_id: selectedQuery.query_id,
            territory: selectedQuery.territory,
            query: selectedQuery.query,
            selection_reasoning: selectedQuery.selection_reasoning,
            content_angle: selectedQuery.content_angle,
            product_connection: selectedQuery.product_connection,
            confidence: selectedQuery.confidence,
            opportunity_rank: opportunityQuery.rank,
            validation_reasoning: opportunityQuery.validation_reasoning,
            source_seed_keywords: opportunityQuery.source_seed_keywords,
            discovery_rank: opportunityQuery.discovery_rank,
            core_keyword: opportunityQuery.core_keyword,
            detected_language: opportunityQuery.detected_language,
            metrics: opportunityQuery.metrics,
            opportunity_metrics: opportunityQuery.opportunity_metrics,
          };
        },
      );
      const candidatesAvailable =
        validatedQueryOpportunities.territory_rankings.find(
          (ranking) => ranking.territory === territoryDecision.territory,
        )?.queries.length ?? 0;

      return {
        territory: territoryDecision.territory,
        candidates_available: candidatesAvailable,
        target_recommendations:
          territoryDecision.territory === "problem_demand"
            ? PROBLEM_DEMAND_TARGET
            : SOLUTION_DEMAND_TARGET,
        recommendations_selected: recommendations.length,
        assessment: territoryDecision.assessment,
        recommendations,
      };
    },
  );
  const problemRecommendations = territoryRecommendations[0];
  const solutionRecommendations = territoryRecommendations[1];
  const totalRecommendationsSelected =
    (problemRecommendations?.recommendations.length ?? 0) +
    (solutionRecommendations?.recommendations.length ?? 0);
  const warnings = uniqueOrdered([
    ...validatedQueryOpportunities.warnings,
  ]);
  const queryRecommendations = QueryRecommendationsSchema.parse({
    schema_version: "1.2.0",
    run_id: runId,
    generated_at: generatedAt,
    source_artifacts: [
      "company-profile.json",
      "query-opportunities.json",
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
    selection_policy: {
      problem_demand_target: PROBLEM_DEMAND_TARGET,
      solution_demand_target: SOLUTION_DEMAND_TARGET,
      total_target: TOTAL_RECOMMENDATION_TARGET,
      require_exact_total: true,
      prefer_product_specific_solution: true,
      product_specific_fallback: "best_distinct_solution_demand",
    },
    territory_recommendations: territoryRecommendations,
    summary: {
      total_candidates_considered:
        (problemRecommendations?.candidates_available ?? 0) +
        (solutionRecommendations?.candidates_available ?? 0),
      problem_candidates_considered:
        problemRecommendations?.candidates_available ?? 0,
      solution_candidates_considered:
        solutionRecommendations?.candidates_available ?? 0,
      target_recommendations: TOTAL_RECOMMENDATION_TARGET,
      problem_recommendations_selected:
        problemRecommendations?.recommendations.length ?? 0,
      solution_recommendations_selected:
        solutionRecommendations?.recommendations.length ?? 0,
      total_recommendations_selected: totalRecommendationsSelected,
      target_fulfilled: true,
    },
  });

  logSuccess("Query recommendation selection completed");
  logInfo(
    `Problem candidates supplied: ${queryRecommendations.summary.problem_candidates_considered}`,
  );
  logInfo(
    `Solution candidates supplied: ${queryRecommendations.summary.solution_candidates_considered}`,
  );
  logInfo(
    `Problem recommendations selected: ${queryRecommendations.summary.problem_recommendations_selected}`,
  );
  logInfo(
    `Solution recommendations selected: ${queryRecommendations.summary.solution_recommendations_selected}`,
  );
  logInfo(
    `Selected query IDs: ${queryRecommendations.territory_recommendations
      .flatMap((territory) =>
        territory.recommendations.map(
          (recommendation) => recommendation.query_id,
        ),
      )
      .join(", ")}`,
  );
  logInfo(
    `Total recommendations selected: ${queryRecommendations.summary.total_recommendations_selected}`,
  );
  logInfo(`Target fulfilled: ${queryRecommendations.summary.target_fulfilled}`);

  return queryRecommendations;
}

function validateDecisionIntegrity(
  decision: QueryRecommendationDecision,
  queryOpportunities: QueryOpportunities,
): void {
  const opportunitiesById = buildOpportunitiesById(queryOpportunities);
  const candidatesByTerritory = buildCandidatesByTerritory(queryOpportunities);
  const selectedIds = new Set<string>();
  let totalSelected = 0;

  for (const territoryDecision of decision.territory_decisions) {
    const candidatesAvailable =
      candidatesByTerritory.get(territoryDecision.territory) ?? 0;
    const requiredSelections =
      territoryDecision.territory === "problem_demand"
        ? PROBLEM_DEMAND_TARGET
        : SOLUTION_DEMAND_TARGET;

    if (territoryDecision.selected_queries.length !== requiredSelections) {
      throw new Error(
        `${territoryDecision.territory} selected ${territoryDecision.selected_queries.length} queries; required exactly ${requiredSelections}.`,
      );
    }

    if (candidatesAvailable < requiredSelections) {
      throw new Error(
        `${territoryDecision.territory} supplied ${candidatesAvailable} candidates; required at least ${requiredSelections}.`,
      );
    }

    totalSelected += territoryDecision.selected_queries.length;

    for (const selectedQuery of territoryDecision.selected_queries) {
      if (selectedIds.has(selectedQuery.query_id)) {
        throw new Error(
          `Cannot generate query recommendations because ${selectedQuery.query_id} was selected more than once.`,
        );
      }

      selectedIds.add(selectedQuery.query_id);
      const opportunityQuery = opportunitiesById.get(selectedQuery.query_id);

      if (opportunityQuery === undefined) {
        throw new Error(
          `Cannot generate query recommendations because selected query ${selectedQuery.query_id} was not supplied as an opportunity.`,
        );
      }

      if (selectedQuery.territory !== opportunityQuery.territory) {
        throw new Error(
          `Cannot generate query recommendations because ${selectedQuery.query_id} territory differs: ${selectedQuery.territory} !== ${opportunityQuery.territory}.`,
        );
      }

      if (selectedQuery.territory !== territoryDecision.territory) {
        throw new Error(
          `Cannot generate query recommendations because ${selectedQuery.query_id} does not belong to the ${territoryDecision.territory} decision.`,
        );
      }

      if (selectedQuery.query !== opportunityQuery.query) {
        throw new Error(
          `Cannot generate query recommendations because ${selectedQuery.query_id} query differs: ${selectedQuery.query} !== ${opportunityQuery.query}.`,
        );
      }
    }
  }

  if (totalSelected !== TOTAL_RECOMMENDATION_TARGET) {
    throw new Error(
      `Query recommendation selection returned ${totalSelected} recommendations; required exactly ${TOTAL_RECOMMENDATION_TARGET}.`,
    );
  }
}

function validateCandidateAvailability(
  queryOpportunities: QueryOpportunities,
): void {
  const candidatesByTerritory = buildCandidatesByTerritory(queryOpportunities);
  const problemCandidates = candidatesByTerritory.get("problem_demand") ?? 0;
  const solutionCandidates = candidatesByTerritory.get("solution_demand") ?? 0;

  if (problemCandidates < PROBLEM_DEMAND_TARGET) {
    throw new Error(
      `Cannot generate query recommendations because problem_demand supplied ${problemCandidates} candidates; required at least ${PROBLEM_DEMAND_TARGET}.`,
    );
  }

  if (solutionCandidates < SOLUTION_DEMAND_TARGET) {
    throw new Error(
      `Cannot generate query recommendations because solution_demand supplied ${solutionCandidates} candidates; required at least ${SOLUTION_DEMAND_TARGET}.`,
    );
  }
}

function buildCandidatesByTerritory(
  queryOpportunities: QueryOpportunities,
): Map<Territory, number> {
  return new Map(
    queryOpportunities.territory_rankings.map((ranking) => [
      ranking.territory,
      ranking.queries.length,
    ]),
  );
}

function buildOpportunitiesById(
  queryOpportunities: QueryOpportunities,
): Map<string, OpportunityQuery> {
  const opportunitiesById = new Map<string, OpportunityQuery>();

  for (const ranking of queryOpportunities.territory_rankings) {
    for (const query of ranking.queries) {
      if (opportunitiesById.has(query.query_id)) {
        throw new Error(
          `Cannot generate query recommendations because query opportunities contain duplicate query_id ${query.query_id}.`,
        );
      }

      opportunitiesById.set(query.query_id, query);
    }
  }

  return opportunitiesById;
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
