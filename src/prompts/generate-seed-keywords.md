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

# Developer Instructions

# Task

Generate a structured seed-keyword strategy from a validated company profile.

Your job is to identify:

- one primary problem-demand territory
- one primary solution-demand territory
- exactly six seed keywords for each territory
- exactly twelve seed keywords in total

The seed keywords will be submitted to an external keyword-discovery provider that returns observed keyword ideas, search volume, keyword difficulty, search intent, CPC, and average ranking-domain metrics.

The external provider receives only the literal seed-keyword strings.

It does not receive:

- the company profile
- territory names
- territory summaries
- the primary ICP
- product connections
- evidence
- selection reasoning
- surrounding output context

Every seed must therefore contain enough market context to function as an independent keyword-discovery input.

Seed keywords are discovery inputs. They are not final target keywords, article titles, content clusters, pillar pages, or SEO recommendations.

Do not generate:

- final search queries
- long-tail query lists
- content clusters
- pillar pages
- supporting pages
- blog-post recommendations
- comparison pages
- article titles
- content briefs
- SERP analysis
- opportunity scores
- traffic estimates

Do not estimate or claim:

- search volume
- keyword difficulty
- CPC
- ranking potential
- traffic potential
- domain authority
- SERP weakness
- keyword popularity

# Runtime Input

The runtime input contains:

- `schema_version`
- `run_id`
- `generated_at`
- `company_profile`

Expected runtime input format:

    <seed_keyword_input>
      <schema_version>{schemaVersion}</schema_version>
      <run_id>{runId}</run_id>
      <generated_at>{generatedAt}</generated_at>

      <company_profile>
        {companyProfile as JSON}
      </company_profile>
    </seed_keyword_input>

Use the company profile as the only source of company-specific facts.

General knowledge may be used to express a supported product category, customer problem, or solution approach in natural market language.

Do not use general knowledge to invent unsupported:

- company facts
- audiences
- capabilities
- integrations
- competitors
- positioning
- geographic markets
- product categories

# Top-Level Output Rules

Copy the following values directly from the runtime input:

- `schema_version`
- `run_id`
- `generated_at`

Set:

- `source_artifacts` to exactly `["company-profile.json"]`
- `status` to `complete` when both territories can be generated with sufficient evidence
- `status` to `partial` when the company profile is materially unclear but a conservative strategy can still be produced
- `warnings` to an empty array unless there is a material seed-generation limitation
- `website_url` from `company_profile.website_url`

Populate `source_profile` from:

- `company_identity.company_name.value`
- `company_identity.product_category.value`
- `icp_and_audience.primary_icp.value`

Return exactly two items in `demand_territories`.

Return them in this order:

1. `problem_demand`
2. `solution_demand`

Do not generate additional territories.

# Seed Strategy Goal

The seed strategy should provide focused entry points into the company’s real search market.

The company profile should determine:

- which customer problem matters most
- which desired outcome matters most
- which ICP should qualify the topic
- which solution category the product belongs to
- which product approach is central to the solution

The company’s exact marketing language should not automatically become seed-keyword language.

Translate supported company positioning into concise terms a buyer could plausibly type into a search engine.

The output should be product-aware without being product-overfitted.

The seed set should maximize useful market coverage rather than simply produce six grammatical variations of the same phrase.

# External Provider Context Rule

The external keyword-discovery provider receives only the seed strings.

Never justify an underspecified seed by claiming that context will be supplied by:

- the territory
- the ICP field
- the market topic
- the product connection
- the evidence
- the company profile

For example, if the company serves marketplace operators:

Bad:

- seller onboarding
- trust and safety operations
- AI operations software

These phrases can belong to many unrelated markets.

Better:

- marketplace seller onboarding
- marketplace trust and safety
- AI for marketplace operations

If the company serves adults managing peptide protocols:

Bad:

- dose calculation app
- biomarker tracking app
- protocol tracking software

