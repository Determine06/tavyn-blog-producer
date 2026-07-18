import { z } from "zod";

import { QueryMetricsSchema } from "./keywordMetrics.schema.js";

const NonEmptyStringSchema = z.string().min(1);
const TerritorySchema = z.enum(["problem_demand", "solution_demand"]);

const SourceProfileSchema = z
  .object({
    company_name: z.string(),
    product_category: z.string(),
    primary_icp: z.string(),
  })
  .strict();

const ConfirmedQuerySchema = z
  .object({
    query_id: NonEmptyStringSchema,
    territory: TerritorySchema,
    query: NonEmptyStringSchema,
    validation_reasoning: NonEmptyStringSchema,
    source_seed_keywords: z.array(NonEmptyStringSchema).length(6),
    discovery_rank: z.number().int().positive(),
    core_keyword: z.string().nullable(),
    detected_language: z.string().nullable(),
    metrics: QueryMetricsSchema,
  })
  .strict()
  .superRefine((query, context) => {
    if (!query.query_id.startsWith(`${query.territory}_`)) {
      context.addIssue({
        code: "custom",
        message: `query_id must begin with ${query.territory}_.`,
        path: ["query_id"],
      });
    }
  });

const SummarySchema = z
  .object({
    total_queries_evaluated: z.number().int().min(0),
    total_queries_confirmed: z.number().int().min(0),
    total_queries_rejected: z.number().int().min(0),
    problem_queries_confirmed: z.number().int().min(0),
    solution_queries_confirmed: z.number().int().min(0),
  })
  .strict();

export const ConfirmedQueriesSchema = z
  .object({
    schema_version: z.literal("1.0.0"),
    run_id: NonEmptyStringSchema,
    generated_at: z.string().datetime(),
    source_artifacts: z.tuple([
      z.literal("query-validations.json"),
      z.literal("keyword_metrics.json"),
    ]),
    status: z.literal("complete"),
    warnings: z.array(NonEmptyStringSchema),
    website_url: NonEmptyStringSchema,
    source_profile: SourceProfileSchema,
    confirmed_queries: z.array(ConfirmedQuerySchema),
    summary: SummarySchema,
  })
  .strict()
  .superRefine((artifact, context) => {
    const seenQueryIds = new Set<string>();

    for (const [index, query] of artifact.confirmed_queries.entries()) {
      if (seenQueryIds.has(query.query_id)) {
        context.addIssue({
          code: "custom",
          message: `query_id must be unique; found duplicate ${query.query_id}.`,
          path: ["confirmed_queries", index, "query_id"],
        });
      }

      seenQueryIds.add(query.query_id);
    }

    const problemQueriesConfirmed = artifact.confirmed_queries.filter(
      (query) => query.territory === "problem_demand",
    ).length;
    const solutionQueriesConfirmed = artifact.confirmed_queries.filter(
      (query) => query.territory === "solution_demand",
    ).length;
    const totalQueriesConfirmed = artifact.confirmed_queries.length;
    const expectedRejected =
      artifact.summary.total_queries_evaluated - totalQueriesConfirmed;

    if (artifact.summary.total_queries_confirmed !== totalQueriesConfirmed) {
      context.addIssue({
        code: "custom",
        message:
          "summary.total_queries_confirmed must equal confirmed_queries.length.",
        path: ["summary", "total_queries_confirmed"],
      });
    }

    if (artifact.summary.total_queries_rejected !== expectedRejected) {
      context.addIssue({
        code: "custom",
        message:
          "summary.total_queries_rejected must equal total_queries_evaluated minus total_queries_confirmed.",
        path: ["summary", "total_queries_rejected"],
      });
    }

    if (
      artifact.summary.problem_queries_confirmed !== problemQueriesConfirmed
    ) {
      context.addIssue({
        code: "custom",
        message:
          "summary.problem_queries_confirmed must equal the actual problem-demand confirmed count.",
        path: ["summary", "problem_queries_confirmed"],
      });
    }

    if (
      artifact.summary.solution_queries_confirmed !== solutionQueriesConfirmed
    ) {
      context.addIssue({
        code: "custom",
        message:
          "summary.solution_queries_confirmed must equal the actual solution-demand confirmed count.",
        path: ["summary", "solution_queries_confirmed"],
      });
    }

    if (
      problemQueriesConfirmed + solutionQueriesConfirmed !==
      totalQueriesConfirmed
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Problem plus solution confirmed counts must equal total confirmed count.",
        path: ["summary"],
      });
    }
  });

export type ConfirmedQueries = z.infer<typeof ConfirmedQueriesSchema>;
