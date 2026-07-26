---
prompt_name: generate-seed-keywords
prompt_version: 0.2.0
output_mode: structured_json
schema_name: SeedKeywordsSchema
model: gpt-5.4-mini
reasoning_effort: low
temperature: 0.1
max_output_tokens: 10000
---

---

prompt_name: generate-seed-keywords
prompt_version: 0.3.0
output_mode: structured_json
schema_name: SeedKeywordsSchema
model: gpt-5.4-mini
reasoning_effort: low
temperature: 0.1
max_output_tokens: 10000
------------------------

# Developer Instructions

# Task

Generate a structured seed-keyword strategy from a validated company profile.

Your job is to identify:

* one primary problem-demand territory
* one primary solution-demand territory
* exactly six problem-demand seed keywords
* exactly six solution-demand seed keywords
* exactly one seed for every required bucket
* exactly twelve seed keywords in total

Required problem-demand buckets:

1. `P1_core_customer_job`
2. `P2_primary_workflow`
3. `P3_adjacent_workflow`
4. `P4_pain_or_failure_state`
5. `P5_desired_outcome`
6. `P6_icp_specific_responsibility`

Required solution-demand buckets:

1. `S1_core_product_category`
2. `S2_qualified_product_category`
3. `S3_primary_workflow_solution`
4. `S4_adjacent_workflow_solution`
5. `S5_mechanism_or_approach`
6. `S6_alternative_commercial_category`

The seed keywords will be submitted to an external keyword-discovery provider that returns observed keyword ideas and keyword metrics.

The external provider receives only the literal seed-keyword strings.

It does not receive:

* the company profile
* bucket names
* territory names
* territory summaries
* the primary ICP
* product connections
* evidence
* selection reasoning
* surrounding output context

Every seed must therefore contain enough market context to function independently as a keyword-discovery input.

Seed keywords are discovery inputs. They are not final target keywords, article titles, content clusters, pillar pages, or SEO recommendations.

Do not generate:

* final search queries
* long-tail query lists
* content clusters
* pillar pages
* supporting pages
* blog-post recommendations
* comparison pages
* article titles
* content briefs
* SERP analysis
* opportunity scores
* traffic estimates

Do not estimate or claim:

* search volume
* keyword difficulty
* CPC
* ranking potential
* traffic potential
* domain authority
* SERP weakness
* keyword popularity

# Runtime Input

The runtime input contains:

* `schema_version`
* `run_id`
* `generated_at`
* `company_profile`

Expected runtime input format:

```
<seed_keyword_input>
  <schema_version>{schemaVersion}</schema_version>
  <run_id>{runId}</run_id>
  <generated_at>{generatedAt}</generated_at>

  <company_profile>
    {companyProfile as JSON}
  </company_profile>
</seed_keyword_input>
```

Use the company profile as the only source of company-specific facts.

General market knowledge may be used to translate a supported customer problem, workflow, product category, or solution approach into natural market language.

Do not use general knowledge to invent unsupported:

* company facts
* audiences
* capabilities
* workflows
* integrations
* competitors
* positioning
* geographic markets
* product categories
* technical environments
* use cases

# Top-Level Output Rules

Copy the following values directly from the runtime input:

* `schema_version`
* `run_id`
* `generated_at`

Set:

* `source_artifacts` to exactly `["company-profile.json"]`
* `status` to `complete` when both territories and all twelve buckets can be generated with sufficient evidence
* `status` to `partial` when the profile is materially unclear but a conservative portfolio can still be produced
* `warnings` to an empty array unless a material seed-generation limitation exists
* `website_url` from `company_profile.website_url`

Populate `source_profile` from:

* `company_identity.company_name.value`
* `company_identity.product_category.value`
* `icp_and_audience.primary_icp.value`

Return exactly two items in `demand_territories`.

Return them in this order:

1. `problem_demand`
2. `solution_demand`

Do not generate additional territories.

The `problem_demand` territory must contain exactly these buckets in this order:

1. `P1_core_customer_job`
2. `P2_primary_workflow`
3. `P3_adjacent_workflow`
4. `P4_pain_or_failure_state`
5. `P5_desired_outcome`
6. `P6_icp_specific_responsibility`

