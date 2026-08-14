import { z } from "zod";

const NonEmptyStringSchema = z.string().min(1);

const ProviderSchema = z
  .object({
    name: z.literal("dataforseo"),
    endpoint: z.literal(
      "/v3/dataforseo_labs/google/serp_competitors/live",
    ),
    http_requests_made: z.literal(1),
    tasks_submitted: z.literal(1),
    task_id: NonEmptyStringSchema,
    task_status_code: z.literal(20000),
    task_status_message: NonEmptyStringSchema,
    total_cost_usd: z.number().min(0),
  })
  .strict();

const RequestConfigSchema = z
  .object({
    location_code: z.literal(2840),
    language_code: z.literal("en"),
    include_subdomains: z.literal(true),
    item_types: z.tuple([z.literal("organic")]),
    limit: z.union([z.literal(50), z.literal(1000)]),
    order_by: z.tuple([z.literal("rating,desc")]),
    target_domain_exclusion_filter: NonEmptyStringSchema,
  })
  .strict();

const ScopeSchema = z
  .object({
    based_on: z.literal("all_validated_queries"),
    confirmed_queries_received: z.number().int().min(1),
    unique_queries_available: z.number().int().min(1),
    unique_queries_submitted: z.number().int().min(1).max(200),
    duplicate_queries_removed: z.number().int().min(0),
    provider_limit_queries_omitted: z.number().int().min(0),
    provider_keyword_limit: z.literal(200),
    estimated_traffic_definition: z.literal(
      "Estimated traffic from the analyzed query set, not total domain-wide organic traffic.",
    ),
  })
  .strict();

const SummarySchema = z
  .object({
    total_domains_found: z.number().int().min(0),
    domains_received: z.number().int().min(0),
    raw_candidates_received: z.number().int().min(0).max(1000).optional(),
    generic_candidates_filtered: z.number().int().min(0).optional(),
    competitors_included: z.number().int().min(0).max(50),
    final_competitors_profiled: z.number().int().min(0).max(50).optional(),
    target_domain_excluded: z.literal(true),
  })
  .strict();

const QueryPositionsSchema = z
  .object({
    query_id: NonEmptyStringSchema,
    query: NonEmptyStringSchema,
    positions: z.array(z.number().int().positive()).min(1),
  })
  .strict()
  .superRefine((queryPositions, context) => {
    const seenPositions = new Set<number>();

    for (const [index, position] of queryPositions.positions.entries()) {
      if (seenPositions.has(position)) {
        context.addIssue({
          code: "custom",
          message: `positions must contain unique positive integers; found duplicate ${position}.`,
          path: ["positions", index],
        });
      }

      seenPositions.add(position);
    }
  });

const CompetitorSchema = z
  .object({
    competitor_id: NonEmptyStringSchema,
    rank: z.number().int().positive(),
    domain: NonEmptyStringSchema,
    average_position: z.number().positive().nullable(),
    median_position: z.number().positive().nullable(),
    visibility_rating: z.number().min(0).nullable(),
    visibility_index: z.number().min(0).nullable(),
    estimated_traffic_from_analyzed_queries: z.number().min(0).nullable(),
    keywords_ranked_count: z.number().int().min(0),
    query_coverage_percentage: z.number().min(0).max(100),
    relevant_serp_items: z.number().min(0).nullable(),
    query_positions: z.array(QueryPositionsSchema),
  })
  .strict()
  .superRefine((competitor, context) => {
    const seenQueryIds = new Set<string>();

    for (const [
      index,
      queryPosition,
    ] of competitor.query_positions.entries()) {
      if (seenQueryIds.has(queryPosition.query_id)) {
        context.addIssue({
          code: "custom",
          message: `query_id values must be unique within each competitor; found duplicate ${queryPosition.query_id}.`,
          path: ["query_positions", index, "query_id"],
        });
      }

      seenQueryIds.add(queryPosition.query_id);
    }
  });