Better:

- peptide dose calculator
- peptide biomarker app
- peptide protocol tracker

Every seed must be evaluated as though it were submitted to the provider alone.

# Demand Territory Definitions

## Problem Demand

The `problem_demand` territory represents the fundamental problem, job, process, or desired outcome the product helps its primary ICP address.

The searcher does not need to know that the company’s product or any software product is the solution.

The problem territory should usually represent:

- a task the ICP needs to complete
- a problem the ICP needs to solve
- a process the ICP needs to improve
- a strategy the ICP needs to understand
- an outcome the ICP wants to achieve
- an area in which the ICP needs education or guidance

Problem demand should be broader than one product feature.

Do not define the problem territory around:

- the company’s interface
- its publishing method
- its approval system
- one supporting feature
- an internal workflow detail
- a proprietary term
- a marketing slogan

For an AI SEO product serving SaaS companies:

Good problem territory:

- SaaS SEO and organic growth

Bad problem territories:

- email-native content approvals
- GitHub blog publishing
- founder-question workflows
- automated brief generation

Those may be differentiators or capabilities, but they are not the fundamental market problem.

## Solution Demand

The `solution_demand` territory represents the established solution category, product approach, or type of software that buyers could evaluate to solve the problem.

The searcher understands that a product, tool, platform, application, service, or automated approach may be the solution.

The solution territory should usually represent:

- the product’s main software category
- a recognized automation category
- the central product approach
- a category buyers could compare
- a category buyers could look for tools within

The solution territory should not be:

- the company name
- a proprietary category invented by the company
- a list of disconnected features
- a positioning slogan
- an exact description of the entire product workflow

For an AI SEO product serving SaaS companies:

Good solution territory:

- AI SEO tools and SEO automation

Bad solution territories:

- founder-informed email-native SEO publishing
- automated brief approval and GitHub delivery
- personalized search-landscape execution system

The bad examples describe the product but do not represent established solution-category language.

# Territory Selection Rules

Select the single strongest problem territory and single strongest solution territory.

Prioritize:

- direct relevance to the primary ICP
- direct connection to the core product
- support from the company profile
- breadth sufficient for keyword discovery
- specificity sufficient to avoid unrelated markets
- established and understandable market language

Do not create multiple territories because the company has multiple features.

If the company has several capabilities, identify the central customer problem and central product category connecting those capabilities.

If the company genuinely serves multiple unrelated products or audiences:

- prioritize the product and audience most strongly supported by core positioning
- mention the ambiguity in `warnings`
- lower `generation_quality.overall_confidence`
- describe the excluded ambiguity in `potential_risks`

Do not combine unrelated customer problems into one vague territory.

# Market Topic Rules

Each territory must include one `market_topic`.

The market topic is a concise description of the search area that the seeds collectively define.

Good market topics:

- SaaS SEO and organic growth
- peptide protocol management
- marketplace operations and growth
- subscription billing management
- customer support operations
- cloud cost optimization
- AI SEO automation
- peptide tracking apps
- marketplace operations software
- subscription billing software

Bad market topics:

- growth
- better workflows
- AI automation
- business software
- all-in-one platform
- increase efficiency

The market topic should be specific enough to identify a real market while remaining broader than one long-tail query.

# Product Awareness Rules

Use the company profile to select the right market, ICP qualifier, and solution category.

Do not force every product capability or differentiator into the seed keywords.

Differentiators should usually influence later content positioning, not initial keyword discovery.

For example, if the company provides:

- SEO automation
- founder-input collection
- email approvals
- GitHub publishing

The seeds should focus on:

- SaaS SEO
- SaaS keyword research
- AI SEO tools
- SEO automation

The seeds should not focus on:

- founder-input SEO workflows
- email approval SEO tools
- GitHub blog publishing automation

A seed may reflect a specific product approach when that approach is itself recognizable market language.

Examples:

- billing automation
- support automation
- SEO automation
- product analytics
- cloud cost optimization

A product capability may also become a seed when:

- it represents a recognizable customer job
- it is independently searchable
- it remains clearly connected to the company’s market
- it is not ordinary internal product functionality

# Internal Candidate Selection

Before producing the final structured output:

1. Internally generate at least ten candidate seeds for each territory.
2. Evaluate each candidate against all seed-quality rules.
3. Remove candidates that are:
   - unnatural
   - grammatically incorrect
   - underspecified
   - context-dependent
   - redundant
   - product-invented
   - excessively broad
   - excessively narrow
   - unsupported by the company profile
4. Select the strongest six candidates for each territory.
5. Output only the selected six seeds per territory.

Do not output:

- rejected candidates
- internal rankings
- internal analysis
- hidden reasoning
- the candidate-selection process

The requirement to generate six seeds does not justify using filler.

If the sixth seed requires more interpretation than the others:

- keep it conservative
- assign an appropriate confidence level
- explain the limitation in `generation_quality`
- do not invent unnatural market language

# Seed Keyword Requirements

Generate exactly six seed keywords for `problem_demand`.

Generate exactly six seed keywords for `solution_demand`.

Generate exactly twelve seed keywords in total.

Every seed keyword must:

- be globally unique after trimming whitespace and converting to lowercase
- contain no company name
- contain no competitor name
- contain no unsupported audience
- contain no unsupported product category
- be grammatically correct
- sound natural when read independently
- represent one clear concept
- be useful as an external keyword-discovery input
- be supported by the selected territory
- be understandable without additional context
- preserve enough market context to avoid obvious category drift
- resemble language a buyer could plausibly type verbatim

Prefer seeds between two and five words.

A one-word seed is acceptable only when it represents a precise, established category and is not excessively broad.

Avoid seeds longer than six words.

Do not write seeds as full questions or sentences.

Avoid:

- what is
- why does
- how can I
- should I
- question marks
- conversational filler

The external keyword-discovery provider will generate observed questions, how-to queries, modifiers, and long-tail variants from the seeds.

# Standalone Seed Test

Evaluate every candidate seed using this test:

> If this seed were submitted to the external keyword-discovery provider without any other information, would the returned ideas likely remain inside the company’s intended market?

Reject the seed when the answer is no.

Examples:

Bad:

- organic visibility
- seller onboarding
- dose calculation app
- biomarker tracking app
- protocol tracking software
- AI operations software

Better:

- SaaS organic visibility
- marketplace seller onboarding
- peptide dose calculator
- peptide biomarker app
- peptide protocol tracker
- AI for marketplace operations

A broad phrase is acceptable when it is itself the company’s established market category.

For example:

- customer onboarding
- subscription billing
- product analytics
- cloud cost optimization

Do not add qualifiers mechanically when the unqualified phrase already represents a precise and relevant category.

# Natural Search-Language Test

Every candidate seed should pass all of the following tests:

- A buyer could plausibly type the phrase into Google.
- The phrase is grammatically correct.
- The phrase does not sound like an internal strategy label.
- The phrase does not sound like a compressed product description.
- The phrase does not depend on its selection reasoning to make sense.
- The phrase does not require knowledge of the company’s website.
- The phrase uses a conventional word order.

Reject phrases such as:

- search opportunity prioritization
- peptide health management
- marketplaces operations
- peptide apps for tracking
- marketplace software for operators
- founder-informed content execution workflow

Prefer phrases such as:

- SaaS keyword research
- peptide reconstitution
- marketplace operations
- peptide tracking app
- marketplace management software
- SaaS content strategy

# Seed Breadth Rules

Seeds should be broad enough to produce multiple relevant keyword ideas.

Seeds should be narrow enough to remain within the company’s actual market.

Bad because they are too broad:

- marketing
- software
- analytics
- automation
- growth
- management
- operations software
- tracking app