The `solution_demand` territory must contain exactly these buckets in this order:

1. `S1_core_product_category`
2. `S2_qualified_product_category`
3. `S3_primary_workflow_solution`
4. `S4_adjacent_workflow_solution`
5. `S5_mechanism_or_approach`
6. `S6_alternative_commercial_category`

Every bucket must appear exactly once.

# Seed Strategy Goal

Do not brainstorm twelve generally relevant phrases.

Construct a deliberate portfolio in which every seed:

* fills one specific bucket
* represents one useful discovery direction
* is directly supported by the company profile
* independently identifies the company’s intended market
* is broad enough to generate multiple relevant ideas
* is distinct from the other eleven seeds

The twelve buckets are intended to cover the primary ways customers discover SaaS markets.

Problem-demand seeds cover:

* the central job
* the primary workflow
* an adjacent workflow
* a recurring failure
* a desired outcome
* a buyer-specific responsibility

Solution-demand seeds cover:

* the main product category
* the qualified product category
* the primary workflow tool category
* the adjacent workflow tool category
* the product’s mechanism or approach
* an alternative commercial category

The company profile should determine:

* which customer job matters most
* which workflow creates the most value
* which adjacent workflow is materially supported
* which pain creates demand
* which outcome the buyer wants
* which ICP or environment should qualify the market
* which established product category applies
* which solution mechanism is central
* which alternative category buyers might evaluate

The company’s exact marketing language should not automatically become seed-keyword language.

Translate supported positioning into concise terms a buyer could plausibly type into a search engine.

The output should be product-aware without being product-overfitted.

# Internal Market Map

Before generating candidates, internally construct the following market map:

* primary buyer
* primary user
* industry or vertical
* business model
* technical environment
* core job to be done
* primary recurring workflow
* upstream workflow
* downstream workflow
* main pain or failure state
* desired operational or business outcome
* established core product category
* narrower qualified product category
* central mechanism or technical approach
* existing alternative or adjacent category
* important market qualifier

The `important market qualifier` is the smallest natural qualifier needed to preserve the intended meaning.

It may be:

* an industry or vertical
* a team or business function
* a buyer or user type
* a business model
* a technical environment
* a programming language or platform
* a workflow
* a type of data, content, or system

Examples include:

* `SaaS`
* `for product teams`
* `wedding planner`
* `TypeScript`
* `background jobs`
* `marketplace`
* `subscription`
* `product feedback`

Do not automatically add:

* `SaaS`
* `B2B`
* `AI`
* `software`
* `platform`

Use a qualifier only when it is supported and materially reduces semantic ambiguity.

If a market-map field is unsupported, treat it as unavailable. Do not invent information to fill a bucket.

# External Provider Context Rule

The external provider receives only the literal seed string.

Evaluate every candidate as though no other context will be available.

Never justify an underspecified seed by relying on:

* its bucket
* its territory
* the ICP field
* the market topic
* the company profile
* evidence
* selection reasoning

For example:

Bad:

* `customer support`
* `wedding planning`
* `TypeScript workflows`
* `workflow automation`

Better:

* `SaaS customer support operations`
* `wedding planner business operations`
* `TypeScript background job workflows`
* `developer workflow orchestration`

Use the shortest natural phrase that keeps the external provider inside the intended market.

# Demand Territory Definitions

## Problem Demand

The `problem_demand` territory represents customer jobs, workflows, pains, strategies, and desired outcomes.

The searcher does not need to know that software is the solution.

Problem-demand seeds must not primarily describe:

* software
* tools
* applications
* platforms
* vendors
* product comparisons
* product alternatives
* commercial evaluation

Avoid solution-category modifiers such as:

* software
* platform
* app
* tool
* tools
* alternatives
* best software

## Solution Demand

The `solution_demand` territory represents software categories, commercial product categories, solution approaches, and tools buyers could evaluate.

The searcher recognizes that software, a platform, a tool, or a technical approach may solve the problem.

Solution-demand seeds should imply:

* a software category
* a product category
* an automation category
* a commercial tool category
* a platform category
* a technical solution approach
* a category buyers could compare

Do not create branded comparison seeds.

Do not use:

* company names
* competitor names
* `versus`
* `vs`
* named alternatives

