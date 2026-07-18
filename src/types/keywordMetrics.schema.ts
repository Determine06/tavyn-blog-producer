import { z } from "zod";

const NonEmptyStringSchema = z.string().min(1);
const TerritorySchema = z.enum(["problem_demand", "solution_demand"]);
const SearchIntentSchema = z.enum([
  "informational",
  "navigational",
  "commercial",
  "transactional",
]);
const PaidCompetitionLevelSchema = z.enum(["LOW", "MEDIUM", "HIGH"]);
const DataForSeoKeywordIdeasFiltersSchema = z.tuple([
  z.tuple([
    z.literal("keyword_info.search_volume"),
    z.literal(">"),
    z.literal(0),
  ]),
  z.literal("and"),
  z.tuple([
    z.literal("keyword_properties.is_another_language"),
    z.literal("="),
    z.literal(false),
  ]),
  z.literal("and"),
  z.tuple([
    z.literal("keyword_properties.words_count"),
    z.literal(">="),
    z.literal(2),
  ]),
  z.literal("and"),
  z.tuple([
    z.literal("serp_info.serp_item_types"),
    z.literal("has_not"),
    z.literal("local_pack"),
  ]),
  z.literal("and"),
  z.tuple([
    z.literal("keyword"),
    z.literal("not_regex"),
    z.literal(
      "(^|\\s)(near me|nearby|in my area|open now|opening hours|directions)(\\s|$)",
    ),
  ]),
  z.literal("and"),
  z.tuple([
    z.literal("search_intent_info.main_intent"),
    z.literal("<>"),
    z.literal("navigational"),
  ]),
]);
const DataForSeoKeywordIdeasOrderBySchema = z.tuple([
  z.literal("relevance,desc"),
  z.literal("keyword_info.search_volume,desc"),
]);

const MonthlySearchSchema = z
  .object({
    year: z.number().int().positive(),
    month: z.number().int().min(1).max(12),
    search_volume: z.number().int().min(0).nullable(),
  })
  .strict();

const SearchVolumeTrendSchema = z
  .object({
    monthly: z.number().nullable(),
    quarterly: z.number().nullable(),
    yearly: z.number().nullable(),
  })
  .strict();

const SearchIntentInfoSchema = z
  .object({
    main: SearchIntentSchema.nullable(),
    secondary: z.array(SearchIntentSchema),
  })
  .strict();

const AverageTop10Schema = z
  .object({
    backlinks: z.number().nullable(),
    referring_domains: z.number().nullable(),
    main_domain_rank: z.number().nullable(),
  })
  .strict();

const QueryMetricsSchema = z
  .object({
    search_volume: z.number().int().min(0).nullable(),
    monthly_searches: z.array(MonthlySearchSchema),
    search_volume_trend: SearchVolumeTrendSchema.nullable(),
    cpc: z.number().nullable(),
    paid_competition: z.number().min(0).max(1).nullable(),
    paid_competition_level: PaidCompetitionLevelSchema.nullable(),
    keyword_difficulty: z.number().int().min(0).max(100).nullable(),
    search_intent: SearchIntentInfoSchema,
    average_top_10: AverageTop10Schema.nullable(),
  })
  .strict();

const KeywordQuerySchema = z
  .object({
    query: NonEmptyStringSchema,
    discovery_rank: z.number().int().positive(),
    core_keyword: z.string().nullable(),
    detected_language: z.string().nullable(),
    metrics: QueryMetricsSchema,
  })
  .strict();

const TaskResultSchema = z
  .object({
    task_id: NonEmptyStringSchema,
    status_code: z.number().int(),
    status_message: NonEmptyStringSchema,
    cost_usd: z.number().min(0),
    total_available_results: z.number().int().min(0),
    items_received: z.number().int().min(0),
  })
  .strict();

const QuerySetSchema = z
  .object({
    territory: TerritorySchema,
    task_tag: TerritorySchema,
    seeds_used: z.array(NonEmptyStringSchema).length(6),
    task_result: TaskResultSchema,
    queries: z.array(KeywordQuerySchema),
  })
  .strict();