Bad because they are too narrow or product-overfitted:

- founder email SEO approval workflow
- GitHub publishing for AI SaaS blogs
- automated content revision approval tool
- AI billing reconciliation for seed-stage SaaS founders

Better:

- SaaS SEO
- SEO for SaaS
- SaaS organic growth
- SEO automation
- AI SEO tools
- peptide dose calculator
- marketplace seller onboarding
- subscription billing software
- customer support automation
- cloud cost optimization

# Seed Diversity Rules

The six seeds within a territory must not be six minor rewrites of the same phrase.

Together, they should define the territory from several useful entry points while remaining coherent.

Useful diversity may come from:

- the central market topic
- the ICP-qualified topic
- a major process
- a desired outcome
- an established synonym
- a recognized solution approach
- an established software category
- a supported capability with independent market demand

Do not create artificial diversity by introducing unrelated problems or categories.

Do not treat a commercial modifier as sufficient diversity.

Examples that are usually too similar:

- AI SEO tools
- best AI SEO tools

- peptide tracking app
- best peptide tracking apps

- marketplace operations software
- marketplace operations platform

- SEO automation
- AI SEO automation
- automated SEO
- SEO automation software

A modifier variant may be retained only when it represents a genuinely different established market direction and does not crowd out a more distinct seed.

# Required Problem-Demand Roles

The six `problem_demand` seeds may use only:

- `core_problem`
- `icp_qualified_problem`
- `process_or_outcome`
- `market_synonym`

The problem territory must contain at least one seed for each of these four roles.

## `core_problem`

The shortest useful description of the fundamental problem or job.

Examples:

- SaaS SEO
- peptide protocols
- marketplace operations
- subscription billing
- customer onboarding
- cloud cost optimization

## `icp_qualified_problem`

The problem or job qualified by the supported ICP or market.

Examples:

- SEO for SaaS
- peptide protocol tracking
- marketplace seller onboarding
- billing for SaaS companies
- onboarding for mobile apps
- cloud costs for startups

Do not attach the ICP to every seed unnecessarily.

However, add the relevant market qualifier when the unqualified seed would drift into unrelated markets.

## `process_or_outcome`

A supported process, strategy, or desired outcome related to the problem.

Examples:

- SaaS SEO strategy
- SaaS keyword research
- peptide dose calculation
- marketplace growth strategy
- subscription revenue recovery
- user onboarding optimization
- reduce cloud costs

Do not turn an ordinary supporting product feature into the entire customer problem.

## `market_synonym`

A distinct, understandable expression of the same market topic.

Examples:

- SaaS organic growth
- peptide protocol management
- marketplace management
- recurring billing management
- product adoption strategy
- cloud spend management

A market synonym must add a genuinely useful discovery angle.

It must not merely:

- change word order
- change singular to plural
- add an empty modifier
- replace `software` with `platform`
- repeat the same phrase unnaturally

# Required Solution-Demand Roles

The six `solution_demand` seeds may use only:

- `core_solution_category`
- `icp_qualified_solution`
- `solution_approach`
- `commercial_category`

The solution territory must contain at least one seed for each of these four roles.

## `core_solution_category`

The shortest useful description of the product’s established solution category.

Examples:

- AI SEO tools
- peptide tracking app
- marketplace operations software
- subscription billing software
- onboarding software
- cloud cost management software

## `icp_qualified_solution`

The solution category qualified by the supported ICP or market.

Examples:

- SEO tools for SaaS
- peptide protocol app
- marketplace management software
- billing software for SaaS
- onboarding tools for mobile apps
- cloud cost tools for startups

Do not qualify every seed mechanically.

Qualify seeds when qualification is necessary to preserve the intended market.

## `solution_approach`

A recognized approach through which the product solves the problem.

Examples:

- SEO automation
- peptide dose calculator
- marketplace automation
- billing automation
- onboarding automation
- cloud cost optimization tools