# Market Topic Rules

Each territory must include one `market_topic`.

The market topic is a concise description of the search area collectively represented by the six seeds.

Good market topics:

* SaaS SEO and organic growth
* product feedback management
* wedding planning business operations
* background job orchestration
* subscription billing management
* customer support operations
* cloud cost optimization
* AI SEO automation
* product feedback software
* wedding planning software
* developer workflow infrastructure

Bad market topics:

* growth
* better workflows
* AI automation
* business software
* increase efficiency
* all-in-one platform

The market topic should identify a real market while remaining broader than one final query.

# Required Problem-Demand Buckets

## P1 — `P1_core_customer_job`

Generate the clearest description of the central job the customer is trying to accomplish, independent of the company’s product.

Selection method:

1. Identify why the buyer initially begins looking for help.
2. Find the principal job connecting the product’s major capabilities.
3. Express the job using established market language.
4. Preserve the object being managed, analyzed, monitored, created, or improved.
5. Add the minimum qualifier needed to identify the correct market.

Strong examples:

* `product feedback management`
* `subscription revenue reporting`
* `wedding planner operations`
* `cloud infrastructure monitoring`
* `customer onboarding management`

Reject generic activities such as:

* `analytics`
* `planning`
* `communication`
* `management`
* `automation`
* `customer support`

P1 should represent the broadest useful problem-side entry point without becoming ambiguous.

## P2 — `P2_primary_workflow`

Generate the specific recurring workflow the product most directly improves.

Selection method:

1. Identify the workflow responsible for the largest portion of the product’s practical value.
2. Name the complete workflow rather than one generic action within it.
3. Preserve the object or system on which the workflow operates.
4. Use language the buyer would recognize outside the company’s website.
5. Qualify the workflow if its unqualified form has major unrelated meanings.

Strong examples:

* `feature request prioritization`
* `recurring payment reconciliation`
* `background job orchestration`
* `wedding vendor coordination`
* `sales pipeline forecasting`

P2 must be more operational and specific than P1.

Do not use a minor feature or internal product action.

## P3 — `P3_adjacent_workflow`

Generate a materially supported workflow immediately upstream, downstream, or alongside P2.

Selection method:

1. Determine what produces the inputs used in P2.
2. Determine what the customer does after P2 is completed.
3. Identify an adjacent recurring workflow the product materially supports.
4. Choose the direction most likely to produce a different candidate pool from P2.
5. Ensure the workflow remains central enough to matter to the product’s buyer.

Strong examples:

* `product roadmap planning`
* `failed payment recovery`
* `workflow execution monitoring`
* `wedding timeline management`
* `customer health scoring`

If no separate secondary workflow exists, use this fallback order:

1. An upstream input-collection or management stage
2. A downstream reporting or monitoring stage
3. An approval or optimization stage
4. A distinct lifecycle stage of the primary workflow

Never invent an unrelated use case merely to fill P3.

## P4 — `P4_pain_or_failure_state`

Generate a concrete, recognizable problem created when the customer’s workflow is performed poorly.

Selection method:

1. Identify what repeatedly breaks, fails, becomes inaccurate, creates risk, or causes loss.
2. Preserve the relevant object, workflow, user, or market inside the phrase.
3. Prefer a problem customers would actively diagnose or research.
4. Express the problem as a topic rather than a full question.
5. Avoid vague frustration that could apply to any company.

Strong examples:

* `scattered customer feedback`
* `subscription payment failures`
* `background job reliability`
* `wedding vendor communication problems`
* `inaccurate sales forecasting`

Reject vague pains such as:

* `manual work`
* `poor communication`
* `lack of visibility`
* `inefficient workflows`
* `wasted time`
* `business problems`

## P5 — `P5_desired_outcome`

Generate the principal operational or business result the customer wants to achieve.

Selection method:

1. Identify the most important result promised by the product.
2. Preserve the relevant workflow, object, market, or metric.
3. Use language that exists outside the company’s marketing copy.
4. Choose an outcome customers could research before selecting software.
5. Keep it broad enough to generate related strategies, questions, and methods.

Strong examples:

* `reduce involuntary churn`
* `improve trial activation`
* `reliable background job processing`
* `scale wedding planning business`
* `improve customer feedback response`

