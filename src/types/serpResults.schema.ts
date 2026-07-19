import { z } from "zod";

const NonEmptyStringSchema = z.string().min(1);
const TerritorySchema = z.enum(["problem_demand", "solution_demand"]);

const ProviderSchema = z
  .object({
    name: z.literal("serper"),
    endpoint: z.literal("https://google.serper.dev/search"),
    search_engine: z.literal("google"),
    country_code: z.literal("us"),
    language_code: z.literal("en"),
    requested_results_per_query: z.literal(10),
    http_requests_made: z.number().int().min(0),
    total_credits_used: z.number().min(0).nullable(),
  })
  .strict();

const OrganicResultSchema = z
  .object({
    position: z.number().int().positive(),
    title: NonEmptyStringSchema,
    url: NonEmptyStringSchema,
    domain: NonEmptyStringSchema,
    snippet: z.string().nullable(),
    date: z.string().nullable(),
  })
  .strict();

const QuerySerpSchema = z
  .object({
    recommendation_id: NonEmptyStringSchema,
    query_id: NonEmptyStringSchema,
    territory: TerritorySchema,
    query: NonEmptyStringSchema,
    requested_at: z.string().datetime(),
    provider_credits_used: z.number().min(0).nullable(),
    organic_results_received: z.number().int().min(0).max(10),
    organic_results: z.array(OrganicResultSchema).max(10),
  })
  .strict();

const SummarySchema = z
  .object({
    recommended_queries_received: z.number().int().min(0),
    serp_requests_completed: z.number().int().min(0),
    total_organic_results: z.number().int().min(0),
    queries_with_fewer_than_ten_results: z.array(NonEmptyStringSchema),
  })
  .strict();

export const SerpResultsSchema = z
  .object({
    schema_version: z.literal("1.0.0"),
    run_id: NonEmptyStringSchema,
    generated_at: z.string().datetime(),
    source_artifacts: z.array(z.literal("query-recommendations.json")).length(1),
    status: z.literal("complete"),
    warnings: z.array(NonEmptyStringSchema),
    website_url: NonEmptyStringSchema,
    provider: ProviderSchema,
    query_serps: z.array(QuerySerpSchema).max(4),
    summary: SummarySchema,
  })
  .strict()
  .superRefine((artifact, context) => {
    if (artifact.source_artifacts[0] !== "query-recommendations.json") {
      context.addIssue({
        code: "custom",
        message:
          "source_artifacts must be exactly [\"query-recommendations.json\"].",
        path: ["source_artifacts"],
      });
    }

    const seenRecommendationIds = new Set<string>();
    const seenQueryIds = new Set<string>();
    const fewerThanTenQueryIds: string[] = [];
    let totalOrganicResults = 0;
    let allCreditsReported = true;
    let totalCredits = 0;

    for (const [queryIndex, querySerp] of artifact.query_serps.entries()) {
      if (seenRecommendationIds.has(querySerp.recommendation_id)) {
        context.addIssue({
          code: "custom",
          message: `recommendation_id must be globally unique; found duplicate ${querySerp.recommendation_id}.`,
          path: ["query_serps", queryIndex, "recommendation_id"],
        });
      }

      seenRecommendationIds.add(querySerp.recommendation_id);

      if (seenQueryIds.has(querySerp.query_id)) {
        context.addIssue({
          code: "custom",
          message: `query_id must be globally unique; found duplicate ${querySerp.query_id}.`,
          path: ["query_serps", queryIndex, "query_id"],
        });
      }

      seenQueryIds.add(querySerp.query_id);

      if (querySerp.organic_results_received !== querySerp.organic_results.length) {
        context.addIssue({
          code: "custom",
          message:
            "organic_results_received must equal organic_results.length.",
          path: ["query_serps", queryIndex, "organic_results_received"],
        });
      }

      const seenPositions = new Set<number>();
      let previousPosition = 0;

      for (const [
        resultIndex,
        organicResult,
      ] of querySerp.organic_results.entries()) {
        if (seenPositions.has(organicResult.position)) {
          context.addIssue({
            code: "custom",
            message: `Organic result positions must be unique; found duplicate ${organicResult.position}.`,
            path: [
              "query_serps",
              queryIndex,
              "organic_results",
              resultIndex,
              "position",
            ],
          });
        }

        seenPositions.add(organicResult.position);

        if (organicResult.position <= previousPosition) {
          context.addIssue({
            code: "custom",
            message:
              "Organic results must be stored in ascending position order.",
            path: [
              "query_serps",
              queryIndex,
              "organic_results",
              resultIndex,
              "position",
            ],
          });
        }

        previousPosition = organicResult.position;
      }

      if (querySerp.organic_results.length < 10) {
        fewerThanTenQueryIds.push(querySerp.query_id);
      }

      totalOrganicResults += querySerp.organic_results.length;

      if (querySerp.provider_credits_used === null) {
        allCreditsReported = false;
      } else {
        totalCredits += querySerp.provider_credits_used;
      }
    }

    if (artifact.provider.http_requests_made !== artifact.query_serps.length) {
      context.addIssue({
        code: "custom",
        message: "provider.http_requests_made must equal query_serps.length.",
        path: ["provider", "http_requests_made"],
      });
    }

    if (
      artifact.summary.recommended_queries_received !==
      artifact.query_serps.length
    ) {
      context.addIssue({
        code: "custom",
        message:
          "summary.recommended_queries_received must equal query_serps.length.",
        path: ["summary", "recommended_queries_received"],
      });
    }

    if (artifact.summary.serp_requests_completed !== artifact.query_serps.length) {
      context.addIssue({
        code: "custom",
        message:
          "summary.serp_requests_completed must equal query_serps.length.",
        path: ["summary", "serp_requests_completed"],
      });
    }

    if (artifact.summary.total_organic_results !== totalOrganicResults) {
      context.addIssue({
        code: "custom",
        message:
          "summary.total_organic_results must equal the sum of all organic result lengths.",
        path: ["summary", "total_organic_results"],
      });
    }

    if (
      artifact.summary.queries_with_fewer_than_ten_results.length !==
        fewerThanTenQueryIds.length ||
      artifact.summary.queries_with_fewer_than_ten_results.some(
        (queryId, index) => queryId !== fewerThanTenQueryIds[index],
      )
    ) {
      context.addIssue({
        code: "custom",
        message:
          "summary.queries_with_fewer_than_ten_results must contain exactly the query IDs with fewer than ten organic results, in query_serps order.",
        path: ["summary", "queries_with_fewer_than_ten_results"],
      });
    }

    if (allCreditsReported) {
      if (artifact.provider.total_credits_used !== totalCredits) {
        context.addIssue({
          code: "custom",
          message:
            "provider.total_credits_used must equal the sum of provider_credits_used values.",
          path: ["provider", "total_credits_used"],
        });
      }
    } else if (artifact.provider.total_credits_used !== null) {
      context.addIssue({
        code: "custom",
        message:
          "provider.total_credits_used must be null when any query credits are null.",
        path: ["provider", "total_credits_used"],
      });
    }
  });

export type SerpResults = z.infer<typeof SerpResultsSchema>;