Use an approach supported by the product capabilities.

Do not invent a new solution approach by combining ordinary product features into a synthetic phrase.

## `commercial_category`

A concise commercial-discovery seed representing a recognizable product or tool category.

Examples:

- AI SEO software
- peptide protocol tracker
- marketplace support automation
- subscription billing platforms
- customer onboarding tools
- cloud cost management platforms

Commercial modifiers such as `best`, `top`, or `leading` should not be used merely to create another seed.

Do not include:

- company names
- competitor names
- `versus`
- `vs`
- named alternatives

# Problem-Demand Restrictions

Problem-demand seeds must not primarily describe:

- software
- tools
- applications
- platforms
- generators
- product comparisons
- vendors
- alternatives
- automation products

Avoid solution-category modifiers such as:

- software
- app
- platform
- tool
- generator
- alternatives
- versus
- best tools

A problem seed may contain a general process term such as `automation` only when automation is itself the customer problem or established subject, not when it turns the seed into a product search.

# Solution-Demand Restrictions

Solution-demand seeds should imply:

- a product category
- an automation approach
- a tool category
- a software category
- a platform category
- a commercial evaluation area

Do not create branded comparison seeds.

Do not use the company name.

Do not use competitor names.

Do not create seeds such as:

- Company A versus Company B
- Company A alternatives
- best alternatives to Company A

Competitor-specific opportunities will be handled after the competitor set is validated.

# Modifier and Redundancy Rules

Two seeds are not meaningfully distinct when one is primarily another seed plus a modifier such as:

- best
- top
- leading
- AI
- automated
- software
- tool
- tools
- app
- platform
- solution

Examples:

Too similar:

- AI SEO tools
- best AI SEO tools

Too similar:

- peptide tracking app
- peptide tracking apps
- best peptide tracking apps

Too similar:

- marketplace operations software
- marketplace operations platform

Too similar:

- SEO automation
- automated SEO

Choose the strongest version unless the modifier creates a genuinely different and established category.

The role requirements must not force semantic duplication.

# Generic Capability Qualification Rules

A feature-oriented seed must preserve the relevant market qualifier when the unqualified phrase could belong to many industries.

Reject:

- dose calculation app
- biomarker tracking app
- seller onboarding
- trust and safety operations
- protocol tracking software
- AI operations software

Prefer:

- peptide dose calculator
- peptide biomarker app
- marketplace seller onboarding
- marketplace trust and safety
- peptide protocol tracker
- AI for marketplace operations

Do not assume the provider will infer the intended industry.

# Natural Market-Language Rules

Prefer language a buyer could understand and plausibly use without knowing the company’s internal terminology.

Do not simply copy awkward website phrases.

Do not concatenate:

- multiple pains
- several capabilities
- the ICP
- the product category
- a differentiator

into one seed.

Bad:

- AI SaaS SEO content planning approval publishing tool

Better:

- SaaS SEO
- AI SEO tools
- SEO automation
- SEO tools for SaaS

Do not claim that a term is popular, high-volume, low-competition, or proven.

The seed only needs to be a strong, evidence-backed discovery hypothesis.

External keyword data will determine whether related demand exists.

# Evidence Rules

Each territory must contain between one and three evidence items.

Use only the company profile.

Each evidence item must contain:

- `source_field`
- `evidence_text`
- `reasoning`

`source_field` should identify a real path in the company profile.

Good source fields:

- `company_identity.product_category.value`
- `company_identity.one_sentence_description.value`
- `icp_and_audience.primary_icp.value`
- `buyer_pains[0].pain`
- `product_capabilities[0].capability`
- `differentiation_and_positioning.positioning_summary.value`
- `differentiation_and_positioning.category_point_of_view.value`

Do not invent source paths.

`evidence_text` should be a concise value or summary from that field.

`reasoning` should explain why the evidence supports the selected territory.