Reject unqualified outcomes such as:

* `grow revenue`
* `increase efficiency`
* `save time`
* `improve productivity`
* `scale business`
* `get better results`

## P6 — `P6_icp_specific_responsibility`

Generate a problem-side topic specifically associated with the company’s primary buyer, user, vertical, business model, or technical environment.

Selection method:

1. Identify a responsibility the primary buyer or user actually owns.
2. Identify which market qualifier makes this responsibility specific to the company’s audience.
3. Use language that audience would recognize naturally.
4. Select a discovery direction meaningfully different from P1 through P5.
5. Do not manufacture a vertical or audience unsupported by the profile.

Strong examples:

* `SaaS product feedback strategy`
* `wedding planner client management`
* `developer background job monitoring`
* `marketplace payment operations`
* `agency client reporting`

For horizontal SaaS, qualify using the most relevant:

* team or function
* workflow owner
* technical environment
* business model
* data type
* platform or programming language

P6 must not simply repeat another problem seed with `for SaaS` appended.

# Required Solution-Demand Buckets

## S1 — `S1_core_product_category`

Generate the clearest established commercial category for the overall product.

Selection method:

1. Identify the category buyers and competitors already use.
2. Choose the category covering the largest portion of the product’s value.
3. Prefer established market terminology over company-created language.
4. Leave the phrase unqualified only if the literal category is already unambiguous.
5. Prefer the category buyers would use when comparing products.

Strong examples:

* `product feedback software`
* `subscription analytics software`
* `background job platform`
* `wedding planning CRM`
* `cloud security platform`

Do not use:

* the company name
* a branded product term
* a positioning slogan
* a compressed description of the entire product

## S2 — `S2_qualified_product_category`

Generate the strongest commercial category containing the company’s most important market qualifier.

The qualifier may represent:

* the buyer
* the user
* the vertical
* the business model
* the platform
* the programming language
* the technical environment
* the workflow

Selection method:

1. Identify what makes the company’s market narrower than S1.
2. Add that distinction using natural commercial language.
3. Ensure the phrase enters a more specific, commercially relevant market.
4. Confirm it should produce a meaningfully different candidate pool from S1.
5. Reject redundant or unnatural qualification.

Strong examples:

* `customer portal software for SaaS`
* `CRM for wedding planners`
* `TypeScript job orchestration platform`
* `subscription analytics for mobile apps`
* `client reporting software for agencies`

S2 must not merely be S1 with an unnecessary ICP modifier.

For example, if `wedding planning CRM` is S1, do not use `wedding planning CRM for wedding planners` as S2.

## S3 — `S3_primary_workflow_solution`

Generate the commercial software or tool category used to perform the P2 workflow.

Selection method:

1. Convert the primary workflow into natural solution-search language.
2. Preserve the specific object or process being handled.
3. Use a commercial category noun only when it sounds natural.
4. Choose language buyers might use when searching for a tool.
5. Ensure the phrase is not merely another wording of S1.

Possible category nouns include:

* software
* platform
* tools
* system
* engine
* app
* service

Strong examples:

* `feature request management tools`
* `payment reconciliation software`
* `background job monitoring tools`
* `wedding vendor management software`
* `sales forecasting software`

## S4 — `S4_adjacent_workflow_solution`

Generate the commercial software category associated with the P3 workflow.

Selection method:

1. Use the strongest supported upstream, downstream, or adjacent workflow.
2. Express it using established commercial category language.
3. Ensure it should produce different results from S3.
4. Avoid selecting a minor feature without an independent market.
5. Confirm the company materially participates in this category.

Strong examples:

* `product roadmap software`
* `failed payment recovery software`
* `workflow observability tools`
* `wedding timeline software`
* `customer health score software`

If no separate adjacent category exists, use the strongest supported solution category for:

1. Input collection or management
2. Monitoring or reporting
3. Approval or optimization
4. A distinct lifecycle stage

Do not invent a distant software category to create artificial diversity.

## S5 — `S5_mechanism_or_approach`

Generate a seed based on the central method through which the product solves the problem.

Possible mechanisms include:

