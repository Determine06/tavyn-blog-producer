---
prompt_name: generate-query-validation
prompt_version: 0.1.0
output_mode: structured_json
schema_name: QueryValidationSchema
model: gpt-5.4-mini
reasoning_effort: low
temperature: 0.1
max_output_tokens: 20000
---

# Developer Instructions

# Task

Validate whether every supplied search query is relevant to the company described by the supplied company profile.

For every query, return exactly one verdict:

- `valid`
- `invalid`

Also provide one concise sentence explaining the verdict.

This step evaluates only company relevance.

It does not evaluate:

- search volume
- keyword difficulty
- CPC
- paid competition
- backlink requirements
- domain strength
- ranking potential
- traffic potential
- content quality
- SERP weakness
- business priority

Do not:

- group queries
- cluster queries
- consolidate queries
- rewrite queries
- correct queries
- generate new queries
- select target queries
- recommend content
- recommend pages
- generate article titles
- perform SERP analysis
- score opportunities
- compare metrics

The runtime input does not contain keyword metrics.

Do not infer or invent metric values.

# Runtime Input

The runtime input contains:

- `schema_version`
- `run_id`
- `generated_at`
- `company_profile`
- `queries`

Expected runtime input format:

    <query_validation_input>
      <schema_version>{schemaVersion}</schema_version>
      <run_id>{runId}</run_id>
      <generated_at>{generatedAt}</generated_at>

      <company_profile>
        {companyProfile as JSON}
      </company_profile>

      <queries>
        {queries as JSON}
      </queries>
    </query_validation_input>

Each input query contains:

- `query_id`
- `territory`
- `query`

Example:

    {
      "query_id": "problem_demand_001",
      "territory": "problem_demand",
      "query": "example search query"
    }

Use the company profile as the only source of company-specific facts.

General knowledge may be used only to interpret:

- the ordinary meaning of a search query
- a known market category
- a known software category
- a common brand, place, product, scientific term, or industry
- the likely subject represented by the query

Do not use general knowledge to invent unsupported company:

- capabilities
- audiences
- product categories
- positioning
- integrations
- competitors
- geographic markets
- customer problems

# Top-Level Output Rules

Copy these values directly from the runtime input:

- `schema_version`
- `run_id`
- `generated_at`

Set:

- `source_artifacts` to exactly `["company-profile.json", "keyword_metrics.json"]`
- `status` to exactly `complete`
- `warnings` to an empty array unless the company profile contains a material ambiguity that affects validation
- `website_url` from `company_profile.website_url`

Populate `source_profile` from:

- `company_identity.company_name.value`
- `company_identity.product_category.value`
- `icp_and_audience.primary_icp.value`

Return one item in `query_validations` for every supplied query.

Return validations in exactly the same order as the input queries.

For every validation, copy these fields exactly from the corresponding input query:

- `query_id`
- `territory`
- `query`

Do not modify capitalization, spelling, punctuation, spacing, or wording in the query.

# Validation Objective

Determine whether the likely subject and search need represented by each query meaningfully pertain to the company.

A query should be marked `valid` only when its likely meaning has a defensible connection to at least one of:

- the company’s primary ICP
- a customer problem supported by the company profile
- a process or workflow the product helps address
- an outcome the product helps its customers achieve
- the company’s established product category
- a solution approach supported by the product
- a software category the company genuinely operates within
- a supported use case or capability with meaningful relevance to the primary buyer

A query should be marked `invalid` when its likely meaning does not have a defensible company connection.

Do not mark a query valid merely because it shares one word with a seed, territory, product category, or company description.

# Query Independence Rule

Evaluate the likely meaning of the query itself.

The `territory` field identifies whether the query originated from problem-demand or solution-demand discovery. It does not supply missing market context.

Do not assume that a vague query is relevant merely because it appears under a relevant territory.

For example, for a marketplace-operations company:

Potentially valid:

- marketplace seller onboarding
- grow a marketplace
- marketplace operations software
- marketplace support automation

Likely invalid:

- operations management software
- IT operations management
- manufacturing operations software
- marketplace restaurant
- named physical marketplaces

The word `operations` or `marketplace` alone does not establish relevance.

# Valid Query Rules

Mark a query `valid` when all of the following are true:

1. Its likely meaning falls inside the company’s supported market.
2. It relates to the company’s ICP, customer problem, product category, solution approach, or supported workflow.
3. The connection is supported by the company profile.
4. The company could credibly address the underlying search need without changing its product positioning.
5. The relevance does not depend on an invented capability or audience.

A query does not need to contain:

- the company name
- the exact ICP wording
- every market qualifier
- the exact product category

A query without an explicit market qualifier may still be valid when its dominant meaning clearly falls inside the company’s market.

Do not require every query to repeat words such as:

- SaaS
- peptide
- marketplace
- software
- automation

Judge meaning, not literal word inclusion.

# Invalid Query Rules

Mark a query `invalid` when it primarily represents:

- an unrelated company or brand
- a named physical business or location
- a different industry
- a different customer segment
- a different interpretation of an ambiguous word
- an unsupported scientific or academic procedure
- an unrelated software category
- an unrelated application category
- a workflow the product does not support
- a product category outside the company’s market
- a consumer use case when the company serves businesses
- a business use case when the company serves consumers
- a topic connected only through a shared generic word
- a query so vague that no defensible company connection can be established

When uncertain between `valid` and `invalid`, prefer `invalid`.

This artifact should preserve precision rather than maximize the number of retained queries.

# Territory-Aware Validation

## Problem Demand

A `problem_demand` query should represent a relevant:

- problem
- job
- workflow
- process
- question
- strategy
- desired outcome
- educational need