Evidence supports the territory selection. It does not prove that a seed has search volume.

# Confidence Rules

Use `high` when:

- the company profile directly states the problem, ICP, or product category
- the seed is a direct and conservative expression of that information
- the seed uses natural and established market language

Use `medium` when:

- the seed is a reasonable market-language translation
- the exact category wording is not directly stated
- the phrase is relevant but may represent an emerging category
- the seed represents a narrower supported capability

Use `low` when:

- the company profile is vague
- the product category is novel or unclear
- the audience is uncertain
- the seed requires substantial interpretation
- the phrase may not represent established market language

Do not use `high` merely because:

- the seed sounds plausible
- the seed is grammatically correct
- the product supports the feature
- the phrase resembles the company’s own copy

# Illustrative Examples

These examples demonstrate the desired level of abstraction.

Do not copy their topics unless they match the supplied company profile.

## SEO Automation Product for SaaS

Good problem-demand seeds:

- SaaS SEO
- SEO for SaaS
- SaaS SEO strategy
- SaaS organic growth
- SaaS content marketing
- SaaS keyword research

Good solution-demand seeds:

- AI SEO tools
- SEO tools for SaaS
- SEO automation
- AI SEO automation
- content brief software
- AI SEO software

Bad seeds:

- organic visibility
- search opportunity prioritization
- SEO content workflow software
- best AI SEO tools when `AI SEO tools` is already present
- founder input SEO brief software
- email-native SEO approval workflow
- GitHub publishing SEO agent

## Peptide Protocol Tracking Product

Good problem-demand seeds:

- peptide protocols
- peptide protocol tracking
- peptide dose calculation
- peptide reconstitution
- peptide inventory tracking
- peptide biomarker tracking

Good solution-demand seeds:

- peptide tracking app
- peptide protocol app
- peptide protocol tracker
- peptide dose calculator
- peptide reconstitution calculator
- peptide biomarker app

Bad seeds:

- biomarker trend tracking
- peptide health management
- peptide apps for tracking
- protocol tracking software
- dose calculation app
- biomarker tracking app
- best peptide tracking apps when `peptide tracking app` is already present

## Marketplace Operations Product

Good problem-demand seeds:

- marketplace operations
- marketplace growth strategy
- marketplace management
- marketplace seller onboarding
- marketplace trust and safety
- marketplace dispute management

Good solution-demand seeds:

- marketplace operations software
- marketplace management software
- marketplace automation
- AI for marketplace operations
- marketplace support automation
- marketplace trust and safety software

Bad seeds:

- marketplaces operations
- seller onboarding
- trust and safety operations
- marketplace software for operators
- AI operations software
- marketplace operations platform when `marketplace operations software` is already present

## Subscription Billing Product

Good problem-demand seeds:

- subscription billing
- recurring billing management
- SaaS billing
- subscription revenue recovery
- billing operations

Good solution-demand seeds:

- subscription billing software
- recurring billing platform
- billing automation
- billing software for SaaS
- subscription management tools

Bad seeds:

- finance team billing reconciliation approval workflow
- automated invoice corrections for growing SaaS companies
- founder-friendly revenue recovery dashboard

# Deduplication Rules

Normalize every seed by:

1. trimming leading and trailing whitespace
2. converting it to lowercase

All twelve normalized seed keywords must be unique.

Textual uniqueness is necessary but not sufficient.

Also reject semantic near-duplicates.

Do not use the following as separate seeds unless they represent meaningfully different concepts:

- singular and plural forms
- word-order changes
- the same phrase with an ICP word added
- the same phrase with `best`
- the same phrase with `AI`
- the same phrase with `software`
- the same phrase with `platform`
- the same phrase with `tools`
- close grammatical rewrites

Examples of semantic near-duplicates:

- marketplace operations
- marketplaces operations

- peptide tracking app
- peptide apps for tracking
- best peptide tracking apps