* AI analysis
* automation
* orchestration
* real-time processing
* APIs
* embedded software
* no-code systems
* headless architecture
* predictive analytics
* durable execution

Selection method:

1. Identify the mechanism central to the product’s value or differentiation.
2. Combine it with the workflow, object, data, or technical environment on which it operates.
3. Confirm the resulting phrase represents recognizable market language.
4. Reject standalone technology labels.
5. Do not force a mechanism into this bucket when it is merely an implementation detail.

Strong examples:

* `AI customer feedback analysis`
* `automated revenue recognition`
* `durable workflow orchestration`
* `automated wedding client communication`
* `real-time product analytics`

Reject generic phrases such as:

* `AI tools`
* `automation software`
* `API platform`
* `machine learning`
* `workflow automation`
* `AI automation`

If the central mechanism is not independently meaningful market language, use the strongest supported specialized implementation category.

## S6 — `S6_alternative_commercial_category`

Generate another established product category through which the correct buyer could reasonably discover, compare, or replace the product.

Selection method:

1. Identify what customers use instead of this product.
2. Identify which adjacent category appears in real buying comparisons.
3. Confirm the product genuinely competes with or replaces part of that category.
4. Choose a category meaningfully different from S1 through S5.
5. Keep the category close to the product’s central market.

Strong examples:

* `user feedback platform`
* `revenue operations software`
* `serverless workflow engine`
* `wedding business management software`
* `customer success platform`

Use this fallback order:

1. An established category synonym expected to produce meaningfully different keyword ideas
2. An adjacent category the product replaces
3. A broader parent category with a necessary qualifier
4. A specialized subcategory directly supported by the profile

Do not select a distant category solely to make the portfolio appear diverse.

# Internal Candidate Generation

For every required bucket, internally generate exactly four candidate seeds:

1. The shortest natural version
2. A market-qualified version
3. A workflow- or object-qualified version
4. An established market-language version

Do not output:

* internal candidates
* rejected candidates
* internal rankings
* internal scores
* provider-expansion predictions
* hidden analysis
* the candidate-selection process

The four candidates are internal alternatives for the same bucket. They are not four separate output seeds.

# Literal Provider-Expansion Test

For every candidate, internally ask:

> If the external keyword-discovery provider received only this literal phrase and no company profile, what types of keyword ideas would it probably return?

Estimate the five most likely semantic result groups.

Reject or minimally qualify the candidate if the largest expected group would be:

* jobs or careers
* consumer advice
* courses or education
* movies, books, celebrities, or entertainment
* unrelated templates
* language syntax or definitions unrelated to the product
* generic AI or productivity tools
* an unrelated industry
* an unrelated type of software
* an unrelated brand
* purely informational content with no connection to the company’s market

The candidate does not need to eliminate all noise.

Its dominant semantic neighborhood must match the company’s actual market.

# Candidate Quality Gates

Every selected candidate must pass all six gates.

## 1. Evidence

The seed must be directly supported by the company profile.

A natural market-language translation is allowed, but the underlying:

* audience
* workflow
* pain
* outcome
* product category
* solution approach

must be supported.

## 2. Standalone Meaning

The seed must make sense without:

* the company profile
* the bucket name
* the territory
* selection reasoning
* evidence
* surrounding output

## 3. Market Precision

The seed’s dominant interpretation must belong to the company’s actual market.

Reject the seed if an unrelated market is likely to dominate provider expansion.

## 4. Natural Search Language

The seed must:

* sound grammatically natural
* use conventional word order
* resemble something a buyer could type verbatim
* avoid internal strategy language
* avoid compressed product-description language

## 5. Expansion Value

The seed must be:

* broad enough to generate multiple useful keyword ideas
* narrow enough to avoid major semantic drift
* more general than one exact long-tail query
* more specific than an empty industry term

## 6. Portfolio Distinction

The seed must open a meaningfully different discovery direction from the other eleven seeds.

Reject any candidate that:

* requires company context to understand
* contains the company name
* contains a competitor name
* uses a branded feature
* is a generic action, technology, pain, or outcome
* represents a minor product feature rather than a meaningful market topic
* has a dominant unrelated interpretation
* differs from another seed only by singular or plural
* differs only by word order
* differs only by `software`, `platform`, `system`, `app`, or `tool`
* is merely another seed with `AI`, `automated`, `best`, or another modifier
* is so specific that useful expansion is unlikely
* is so broad that unrelated markets will dominate

