---
prompt_name: generate-query-validation
prompt_version: 0.6.0
output_mode: structured_json
schema_name: QueryValidationSchema
model: gpt-5.4-mini
reasoning_effort: low
temperature: 0.1
max_output_tokens: 60000
---

---
prompt_name: generate-query-validation
prompt_version: 0.7.0
output_mode: structured_json
schema_name: QueryValidationSchema
model: gpt-5.4-mini
reasoning_effort: low
temperature: 0.1
max_output_tokens: 30000
---

# Developer Instructions

# Task

Determine whether every supplied search query should remain in a broad candidate
pool for later organic-search opportunity analysis for the supplied company.

For every query, return:

- `valid` or `invalid`
- one concise sentence explaining the verdict

This is a recall-oriented semantic drift filter. It is not final keyword
selection.

A query is `valid` when it has a reasonable, natural topical relationship to
the company's:

- product or solution category
- customer problems
- customer workflows, tasks, decisions, or artifacts
- supported capabilities or solution approaches
- intended users and their relevant professional work
- outcomes the product can meaningfully influence
- directly adjacent markets or solution categories

A query is `invalid` only when its dominant ordinary search meaning is clearly
outside that topic universe or requires a forced interpretation to connect it
to the company.

Use an asymmetric standard:

> Preserve plausible relevance. Reject clear irrelevance.

Do not require a query to be a strong article recommendation, a bottom-funnel
keyword, or something the product completely solves.

# Purpose of This Step

The keyword provider deliberately returns a large discovery pool. That pool can
contain direct queries, broad category education, adjacent topics, and obvious
semantic drift.

This step should remove obvious drift while preserving potentially useful
queries for later analysis.

Later stages—not this step—will evaluate:

- search volume
- keyword difficulty
- CPC and commercial intent
- SERP competition
- ranking potential
- ICP priority
- conversion potential
- topic clustering
- content fit
- final recommendations

Do not use any of those considerations to reject a topically relevant query.

# Runtime Input

The runtime input contains:

- `schema_version`
- `run_id`
- `generated_at`
- `company_profile`
- `queries`

Each query contains:

- `query_id`
- `territory`
- `query`

The supplied `territory` is discovery provenance only. It is not an acceptance
lane.

A solution-oriented query discovered from `problem_demand` can be valid.

An informational query discovered from `solution_demand` can be valid.

Evaluate every query against the company's full topic universe.

# Company Evidence

Use the supplied company profile as the only source of company-specific facts.

You may use general knowledge to interpret ordinary query meanings, known
categories, professional practices, products, companies, and named entities.

Do not invent unsupported company capabilities, audiences, markets,
integrations, or positioning.

# Private Topic Universe

Before validating queries, privately build a broad topic universe using:

1. the primary product category
2. the one-sentence description and positioning
3. the primary and secondary audiences
4. buyer pains
5. workflows, tasks, decisions, and artifacts
6. desired outcomes
7. core and workflow capabilities
8. immediate parent, sibling, and adjacent categories

Treat the company profile as a connected market description, not a list of
isolated exact-match phrases.

A query may be connected through more than one ordinary semantic relationship.
For example:

- customer feedback → product decisions → product management
- customer support → customer satisfaction → retention
- background jobs → workflow execution → orchestration
- wedding-planner operations → client delivery → wedding-planning workflow

Those connections can be valid when they are natural and useful, even if the
product is not the complete answer to the query.

Do not extend this reasoning indefinitely. A connection is invalid when it
depends only on a generic word, generic technology, or remote audience interest.

Do not output the topic universe.

# Valid Relevance Routes

Return `valid` when at least one route below is naturally supported and no clear
exclusion applies.

## 1. Category and Solution Relevance

The query concerns:

- the exact product category
- an immediate parent or sibling category
- a directly adjacent solution category
- a supported solution approach
- a relevant competitor or substitute
- comparison, alternatives, reviews, pricing, selection, or implementation in
  a relevant category

The company does not need to sell the exact modifier or be the complete solution.

## 2. Problem and Workflow Relevance

The query concerns:

- a customer pain or failure state
- a central or adjacent workflow
- a recurring task, process, strategy, or decision
- a workflow artifact, template, checklist, plan, or example
- a best practice, framework, metric, or method for doing the work
- an earlier or later step in the same workflow

## 3. Audience-Role Relevance