- AI SEO tools
- best AI SEO tools

- marketplace operations software
- marketplace operations platform

Choose the strongest and most natural version.

# Generation Quality

Use `generation_quality` to describe the reliability of the seed strategy.

Only include missing information that materially affects:

- territory selection
- market qualification
- seed relevance
- ICP targeting
- solution-category identification

Relevant missing information includes:

- unclear primary ICP
- unclear product category
- multiple unrelated product categories
- vague buyer pains
- limited product-capability evidence
- unsupported or proprietary category language
- unclear geographic or language market when materially relevant

Do not include irrelevant missing information such as:

- absent pricing
- absent customer logos
- absent named customers
- unspecified implementation details
- unspecified operating systems unless platform availability materially changes the search market
- unrelated product facts that do not affect keyword discovery

Potential risks should describe risks in seed selection, not general business risks or SEO conclusions.

Good potential risks:

- `The product category is described using proprietary language, so the closest established solution category was inferred with medium confidence.`
- `The company serves multiple audiences, but the primary ICP is not clearly prioritized.`
- `The company profile describes several workflows without identifying one central customer problem.`
- `Several capabilities use generic language, so market qualifiers were added to prevent category drift.`

Bad potential risks:

- `The keywords may not rank.`
- `The company may fail.`
- `The market is too competitive.`
- `Search volume may be low.`

Search-volume and ranking conclusions belong to later pipeline stages.

# Final Validation Checklist

Before returning the structured output, verify:

## Structure

- exactly two demand territories are present
- `problem_demand` appears exactly once
- `solution_demand` appears exactly once
- `problem_demand` appears first
- each territory contains exactly six seed keywords
- exactly twelve seed keywords exist in total
- all four required roles appear in each territory
- output matches `SeedKeywordsSchema`

## Uniqueness

- all twelve normalized seed keywords are globally unique
- no two seeds differ only by singular or plural
- no two seeds differ only by word order
- no two seeds differ only by a commercial modifier
- no two seeds represent the same discovery direction unnecessarily

## Market quality

- every seed is grammatically correct
- every seed sounds natural when read independently
- every seed could plausibly be typed verbatim by a buyer
- every seed retains enough market context without the territory
- no seed relies on selection reasoning to become understandable
- no seed uses internally constructed strategy language
- no seed merely compresses the product description
- no generic capability seed can drift into unrelated markets

## Scope

- every problem seed uses an allowed problem-demand role
- every solution seed uses an allowed solution-demand role
- no seed contains the company name
- no seed contains a competitor name
- no seed contains an unsupported audience
- no seed contains an unsupported category
- no seed claims search volume, difficulty, or ranking potential
- no seed is a full question or sentence
- no problem seed primarily describes software or a tool
- all seeds remain within one coherent market topic per territory

## Evidence and confidence

- evidence refers to real company-profile fields
- evidence supports the territory rather than claiming keyword demand
- confidence reflects the strength of both company evidence and market-language translation
- `missing_information` includes only gaps material to seed generation
- `potential_risks` describes seed-selection uncertainty rather than business or ranking risk

Fix every violation before returning.

# Output Semantics

Return a valid structured output matching `SeedKeywordsSchema`.

Do not add commentary outside the structured output.

Do not include hidden reasoning or chain-of-thought.

Use concise reasoning only inside:

- `territory_summary`
- `product_connection`
- evidence `reasoning`
- seed `selection_reasoning`
- `generation_quality`
- `warnings`

Do not fill fields with unsupported claims merely because the schema requires a value.

When the company profile is unclear:

- remain conservative
- lower confidence
- use `partial` status when appropriate
- record the limitation in `warnings`
- explain the uncertainty in `generation_quality`

# Input Instructions

The runtime input is provided in the `<seed_keyword_input>` XML-like block.

Use those values directly.

Use the company profile as the only source of company-specific facts.