export const KeywordMetricsSchema = z
  .object({
    schema_version: z.literal("1.0.0"),
    run_id: NonEmptyStringSchema,
    generated_at: z.string().datetime(),
    source_artifacts: z.array(z.literal("seed-keywords.json")).length(1),
    status: z.enum(["complete", "partial"]),
    warnings: z.array(NonEmptyStringSchema),
    website_url: NonEmptyStringSchema,
    provider: z
      .object({
        name: z.literal("dataforseo"),
        endpoint: z.literal(
          "/v3/dataforseo_labs/google/keyword_ideas/live",
        ),
        http_requests_made: z.literal(2),
        tasks_submitted: z.literal(2),
        total_cost_usd: z.number().min(0),
      })
      .strict(),
    request_config: z
      .object({
        location_code: z.number().int(),
        language_code: NonEmptyStringSchema,
        limit_per_task: z.number().int().min(0),
        closely_variants: z.literal(true),
        ignore_synonyms: z.literal(false),
        include_serp_info: z.literal(true),
        include_clickstream_data: z.literal(false),
        filters: DataForSeoKeywordIdeasFiltersSchema,
        order_by: DataForSeoKeywordIdeasOrderBySchema,
        minimum_search_volume: z.number().int().min(0),
      })
      .strict(),
    query_sets: z.array(QuerySetSchema).length(2),
    summary: z
      .object({
        problem_queries_received: z.number().int().min(0),
        solution_queries_received: z.number().int().min(0),
        total_queries_received: z.number().int().min(0),
        unique_queries_received: z.number().int().min(0),
        queries_returned_in_both_sets: z.number().int().min(0),
        missing_search_volume_count: z.number().int().min(0),
        missing_keyword_difficulty_count: z.number().int().min(0),
        missing_search_intent_count: z.number().int().min(0),
        missing_average_top_10_count: z.number().int().min(0),
      })
      .strict(),
  })
  .strict()
  .superRefine((artifact, context) => {
    const [problemSet, solutionSet] = artifact.query_sets;

    if (problemSet?.territory !== "problem_demand") {
      context.addIssue({
        code: "custom",
        message: "The first query set must be problem_demand.",
        path: ["query_sets", 0, "territory"],
      });
    }

    if (solutionSet?.territory !== "solution_demand") {
      context.addIssue({
        code: "custom",
        message: "The second query set must be solution_demand.",
        path: ["query_sets", 1, "territory"],
      });
    }

    for (const [index, querySet] of artifact.query_sets.entries()) {
      if (querySet.task_tag !== querySet.territory) {
        context.addIssue({
          code: "custom",
          message: `${querySet.territory} task_tag must equal territory.`,
          path: ["query_sets", index, "task_tag"],
        });
      }

      const normalizedSeeds = querySet.seeds_used.map(normalize);

      if (new Set(normalizedSeeds).size !== normalizedSeeds.length) {
        context.addIssue({
          code: "custom",
          message: `${querySet.territory} seeds_used must be unique after trimming and lowercasing.`,
          path: ["query_sets", index, "seeds_used"],
        });
      }

      const normalizedQueries = querySet.queries.map((query) =>
        normalize(query.query),
      );

      if (new Set(normalizedQueries).size !== normalizedQueries.length) {
        context.addIssue({
          code: "custom",
          message: `${querySet.territory} queries must not contain duplicate normalized query strings.`,
          path: ["query_sets", index, "queries"],
        });
      }

      const ranks = querySet.queries.map((query) => query.discovery_rank);

      if (new Set(ranks).size !== ranks.length) {
        context.addIssue({
          code: "custom",
          message: `${querySet.territory} discovery_rank values must be unique.`,
          path: ["query_sets", index, "queries"],
        });
      }

      if (querySet.task_result.items_received !== querySet.queries.length) {
        context.addIssue({
          code: "custom",
          message: `${querySet.territory} task_result.items_received must equal query count.`,
          path: ["query_sets", index, "task_result", "items_received"],
        });
      }
    }

    const problemQueries = problemSet?.queries ?? [];
    const solutionQueries = solutionSet?.queries ?? [];
    const allQueries = [...problemQueries, ...solutionQueries];
    const problemNormalized = new Set(
      problemQueries.map((query) => normalize(query.query)),
    );
    const solutionNormalized = new Set(
      solutionQueries.map((query) => normalize(query.query)),
    );
    const allNormalized = allQueries.map((query) => normalize(query.query));
    const queriesReturnedInBothSets = [...problemNormalized].filter((query) =>
      solutionNormalized.has(query),
    ).length;
    const expectedSummary = {
      problem_queries_received: problemQueries.length,
      solution_queries_received: solutionQueries.length,
      total_queries_received: allQueries.length,
      unique_queries_received: new Set(allNormalized).size,
      queries_returned_in_both_sets: queriesReturnedInBothSets,
      missing_search_volume_count: allQueries.filter(
        (query) => query.metrics.search_volume === null,
      ).length,
      missing_keyword_difficulty_count: allQueries.filter(
        (query) => query.metrics.keyword_difficulty === null,
      ).length,
      missing_search_intent_count: allQueries.filter(
        (query) => query.metrics.search_intent.main === null,
      ).length,
      missing_average_top_10_count: allQueries.filter(
        (query) => query.metrics.average_top_10 === null,
      ).length,
    };

    for (const [key, expectedValue] of Object.entries(expectedSummary)) {
      const actualValue =
        artifact.summary[key as keyof typeof artifact.summary];

      if (actualValue !== expectedValue) {
        context.addIssue({
          code: "custom",
          message: `summary.${key} must equal ${expectedValue}; found ${actualValue}.`,
          path: ["summary", key],
        });
      }
    }
  });

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export type KeywordMetrics = z.infer<typeof KeywordMetricsSchema>;