The query concerns the professional work of an audience explicitly named in the
company profile and remains connected to why that audience would use, evaluate,
or benefit from the product.

This can include:

- role-specific strategies and best practices
- operating concepts and responsibilities
- relevant skills, frameworks, and processes
- cross-functional collaboration
- market education about the audience's work

Do not require every audience-role query to mention the product's exact feature.

Audience overlap alone is not unlimited permission. Pure job-search,
compensation, degree, certification, bootcamp, or unrelated career-training
intent remains invalid.

## 4. Outcome Relevance

The query concerns an outcome the company's product, workflows, or expertise can
meaningfully influence.

Examples may include:

- retention
- satisfaction
- loyalty
- adoption
- engagement
- efficiency
- resolution time
- support load
- product prioritization
- customer understanding

The product does not need to be the only cause of the outcome.

## 5. Market-Education Relevance

The query helps someone understand terminology, practices, roles, decisions,
problems, or methods in the company's market.

Definitions, examples, beginner questions, broad informational queries, and
early-funnel education can be valid.

Do not reject a query merely because it is broad or educational.

# Broad and Adjacent Queries

Broad is not the same as unrelated.

Return `valid` when the query's dominant meaning falls inside the company's
category, audience work, problem space, workflow, outcome space, or a directly
adjacent category.

Return `invalid` when the query names a separate market or product category and
the connection exists only through a shared generic word.

Examples:

- `customer retention` can be valid for a customer support and feedback
  platform because support quality and closed feedback loops meaningfully
  influence retention.
- `product management strategy` can be valid for a feedback and roadmap
  platform serving product teams because feedback prioritization is part of
  product management.
- `project management software` is not automatically valid for that same
  company because it is a separate software category.
- `inventory management software` is invalid for that company because
  “management” is only shared vocabulary.

# Query Interpretation

Interpret each query by its dominant ordinary search meaning.

Consider:

- the primary subject
- the likely search need
- any industry or audience qualifier
- any named entity
- whether the wording has a coherent meaning

Exact word overlap with the profile is not required.

Do not transform a clearly unrelated query into a relevant one by imagining a
specialized article angle.

When a query has a common relevant interpretation and no stronger unrelated
meaning or qualifier, preserve it as `valid`.

# Named Entities

A named company, product, or competitor can be `valid` when the entity belongs
to a relevant or adjacent category, even without an explicit `alternatives`,
`versus`, or `review` modifier.

A named entity is `invalid` when the dominant intent is:

- unrelated navigation
- an unrelated brand or service
- entertainment
- a person or place
- a local business
- a separate product category with no natural relationship to the company

Do not reject all branded queries mechanically.

# Commercial Modifiers

Modifiers such as these do not make a relevant query invalid:

- free
- open source
- cheap
- enterprise
- small business
- best
- top
- reviews
- pricing
- alternatives
- comparison

The underlying topic or category must still be relevant.

# Clear Invalidity Rules

Return `invalid` when one or more of these is clearly true:

1. The dominant meaning belongs to an unrelated industry, function, or product
   category.
2. The connection depends only on a homonym, shared word, or generic capability.
3. The query has explicit local-provider intent unrelated to the product.
4. The query is entertainment, unrelated navigation, or an unrelated named
   entity.
5. The dominant intent is a job search, salary, interview preparation, degree,
   certification, bootcamp, course, or career-training purchase rather than
   learning or operating in the company's market.
6. The query concerns generic programming syntax or technology unrelated to the
   customer workflow.
7. The query requires adding a missing industry or use-case qualifier to become
   relevant.
8. The query is malformed enough that no coherent search need can be identified.

Do not return `invalid` merely because:

- the query is broad
- the query is informational or early-funnel
- the query has weak purchase intent
- the query is not the exact product category
- the product only partially influences the outcome
- the query concerns a named ICP's professional work
- the query concerns an adjacent category or audience
- the query is a definition, example, strategy, skill, framework, or best
  practice
- the query may not become a final content recommendation
- the query came from the opposite territory

# Calibration Examples

These examples define validation breadth. Apply them only when the supplied
company profile supports the relationship.

## Customer Support and Feedback Platform

Valid:

- `customer feedback questions` — core feedback workflow
- `customer retention` — meaningful downstream outcome of support and feedback
- `product management strategy` — relevant professional work for product teams
  using feedback to prioritize decisions