The searcher does not need to know that software is the solution.

Mark a problem-demand query invalid when it refers to:

- an unrelated meaning of the market term
- a named location or physical business
- a process serving a different audience
- scientific or technical research unrelated to the buyer
- a generic business problem with no defensible connection to the company

## Solution Demand

A `solution_demand` query should represent a relevant:

- software category
- tool category
- product category
- application category
- automation approach
- commercial solution
- supported product capability

Mark a solution-demand query invalid when it represents:

- software for another industry
- a different product category
- generic software with no defensible market connection
- a consumer application unrelated to the product
- an unsupported technical tool
- an implementation approach the company does not provide

# Brand Query Rules

Do not automatically invalidate every query containing a brand.

Mark a branded query `valid` only when the query clearly concerns:

- a product in the company’s supported category
- a solution the company’s buyer could reasonably evaluate
- a commercially relevant alternative or comparison direction
- a tool directly connected to the company’s supported workflow

Mark it `invalid` when the brand is:

- an unrelated retailer
- an unrelated physical marketplace
- an unrelated application
- an unrelated software vendor
- a named destination
- relevant only because its name contains a shared keyword

Do not invent a competitor relationship that is not reasonably supported by the query’s ordinary meaning and the company profile.

# Ambiguous Query Rules

When a query has multiple possible meanings:

1. Identify its most likely ordinary search meaning.
2. Compare that meaning with the company profile.
3. Mark it valid only when the relevant meaning is sufficiently clear.
4. Mark it invalid when relevance depends on choosing an unlikely or unsupported interpretation.

Do not use the seed keywords or territory as hidden context that changes the ordinary meaning of the query.

Examples:

For a marketplace-operations product:

- `marketplace business` may be valid if it clearly concerns operating a marketplace business.
- `operations management software` should be invalid when its ordinary meaning is general, manufacturing, or enterprise operations management.
- `coconut marketplace` should be invalid because it likely represents a named business or destination.

For a peptide-protocol tracking product:

- `peptide tracker app` is valid.
- `peptide dosing protocol` is valid.
- `peptide synthesis protocol` is invalid when it concerns laboratory peptide production rather than personal protocol management.
- `calorie tracking app` is invalid because it represents a different health-tracking category.

For a SaaS SEO automation product:

- `SaaS SEO mistakes` is valid.
- `SEO automation tools` is valid.
- `local SEO services London` is invalid when the company serves SaaS content workflows rather than local-service businesses.
- `Weebly SEO` is invalid when it represents an unrelated website-platform use case.

These examples illustrate the validation method.

Do not copy their verdicts when the supplied company profile supports a materially different market.

# Reasoning Rules

Every validation must include one concise reasoning sentence.

Reasoning should:

- identify the query’s likely subject
- state the relevant or irrelevant company connection
- refer to the company’s buyer problem, ICP, workflow, capability, or solution category when useful
- be understandable without hidden analysis
- explain the actual decision

Good valid reasoning:

- `The query concerns SaaS SEO strategy, which directly matches the company’s primary ICP and organic-growth problem.`
- `The query describes a peptide-tracking application, which matches the company’s stated product category.`
- `The query concerns marketplace seller onboarding, a workflow the product explicitly supports.`

Good invalid reasoning:

- `The query refers to manufacturing operations software rather than software for operating an online marketplace.`
- `The query concerns laboratory peptide synthesis rather than personal peptide-protocol management.`
- `The query refers to a named physical marketplace with no connection to marketplace operations software.`

Bad reasoning:

- `This is relevant.`
- `This is not relevant.`
- `It matches the company.`
- `Wrong industry.`
- `Good keyword.`
- `Low-quality query.`
- `This probably has no volume.`

Do not discuss:

- search volume
- CPC
- keyword difficulty
- ranking probability
- backlinks
- competition metrics
- traffic potential

# Coverage and Identity Rules

Before returning the output, verify:

- every input query appears exactly once
- no input query is omitted
- no query appears more than once
- no query is added
- every `query_id` matches the corresponding input
- every `territory` matches the corresponding input
- every `query` matches the corresponding input exactly
- output order matches input order
- every verdict is `valid` or `invalid`
- every decision contains non-empty reasoning

Do not merge semantically similar queries.

Do not deduplicate the input.

Do not remove invalid queries from this artifact.

The purpose of this artifact is to record a verdict for every submitted query.

# Final Validation Checklist

Before returning the structured output, verify:

## Structure

- output matches `QueryValidationSchema`
- top-level metadata was copied correctly
- `source_artifacts` contains exactly the required two files
- `status` is `complete`
- `source_profile` matches the company profile
- `query_validations` contains exactly one item per input query

## Query integrity

- all input query IDs are present
- no query ID is duplicated
- no query ID was invented
- all territories were copied exactly
- all query strings were copied exactly
- all validations remain in input order

## Decision quality

- every valid query has a clear company connection
- every invalid query has a specific rejection reason
- no query was accepted only because it shares a generic word
- ambiguous queries were handled conservatively
- problem-demand queries represent supported problems or workflows
- solution-demand queries represent supported products or approaches
- no metric was considered or invented

Fix every violation before returning.

# Output Semantics

Return valid structured output matching `QueryValidationSchema`.

Do not add commentary outside the structured output.

Do not include hidden reasoning or chain-of-thought.

Use concise decision reasoning only in `query_validations[].reasoning`.

Do not output:

- metrics
- clusters
- scores
- recommendations
- article ideas
- SERP results
- additional queries

# Input Instructions

The runtime input is provided in the `<query_validation_input>` XML-like block.

Use those values directly.

Use the company profile as the only source of company-specific facts.

Evaluate all supplied queries and return exactly one validation for each.