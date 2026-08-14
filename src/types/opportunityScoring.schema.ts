import { z } from "zod";

import { OPPORTUNITY_SCORING_METHOD } from "../lib/opportunityScoring.js";

export const OpportunityScoringMethodSchema = z
  .object({
    name: z.literal(OPPORTUNITY_SCORING_METHOD.name),
    version: z.literal(OPPORTUNITY_SCORING_METHOD.version),
    missing_keyword_difficulty_default: z.literal(
      OPPORTUNITY_SCORING_METHOD.missing_keyword_difficulty_default,
    ),
    combination_method: z.literal(
      OPPORTUNITY_SCORING_METHOD.combination_method,
    ),
    formula: z.literal(OPPORTUNITY_SCORING_METHOD.formula),
    weights: z
      .object({
        demand_score: z.literal(
          OPPORTUNITY_SCORING_METHOD.weights.demand_score,
        ),
        attainability_score: z.literal(
          OPPORTUNITY_SCORING_METHOD.weights.attainability_score,
        ),
      })
      .strict(),
    demand_normalization: z
      .object({
        method: z.literal(
          OPPORTUNITY_SCORING_METHOD.demand_normalization.method,
        ),
        territory_specific: z.literal(
          OPPORTUNITY_SCORING_METHOD.demand_normalization.territory_specific,
        ),
        cap: z.literal(
          OPPORTUNITY_SCORING_METHOD.demand_normalization.cap,
        ),
      })
      .strict(),
    score_scope: z.literal(OPPORTUNITY_SCORING_METHOD.score_scope),
  })
  .strict();

export const OpportunityMetricsSchema = z
  .object({
    search_volume_used: z.number().int().min(0),
    territory_p95_search_volume: z
      .number()
      .int()
      .min(0)
      .describe("Nearest-rank P95 search-volume benchmark for this territory."),
    demand_score: z
      .number()
      .min(0)
      .max(1)
      .describe("Territory-relative log1p demand score, capped at 1."),
    keyword_difficulty_original: z.number().int().min(0).max(100).nullable(),
    keyword_difficulty_used: z.number().int().min(0).max(100),
    keyword_difficulty_was_imputed: z.boolean(),
    attainability_score: z
      .number()
      .min(0)
      .max(1)
      .describe("Inverse of keyword_difficulty_used on the 0 to 1 scale."),
    opportunity_score: z
      .number()
      .min(0)
      .max(100)
      .describe(OPPORTUNITY_SCORING_METHOD.formula),
  })
  .strict();

export type OpportunityMetrics = z.infer<typeof OpportunityMetricsSchema>;