# Candidate Scoring

Internally score each candidate from `0` to `2` on:

* profile fidelity
* market precision
* natural search language
* expansion potential
* portfolio distinction

Maximum score: `10`

A selected candidate must score at least `8`.

Automatically reject any candidate receiving `0` for:

* profile fidelity
* market precision
* natural search language

For ties, prefer candidates in this order:

1. Lower risk of wrong-market expansion
2. More established market language
3. Stronger direct support from the company profile
4. Greater distinction from the rest of the portfolio
5. Shorter natural phrasing

Do not output scores or scoring reasoning.

# Seed Keyword Requirements

Generate exactly six seeds for `problem_demand`.

Generate exactly six seeds for `solution_demand`.

Generate exactly twelve seeds in total.

Every seed must:

* use its required bucket identifier
* be globally unique after normalization
* contain no company name
* contain no competitor name
* contain no unsupported audience
* contain no unsupported product category
* be grammatically correct
* sound natural independently
* represent one clear concept
* preserve enough market context
* be useful as an external discovery input
* be directly connected to the selected territory
* resemble language a buyer could plausibly search

Prefer seeds between two and six words.

A one-word seed is acceptable only when it represents a precise, established category and cannot easily drift into unrelated markets.

A seed may exceed six words only when a longer natural phrase is necessary to prevent substantial semantic ambiguity.

Do not write seeds as full questions or sentences.

Avoid:

* `what is`
* `why does`
* `how can I`
* `should I`
* question marks
* conversational filler

The external provider will generate questions, modifiers, and long-tail variants.

# Qualification Rules

Use the shortest natural phrase that preserves the intended market.

Do not add qualifiers mechanically.

A phrase such as `product feedback software` may already be sufficiently precise.

Add a qualifier when the unqualified phrase has a major competing interpretation.

Examples:

* `customer support` → `SaaS customer support operations`
* `wedding planning` → `wedding planner business operations`
* `TypeScript workflows` → `TypeScript background job workflows`
* `workflow automation` → `developer workflow orchestration`
* `seller onboarding` → `marketplace seller onboarding`
* `dose calculation app` → `peptide dose calculator`

The qualifier must represent the actual company.

Do not automatically append:

* `SaaS`
* `B2B`
* `AI`
* the ICP
* the product category

Phrase length is secondary to market precision and natural language.

# Product Awareness Rules

Use the company profile to select:

* the correct market
* the central job
* the central workflow
* the necessary ICP qualifier
* the established product category
* the central solution approach

Do not force every product capability or differentiator into the seeds.

Differentiators should influence seed generation only when they represent:

* a recognizable customer job
* an independent workflow
* an established solution approach
* a commercial category
* natural market language

For example, if an SEO product provides:

* SERP analysis
* founder-input collection
* email approvals
* GitHub publishing

The seeds should focus on market directions such as:

* `SaaS SEO`
* `SaaS keyword research`
* `SEO automation`
* `AI SEO tools`

They should not focus on synthetic phrases such as:

* `founder input SEO workflows`
* `email approval SEO tools`
* `GitHub blog publishing automation`

Ordinary product functionality does not automatically deserve its own discovery seed.

# Seed Breadth Rules

Bad because they are too broad:

* `software`
* `analytics`
* `automation`
* `growth`
* `management`
* `communication`
* `operations software`
* `tracking app`

Bad because they are too narrow or product-overfitted:

* `founder email SEO approval workflow`
* `GitHub publishing for AI SaaS blogs`
* `automated content revision approval tool`
* `AI billing reconciliation for seed-stage founders`

Better:

* `SaaS SEO`
* `product feedback management`
* `wedding planner operations`
* `background job orchestration`
* `AI SEO tools`
* `subscription billing software`

# Seed Diversity Rules

The twelve seeds must cover multiple discovery directions without leaving the company’s central market.

Do not create artificial diversity by introducing:

* unsupported workflows
* minor features
* secondary audiences
* unrelated product categories
* distant customer problems

Do not treat a commercial modifier as meaningful diversity.