- `product operations` — adjacent audience-role and workflow topic
- `customer lifecycle management` — adjacent customer-operations topic
- `support crm` — adjacent solution category
- `aha product management software` — relevant adjacent product-feedback and
  roadmapping product
- `customer service vs customer support` — market education

Invalid:

- `walmart customer feedback` — unrelated brand/navigation intent
- `product management bootcamp` — career-training purchase intent
- `property management software` — separate category reached through shared
  vocabulary
- `inventory management software` — separate operational category
- `product packaging` — unrelated merchandising/manufacturing topic
- `project management software for accountants` — separate category and
  unrelated vertical

## Wedding-Planner Business Software

Valid:

- `wedding planning checklist` — central market workflow artifact
- `wedding planner contract` — operating artifact for the target audience
- `client management for wedding planners` — direct business workflow
- `event planning software` — relevant parent or adjacent solution category
- `wedding business marketing` — professional work of the named audience

Invalid:

- `wedding planner cast` — entertainment intent
- `wedding planner chicago` — local-provider intent
- `wedding planner salary` — career and compensation intent
- `lab workflow automation` — unrelated industry
- `crm software for nonprofits` — unsupported vertical

## Developer Workflow-Orchestration Platform

Valid:

- `workflow orchestration tools` — direct solution category
- `background job queues` — core technical workflow
- `workflow diagram` — adjacent workflow-design education
- `automation vs orchestration` — market/category education
- `AI agent observability` — adjacent supported workflow

Invalid:

- `TypeScript decorators` — generic language syntax
- `JavaScript date formatting` — unrelated programming education
- `AI tools for recruiting` — unrelated functional market
- `AI automation course` — training purchase intent
- `accounting workflow software` — unrelated vertical

# Borderline Rule

For a borderline query, ask:

> Is there a reasonable path from the company's actual category, audience work,
> problem, workflow, capability, or outcome to this query without changing the
> query's ordinary meaning?

If yes, return `valid`.

If the relationship is remote, speculative, or based only on shared vocabulary,
return `invalid`.

Do not default ambiguity to invalid when a natural relevant interpretation
exists.

# No Quota

There is no required number or percentage of valid queries.

Do not alter verdicts to reach a target count, balance territories, or make the
pipeline appear successful.

# Output Construction

Copy these values directly from the runtime input:

- `schema_version`
- `run_id`
- `generated_at`

Set:

- `source_artifacts` to exactly
  `["company-profile.json", "keyword_metrics.json"]`
- `status` to exactly `complete`
- `warnings` to `[]` unless the company profile has a material ambiguity that
  affects validation
- `website_url` from `company_profile.website_url`

Populate `source_profile` from:

- `company_identity.company_name.value`
- `company_identity.product_category.value`
- `icp_and_audience.primary_icp.value`

Return exactly one item in `query_validations` for every input query.

Return items in the same order as the input.

For every item, copy exactly:

- `query_id`
- `territory`
- `query`

Do not change query capitalization, spelling, punctuation, spacing, wording, or
territory.

# Decision Reasoning

Each item must contain one concise, self-contained reasoning sentence.

For `valid`, state the strongest natural connection, such as:

- category
- problem
- workflow
- audience-role work
- capability
- outcome
- market education
- adjacent category

For `invalid`, state the dominant unrelated intent or drift.

Do not mention:

- metrics
- ranking probability
- traffic
- final business priority
- quotas
- hidden reasoning

# Integrity Checklist

Before returning, verify:

- output matches `QueryValidationSchema`
- metadata was copied correctly
- every input query appears exactly once
- no query was omitted, duplicated, added, rewritten, or reordered
- every `query_id`, `territory`, and `query` exactly matches the input
- every verdict is `valid` or `invalid`
- every item contains non-empty concise reasoning
- broad, informational, audience-role, outcome, and adjacent queries were not
  rejected solely for being outside the exact product feature
- unrelated industries, categories, named entities, local intent, career
  purchases, generic technical topics, and malformed queries were rejected

Fix every violation before returning.

# Output Semantics

Return only valid structured output matching `QueryValidationSchema`.

Do not add commentary outside the structured output.

# Input Instructions

The runtime input is provided in the `<query_validation_input>` block.

Use the supplied metadata and company profile directly.

Evaluate every supplied query and return exactly one validation for each.