export const CompetitorLandscapeSchema = z
  .object({
    schema_version: z.literal("1.0.0"),
    run_id: NonEmptyStringSchema,
    generated_at: z.string().datetime(),
    source_artifacts: z.tuple([z.literal("confirmed-queries.json")]),
    status: z.literal("complete"),
    warnings: z.array(NonEmptyStringSchema),
    website_url: NonEmptyStringSchema,
    target_domain: NonEmptyStringSchema,
    provider: ProviderSchema,
    request_config: RequestConfigSchema,
    scope: ScopeSchema,
    summary: SummarySchema,
    competitors: z.array(CompetitorSchema).max(50),
  })
  .strict()
  .superRefine((artifact, context) => {
    if (artifact.request_config.limit === 1000) {
      for (const field of [
        "raw_candidates_received",
        "generic_candidates_filtered",
        "final_competitors_profiled",
      ] as const) {
        if (artifact.summary[field] === undefined) {
          context.addIssue({
            code: "custom",
            message: `summary.${field} is required for newly generated 1,000-candidate artifacts.`,
            path: ["summary", field],
          });
        }
      }
    }

    if (artifact.source_artifacts[0] !== "confirmed-queries.json") {
      context.addIssue({
        code: "custom",
        message:
          "source_artifacts must be exactly [\"confirmed-queries.json\"].",
        path: ["source_artifacts"],
      });
    }

    if (
      artifact.scope.confirmed_queries_received <
      artifact.scope.unique_queries_available
    ) {
      context.addIssue({
        code: "custom",
        message:
          "scope.confirmed_queries_received must be greater than or equal to scope.unique_queries_available.",
        path: ["scope", "confirmed_queries_received"],
      });
    }

    const expectedDuplicateQueriesRemoved =
      artifact.scope.confirmed_queries_received -
      artifact.scope.unique_queries_available;

    if (
      artifact.scope.duplicate_queries_removed !==
      expectedDuplicateQueriesRemoved
    ) {
      context.addIssue({
        code: "custom",
        message:
          "scope.duplicate_queries_removed must equal confirmed_queries_received minus unique_queries_available.",
        path: ["scope", "duplicate_queries_removed"],
      });
    }

    const expectedProviderLimitQueriesOmitted =
      artifact.scope.unique_queries_available -
      artifact.scope.unique_queries_submitted;

    if (
      artifact.scope.provider_limit_queries_omitted !==
      expectedProviderLimitQueriesOmitted
    ) {
      context.addIssue({
        code: "custom",
        message:
          "scope.provider_limit_queries_omitted must equal unique_queries_available minus unique_queries_submitted.",
        path: ["scope", "provider_limit_queries_omitted"],
      });
    }

    if (artifact.summary.competitors_included !== artifact.competitors.length) {
      context.addIssue({
        code: "custom",
        message: "summary.competitors_included must equal competitors.length.",
        path: ["summary", "competitors_included"],
      });
    }

    if (
      artifact.summary.final_competitors_profiled !== undefined &&
      artifact.summary.final_competitors_profiled !==
        artifact.competitors.length
    ) {
      context.addIssue({
        code: "custom",
        message:
          "summary.final_competitors_profiled must equal competitors.length.",
        path: ["summary", "final_competitors_profiled"],
      });
    }

    if (
      artifact.summary.raw_candidates_received !== undefined &&
      artifact.summary.raw_candidates_received !==
      artifact.summary.domains_received
    ) {
      context.addIssue({
        code: "custom",
        message:
          "summary.raw_candidates_received must equal summary.domains_received.",
        path: ["summary", "raw_candidates_received"],
      });
    }

    if (
      artifact.summary.generic_candidates_filtered !== undefined &&
      artifact.summary.raw_candidates_received !== undefined &&
      artifact.summary.generic_candidates_filtered >
        artifact.summary.raw_candidates_received
    ) {
      context.addIssue({
        code: "custom",
        message:
          "summary.generic_candidates_filtered cannot exceed raw_candidates_received.",
        path: ["summary", "generic_candidates_filtered"],
      });
    }

    if (
      artifact.summary.domains_received < artifact.summary.competitors_included
    ) {
      context.addIssue({
        code: "custom",
        message:
          "summary.domains_received must be greater than or equal to competitors.length.",
        path: ["summary", "domains_received"],
      });
    }

    if (
      artifact.summary.total_domains_found < artifact.summary.domains_received
    ) {
      context.addIssue({
        code: "custom",
        message:
          "summary.total_domains_found must be greater than or equal to summary.domains_received.",
        path: ["summary", "total_domains_found"],
      });
    }

    const competitorIds = new Set<string>();
    const domains = new Set<string>();

    for (const [index, competitor] of artifact.competitors.entries()) {
      const expectedRank = index + 1;

      if (competitor.rank !== expectedRank) {
        context.addIssue({
          code: "custom",
          message: `competitor ranks must be contiguous and begin at 1; expected ${expectedRank}.`,
          path: ["competitors", index, "rank"],
        });
      }

      if (competitorIds.has(competitor.competitor_id)) {
        context.addIssue({
          code: "custom",
          message: `competitor_id must be unique; found duplicate ${competitor.competitor_id}.`,
          path: ["competitors", index, "competitor_id"],
        });
      }

      competitorIds.add(competitor.competitor_id);

      if (domains.has(competitor.domain)) {
        context.addIssue({
          code: "custom",
          message: `domain must be unique; found duplicate ${competitor.domain}.`,
          path: ["competitors", index, "domain"],
        });
      }

      domains.add(competitor.domain);

      if (
        competitor.domain === artifact.target_domain ||
        competitor.domain.endsWith(`.${artifact.target_domain}`)
      ) {
        context.addIssue({
          code: "custom",
          message:
            "competitor domain must not equal target_domain or be a subdomain of target_domain.",
          path: ["competitors", index, "domain"],
        });
      }

      if (
        competitor.keywords_ranked_count >
        artifact.scope.unique_queries_submitted
      ) {
        context.addIssue({
          code: "custom",
          message:
            "keywords_ranked_count cannot exceed scope.unique_queries_submitted.",
          path: ["competitors", index, "keywords_ranked_count"],
        });
      }

      const expectedCoverage =
        artifact.scope.unique_queries_submitted > 0
          ? (competitor.keywords_ranked_count /
              artifact.scope.unique_queries_submitted) *
            100
          : 0;

      if (
        Math.abs(
          competitor.query_coverage_percentage - expectedCoverage,
        ) > 0.01
      ) {
        context.addIssue({
          code: "custom",
          message:
            "query_coverage_percentage must equal keywords_ranked_count / scope.unique_queries_submitted * 100, rounded to two decimals.",
          path: ["competitors", index, "query_coverage_percentage"],
        });
      }
    }
  });

export type CompetitorLandscape = z.infer<
  typeof CompetitorLandscapeSchema
>;
