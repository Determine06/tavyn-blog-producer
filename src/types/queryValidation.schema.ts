import { z } from "zod";

const NonEmptyStringSchema = z.string().min(1);
const TerritorySchema = z.enum(["problem_demand", "solution_demand"]);
const VerdictSchema = z.enum(["valid", "invalid"]);

const SourceProfileSchema = z
  .object({
    company_name: z.string(),
    product_category: z.string(),
    primary_icp: z.string(),
  })
  .strict();

const QueryValidationItemSchema = z
  .object({
    query_id: NonEmptyStringSchema,
    territory: TerritorySchema,
    query: NonEmptyStringSchema,
    verdict: VerdictSchema,
    reasoning: NonEmptyStringSchema,
  })
  .strict();

export const QueryValidationSchema = z
  .object({
    schema_version: z.literal("1.0.0"),
    run_id: NonEmptyStringSchema,
    generated_at: z.string().datetime(),
    source_artifacts: z
      .array(z.enum(["company-profile.json", "keyword_metrics.json"]))
      .length(2),
    status: z.literal("complete"),
    warnings: z.array(NonEmptyStringSchema),
    website_url: NonEmptyStringSchema,
    source_profile: SourceProfileSchema,
    query_validations: z.array(QueryValidationItemSchema),
  })
  .strict()
  .superRefine((artifact, context) => {
    const seenQueryIds = new Set<string>();

    if (
      artifact.source_artifacts[0] !== "company-profile.json" ||
      artifact.source_artifacts[1] !== "keyword_metrics.json"
    ) {
      context.addIssue({
        code: "custom",
        message:
          "source_artifacts must be exactly [\"company-profile.json\", \"keyword_metrics.json\"].",
        path: ["source_artifacts"],
      });
    }

    for (const [index, validation] of artifact.query_validations.entries()) {
      if (seenQueryIds.has(validation.query_id)) {
        context.addIssue({
          code: "custom",
          message: `query_id must be unique; found duplicate ${validation.query_id}.`,
          path: ["query_validations", index, "query_id"],
        });
      }

      seenQueryIds.add(validation.query_id);
    }
  });

export type QueryValidation = z.infer<typeof QueryValidationSchema>;