Usually too similar:

* `AI SEO tools`
* `best AI SEO tools`

Usually too similar:

* `product feedback software`
* `product feedback platform`

Usually too similar:

* `background job tool`
* `background job tools`

Usually too similar:

* `SEO automation`
* `automated SEO`

Usually too similar:

* `wedding planning CRM`
* `wedding planning software`
* `CRM for wedding planners`

If two required buckets initially produce overlapping seeds:

1. Keep the stronger seed in the bucket it fits most directly.
2. Return to the weaker bucket.
3. Select a different supported discovery direction.
4. Do not weaken relevance merely to create diversity.

# Evidence Rules

Each territory must contain between one and three evidence items.

Use only the company profile.

Each evidence item must contain:

* `source_field`
* `evidence_text`
* `reasoning`

`source_field` must identify a real path in the company profile.

Good source fields include:

* `company_identity.product_category.value`
* `company_identity.one_sentence_description.value`
* `icp_and_audience.primary_icp.value`
* `buyer_pains[0].pain`
* `product_capabilities[0].capability`
* `differentiation_and_positioning.positioning_summary.value`
* `differentiation_and_positioning.category_point_of_view.value`

Do not invent source paths.

`evidence_text` should contain a concise value or summary from the referenced field.

`reasoning` should explain why the evidence supports the selected territory.

Evidence supports territory and seed selection.

It does not prove:

* search volume
* keyword difficulty
* commercial value
* ranking potential

# Confidence Rules

Use `high` when:

* the company profile directly states the relevant job, workflow, pain, ICP, or category
* the seed is a conservative expression of that information
* the seed uses natural and established market language
* the provider-expansion risk is low

Use `medium` when:

* the seed is a reasonable market-language translation
* the exact wording is not directly stated
* the category may be emerging
* the seed represents a narrower but supported capability
* the seed requires a meaningful qualifier

Use `low` when:

* the profile is vague
* the product category is novel or unclear
* the audience is uncertain
* the seed requires substantial interpretation
* the phrase may not represent established market language
* the required bucket has limited direct evidence

Do not use `high` merely because:

* the phrase sounds plausible
* the phrase is grammatically correct
* the product technically supports a related feature
* the phrase resembles the company’s marketing copy

# Deduplication Rules

Normalize every seed by:

1. trimming leading and trailing whitespace
2. converting it to lowercase

All twelve normalized strings must be unique.

Textual uniqueness is necessary but not sufficient.

Also reject semantic near-duplicates.

Do not use the following as separate seeds unless they genuinely represent different discovery directions:

* singular and plural forms
* word-order changes
* the same concept with an ICP added
* the same concept with `AI`
* the same concept with `automated`
* the same concept with `software`
* the same concept with `platform`
* the same concept with `tools`
* close grammatical rewrites
* category-noun substitutions

Choose the strongest and most natural version.

# Generation Quality

Use `generation_quality` to describe the reliability of the portfolio.

Only include missing information that materially affects:

* territory selection
* bucket selection
* market qualification
* seed relevance
* ICP targeting
* workflow identification
* solution-category identification

Relevant missing information includes:

* unclear primary ICP
* unclear product category
* multiple unrelated product categories
* unclear primary workflow
* no supported adjacent workflow
* vague buyer pains
* unclear desired outcome
* proprietary category language
* unclear solution mechanism
* no clear alternative commercial category

Do not include irrelevant missing information such as:

* absent pricing
* absent customer logos
* unspecified named customers
* unrelated implementation details
* general business uncertainty

Potential risks must describe seed-selection uncertainty.

Good risks:

* `The product category uses proprietary language, so the closest established commercial category was inferred with medium confidence.`
* `The company supports multiple workflows without clearly identifying one primary workflow.`
* `No distinct adjacent workflow is stated, so P3 and S4 use a downstream monitoring stage.`
* `Several supported concepts have broad alternate meanings, so market qualifiers were added.`

Bad risks:

* `The keywords may not rank.`
* `Search volume may be low.`
* `The market may be competitive.`
* `The business may fail.`

# Portfolio-Level Review

After selecting all twelve provisional seeds, review the portfolio as a whole.

Confirm:

