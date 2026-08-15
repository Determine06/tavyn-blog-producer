import { z } from "zod";


const NonEmptyStringSchema = z.string().min(1);
const TerritorySchema = z.enum(["problem_demand", "solution_demand"]);
const DiscoveryGroupSchema = z.enum([
  "core_problem_demand",
  "adjacent_problem_demand",
  "core_solution_demand",
  "adjacent_solution_demand",
]);
type DiscoveryGroup = z.infer<typeof DiscoveryGroupSchema>;
const SEEDS_PER_DISCOVERY_GROUP = 6;
const MAX_QUERIES_PER_TERRITORY = 500;
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
    z.literal(10),
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

export const QueryMetricsSchema = z
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
    discovery_group: DiscoveryGroupSchema,
    source_seed_keywords: z
      .array(NonEmptyStringSchema)
      .length(SEEDS_PER_DISCOVERY_GROUP),
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
    queries_retained: z.number().int().min(0),
  })
  .strict();

const DiscoveryTaskSchema = z
  .object({
    discovery_group: DiscoveryGroupSchema,
    task_tag: DiscoveryGroupSchema,
    seeds_used: z
      .array(NonEmptyStringSchema)
      .length(SEEDS_PER_DISCOVERY_GROUP),
    task_result: TaskResultSchema,
  })
  .strict();

const QuerySetSchema = z
  .object({
    territory: TerritorySchema,
    discovery_tasks: z.array(DiscoveryTaskSchema).length(2),
    queries: z.array(KeywordQuerySchema).max(MAX_QUERIES_PER_TERRITORY),
  })
  .strict();

export const KeywordMetricsSchema = z
  .object({
    schema_version: z.literal("2.1.0"),
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
        http_requests_made: z.literal(4),
        tasks_submitted: z.literal(4),
        total_cost_usd: z.number().min(0),
      })
      .strict(),
    request_config: z
      .object({
        location_code: z.number().int(),
        language_code: NonEmptyStringSchema,
        limit_per_task: z.literal(250),
        closely_variants: z.literal(true),
        ignore_synonyms: z.literal(false),
        include_serp_info: z.literal(true),
        include_clickstream_data: z.literal(false),
        filters: DataForSeoKeywordIdeasFiltersSchema,
        order_by: DataForSeoKeywordIdeasOrderBySchema,
        minimum_search_volume: z.literal(10),
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
      const expectedGroups: readonly DiscoveryGroup[] =
        querySet.territory === "problem_demand"
          ? (["core_problem_demand", "adjacent_problem_demand"] as const)
          : (["core_solution_demand", "adjacent_solution_demand"] as const);
      const tasksByGroup = new Map(
        querySet.discovery_tasks.map((task) => [task.discovery_group, task]),
      );

      for (const [taskIndex, expectedGroup] of expectedGroups.entries()) {
        const task = querySet.discovery_tasks[taskIndex];

        if (task?.discovery_group !== expectedGroup) {
          context.addIssue({
            code: "custom",
            message: `${querySet.territory} discovery task ${taskIndex + 1} must be ${expectedGroup}.`,
            path: ["query_sets", index, "discovery_tasks", taskIndex, "discovery_group"],
          });
        }

        if (task !== undefined && task.task_tag !== task.discovery_group) {
          context.addIssue({
            code: "custom",
            message: `${task.discovery_group} task_tag must equal its discovery_group.`,
            path: ["query_sets", index, "discovery_tasks", taskIndex, "task_tag"],
          });
        }

        const normalizedSeeds = task?.seeds_used.map(normalize) ?? [];

        if (new Set(normalizedSeeds).size !== normalizedSeeds.length) {
          context.addIssue({
            code: "custom",
            message: `${expectedGroup} seeds_used must be unique after trimming and lowercasing.`,
            path: ["query_sets", index, "discovery_tasks", taskIndex, "seeds_used"],
          });
        }
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

      for (const [queryIndex, query] of querySet.queries.entries()) {
        if (query.discovery_rank !== queryIndex + 1) {
          context.addIssue({
            code: "custom",
            message: `${querySet.territory} discovery_rank must be regenerated sequentially after merging and deduplication.`,
            path: ["query_sets", index, "queries", queryIndex, "discovery_rank"],
          });
        }

        const expectedGroupIndex = expectedGroups.indexOf(query.discovery_group);
        const priorGroupIndex =
          queryIndex === 0
            ? expectedGroupIndex
            : expectedGroups.indexOf(
                querySet.queries[queryIndex - 1].discovery_group,
              );

        if (expectedGroupIndex < priorGroupIndex) {
          context.addIssue({
            code: "custom",
            message: `${querySet.territory} queries must place core results before adjacent results.`,
            path: ["query_sets", index, "queries", queryIndex, "discovery_group"],
          });
        }
      }

      for (const [queryIndex, query] of querySet.queries.entries()) {
        const sourceTask = tasksByGroup.get(query.discovery_group);

        if (sourceTask === undefined) {
          context.addIssue({
            code: "custom",
            message: `${query.discovery_group} has no matching discovery task in ${querySet.territory}.`,
            path: ["query_sets", index, "queries", queryIndex, "discovery_group"],
          });
        } else if (
          query.source_seed_keywords.map(normalize).join("\u0000") !==
          sourceTask.seeds_used.map(normalize).join("\u0000")
        ) {
          context.addIssue({
            code: "custom",
            message: "Query source_seed_keywords must match its discovery task seeds.",
            path: ["query_sets", index, "queries", queryIndex, "source_seed_keywords"],
          });
        }
      }

      for (const [taskIndex, task] of querySet.discovery_tasks.entries()) {
        const retainedCount = querySet.queries.filter(
          (query) => query.discovery_group === task.discovery_group,
        ).length;

        if (task.task_result.queries_retained !== retainedCount) {
          context.addIssue({
            code: "custom",
            message: `${task.discovery_group} queries_retained must equal ${retainedCount}.`,
            path: ["query_sets", index, "discovery_tasks", taskIndex, "task_result", "queries_retained"],
          });
        }

        if (
          task.task_result.queries_retained > task.task_result.items_received
        ) {
          context.addIssue({
            code: "custom",
            message: `${task.discovery_group} queries_retained must not exceed items_received.`,
            path: ["query_sets", index, "discovery_tasks", taskIndex, "task_result", "queries_retained"],
          });
        }

        if (task.task_result.items_received > 250) {
          context.addIssue({
            code: "custom",
            message: `${task.discovery_group} items_received must not exceed 250.`,
            path: ["query_sets", index, "discovery_tasks", taskIndex, "task_result", "items_received"],
          });
        }
      }
    }

    const problemQueries = problemSet?.queries ?? [];
    const solutionQueries = solutionSet?.queries ?? [];
    const allQueries = [...problemQueries, ...solutionQueries];
    const allTasks = artifact.query_sets.flatMap(
      (querySet) => querySet.discovery_tasks,
    );
    const taskIds = allTasks.map((task) => task.task_result.task_id);
    const taskCost = allTasks.reduce(
      (total, task) => total + task.task_result.cost_usd,
      0,
    );

    if (new Set(taskIds).size !== taskIds.length) {
      context.addIssue({
        code: "custom",
        message: "All four provider task IDs must be unique.",
        path: ["query_sets"],
      });
    }

    if (Math.abs(artifact.provider.total_cost_usd - taskCost) > 1e-9) {
      context.addIssue({
        code: "custom",
        message: `provider.total_cost_usd must equal the four task costs (${taskCost}).`,
        path: ["provider", "total_cost_usd"],
      });
    }
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