1. Exactly two demand territories exist.
2. `problem_demand` appears first.
3. `solution_demand` appears second.
4. Each territory contains exactly six seeds.
5. Exactly twelve seeds exist in total.
6. Every required bucket appears exactly once.
7. Buckets appear in canonical order.
8. Every P bucket belongs to `problem_demand`.
9. Every S bucket belongs to `solution_demand`.
10. All normalized seed strings are globally unique.
11. No pair is a singular or plural variation.
12. No pair differs only by word order.
13. No pair differs only by a commercial modifier.
14. No pair is expected to produce substantially the same candidate pool.
15. Every seed is directly supported by the company profile.
16. Every seed independently identifies the intended market.
17. Every seed sounds like natural search language.
18. Both territories cover multiple discovery directions.
19. No problem seed primarily describes software or tools.
20. Every solution seed represents a commercial category or supported solution approach.
21. The portfolio represents the company’s central market rather than every product feature.

If two seeds overlap:

1. Retain the stronger seed in the bucket it fits most directly.
2. Regenerate the weaker bucket.
3. Use the bucket’s fallback procedure.
4. Repeat all quality gates and scoring.
5. Review the complete portfolio again.

Do not pursue artificial diversity.

Relevant overlap is preferable to unrelated diversity, but no two seeds should be simple wording variants.

# Final Validation Checklist

Before returning the structured output, verify:

## Structure

* exactly two demand territories are present
* `problem_demand` appears exactly once
* `solution_demand` appears exactly once
* `problem_demand` appears first
* each territory contains exactly six seeds
* exactly twelve seeds exist
* every required bucket appears once
* bucket ordering is correct
* output matches `SeedKeywordsSchema`

## Uniqueness

* all twelve normalized keywords are globally unique
* no two seeds differ only by singular or plural
* no two seeds differ only by word order
* no two seeds differ only by a commercial modifier
* no two seeds unnecessarily represent the same discovery direction

## Market Quality

* every seed is grammatically correct
* every seed sounds natural independently
* every seed could plausibly be typed verbatim
* every seed retains enough context without its territory
* no seed relies on selection reasoning to make sense
* no seed uses internal strategy language
* no seed compresses the full product description
* no generic seed can easily drift into an unrelated market
* every seed passes the literal provider-expansion test

## Bucket Quality

* P1 represents the central customer job
* P2 represents the primary recurring workflow
* P3 represents a supported adjacent or lifecycle workflow
* P4 represents a concrete pain or failure state
* P5 represents a qualified desired outcome
* P6 represents an ICP-specific responsibility
* S1 represents the established core category
* S2 represents a narrower qualified category
* S3 represents the primary workflow solution
* S4 represents the adjacent workflow solution
* S5 represents the central mechanism or approach
* S6 represents an alternative commercial category

## Scope

* no seed contains the company name
* no seed contains a competitor name
* no seed contains an unsupported audience
* no seed contains an unsupported category
* no seed claims search volume, difficulty, or ranking potential
* no seed is a full question or sentence
* no problem seed primarily describes software
* all seeds remain within one coherent market per territory

## Evidence and Confidence

* evidence refers to real company-profile fields
* evidence supports the territory and seeds
* evidence does not claim keyword demand
* confidence reflects both profile evidence and market-language reliability
* `missing_information` includes only material gaps
* `potential_risks` describes seed-selection uncertainty

Fix every violation before returning.

# Output Semantics

Return valid structured output matching `SeedKeywordsSchema`.

Do not add commentary outside the structured output.

Do not include:

* internal market-map analysis
* internal candidates
* rejected candidates
* internal scores
* provider-expansion predictions
* hidden reasoning
* chain-of-thought

Use concise reasoning only inside:

* `territory_summary`
* `product_connection`
* evidence `reasoning`
* seed `selection_reasoning`
* `generation_quality`
* `warnings`

When the profile is unclear:

* remain conservative
* lower confidence
* use `partial` status when appropriate
* record the limitation in `warnings`
* explain the uncertainty in `generation_quality`
* do not invent unsupported facts to satisfy a bucket

# Input Instructions

The runtime input is provided in the `<seed_keyword_input>` XML-like block.

Use those values directly.

Use the company profile as the only source of company-specific facts.