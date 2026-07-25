---
prompt_name: generate-seed-keywords
prompt_version: 0.5.0
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

* one primary problem-demand territory
* one primary solution-demand territory
* exactly 12 seed keywords for each territory
* exactly 24 seed keywords in total

You must construct the seeds using the fixed slot system in this prompt.

Do not freely choose:

* how many seeds belong to each seed class
* which roles receive more coverage
* the order of the seed classes
* how much of the set focuses on one semantic subtopic

The fixed slot allocation, role counts, territory order, and seed order are mandatory.

The company profile determines only:

* the market concepts used to fill the slots
* the relevant ICP and market qualifiers
* the supported workflows, pains, outcomes, and capabilities
* the most natural buyer-facing wording

The seed keywords will be submitted to an external keyword-discovery provider that returns observed keyword ideas, search volume, keyword difficulty, search intent, CPC, and average ranking-domain metrics.

The external provider receives only the literal seed-keyword strings.

It does not receive:

* the company profile
* territory names
* territory summaries
* the primary ICP
* product connections
* evidence
* selection reasoning
* surrounding output context

Every seed must therefore contain enough market context to function as an independent keyword-discovery input.

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

```text
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

General knowledge may be used only to translate supported company information into conventional market language.

Do not use general knowledge to invent unsupported:

* company facts
* audiences
* capabilities
* integrations
* competitors
* positioning
* geographic markets
* customer problems
* product categories
* solution approaches

# Top-Level Output Rules

Copy the following values directly from the runtime input:

* `schema_version`
* `run_id`
* `generated_at`

Set:

* `source_artifacts` to exactly `["company-profile.json"]`
* `status` to `complete` when both territories and all seed slots can be filled with sufficient evidence
* `status` to `partial` when the profile is materially unclear but a conservative strategy can still be produced
* `warnings` to an empty array unless there is a material seed-generation limitation
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

# Seed Strategy Goal

The seed strategy must provide 24 focused but meaningfully different entry points into the company’s real search market.

The company profile should determine:

* which customer problem matters most
* which customer workflows are central
* which pains and failure states matter
* which outcomes buyers want
* which ICP or market qualifiers prevent drift
* which solution category the product belongs to
* which established approaches the product uses
* which capabilities represent independently recognizable customer needs

The company’s marketing language should not automatically become seed-keyword language.

Translate supported positioning into concise terms a buyer could plausibly type into a search engine.

The output should be product-aware without being product-overfitted.

The seed set must maximize distinct discovery coverage. Producing 12 grammatical variations of a smaller number of topics is a failure even when all 12 seeds are technically relevant.

# External Provider Context Rule

The external keyword-discovery provider receives only the seed strings.

Never justify an underspecified seed by claiming that context will be supplied by:

* the territory
* the ICP field
* the market topic
* the product connection
* the evidence
* the company profile

For example, if the company serves marketplace operators:

Bad:

* seller onboarding
* trust and safety operations
* AI operations software

Better:

* marketplace seller onboarding
* marketplace trust and safety
* AI for marketplace operations

If the company serves adults managing peptide protocols:

Bad:

* dose calculation app
* biomarker tracking app
* protocol tracking software

Better:

* peptide dose calculator
* peptide biomarker app
* peptide protocol tracker

Every seed must be evaluated as though it will be submitted to the provider alone.

# Demand Territory Definitions

## Problem Demand

The `problem_demand` territory represents the fundamental problems, jobs, workflows, failure states, decisions, and desired outcomes the product helps its primary ICP address.

The searcher does not need to know that the company’s product—or any software product—is the solution.

Problem demand may represent:

* a task the ICP needs to complete
* a problem the ICP needs to solve
* a workflow the ICP needs to manage
* a process the ICP needs to improve
* a failure the ICP needs to prevent
* a strategy the ICP needs to understand
* an outcome the ICP wants to achieve
* a decision the ICP needs to make

Problem demand must be broader than one minor product feature.

Do not define problem demand around:

* the company’s interface
* its publishing or delivery mechanism
* an approval system
* one minor supporting feature
* an internal workflow detail
* a proprietary term
* a marketing slogan

For an AI SEO product serving SaaS companies:

Good problem territory:

* SaaS SEO and organic growth

Bad problem territories:

* email-native content approvals
* GitHub blog publishing
* founder-question workflows
* automated brief generation

Those may be capabilities or differentiators, but they are not the fundamental customer market.

## Solution Demand

The `solution_demand` territory represents established solution categories, software categories, tool categories, and recognized product approaches buyers could evaluate to solve the problem.

The searcher understands that a product, tool, platform, application, service, or automated approach may be the solution.

Solution demand may represent:

* the product’s primary software category
* a secondary established solution category
* an ICP-qualified tool category
* a recognized automation or management approach
* software for a major workflow
* an independently recognizable capability category
* a commercial category buyers could compare

The solution territory must not be:

* the company name
* a proprietary category invented by the company
* a list of disconnected features
* a positioning slogan
* an exact description of the entire product workflow

For an AI SEO product serving SaaS companies:

Good solution territory:

* AI SEO tools and SEO automation

Bad solution territories:

* founder-informed email-native SEO publishing
* automated brief approval and GitHub delivery
* personalized search-landscape execution system

The bad examples describe a specific product but do not represent established buyer-facing categories.

# Territory Selection Rules

Select the single strongest problem territory and the single strongest solution territory.

Prioritize, in order:

1. Direct relevance to the primary ICP
2. Direct connection to the core product
3. Support from the company profile
4. Breadth sufficient for keyword discovery
5. Specificity sufficient to avoid unrelated markets
6. Established and understandable market language

Do not create multiple territories merely because the company has multiple features.

If the company has several capabilities, identify the central customer problem and product category that connects them.

If the company genuinely serves multiple unrelated products or audiences:

* prioritize the product and audience most strongly supported by the company’s core positioning
* mention the ambiguity in `warnings`
* lower `generation_quality.overall_confidence`
* describe the excluded ambiguity in `potential_risks`

Do not combine unrelated customer problems into one vague territory.

# Market Topic Rules

Each territory must contain one `market_topic`.

The market topic is a concise description of the search area collectively represented by that territory’s seeds.

Good market topics:

* SaaS SEO and organic growth
* peptide protocol management
* marketplace operations and growth
* subscription billing management
* customer support operations
* cloud cost optimization
* AI SEO automation
* peptide tracking apps
* marketplace operations software
* subscription billing software

Bad market topics:

* growth
* better workflows
* AI automation
* business software
* all-in-one platform
* increase efficiency

The market topic must be specific enough to identify a real market while remaining broader than a long-tail query.

# Product Awareness Rules

Use the company profile to select the correct:

* market
* ICP
* technical or vertical qualifier
* customer workflows
* solution category
* solution approaches
* independently meaningful capabilities

Do not force every product capability or differentiator into the seed set.

Differentiators should usually influence later content positioning, not initial keyword discovery.

For example, if a company provides:

* SEO automation
* founder-input collection
* email approvals
* GitHub publishing

The seed strategy should focus on established concepts such as:

* SaaS SEO
* SaaS keyword research
* AI SEO tools
* SEO automation

It should not focus on synthetic phrases such as:

* founder-input SEO workflows
* email approval SEO tools
* GitHub blog publishing automation

A product capability may become a seed only when:

* it represents a recognizable customer job or commercial category
* it has independent meaning outside the company
* it remains clearly connected to the selected market
* it is central enough to justify a discovery direction
* it is not ordinary internal functionality

# Deterministic Seed Construction

Construct the final seed set by filling the exact slots below in the specified order.

Do not generate a large unrestricted candidate pool.

Do not decide which seed classes deserve more or fewer slots.

Do not reorder the slot classes.

Do not leave a slot empty.

Do not add slot identifiers to the structured output unless the schema already contains them. The array position and required role identify the slot.

The fixed construction process is:

1. Derive one bounded company search map.
2. Fill P01 through P12 in order.
3. Fill S01 through S12 in order.
4. Apply the global overlap rules.
5. Repair only the individual slots that violate a rule.
6. Return the structured output.

Do not output:

* the internal company search map
* rejected wording
* alternative seeds
* internal comparisons
* hidden reasoning
* the repair process

# Step 1: Derive the Company Search Map

Before constructing seeds, internally identify:

1. One primary market qualifier
2. One primary ICP qualifier
3. One central customer problem
4. One primary solution category
5. Up to four distinct recurring customer workflows
6. Up to two distinct pains or failure states
7. Up to two desired outcomes or strategic decisions
8. Up to two independently meaningful capabilities
9. One established adjacent market frame

Use this evidence priority:

1. `company_identity.product_category.value`
2. `company_identity.one_sentence_description.value`
3. `icp_and_audience.primary_icp.value`
4. Buyer pains
5. Customer jobs
6. Product capabilities
7. Positioning summary

A concept is supported only when it is:

* directly stated in the company profile, or
* a conservative market-language translation of directly stated information

Do not treat every product feature as a separate market.

Do not use a supporting feature as a primary concept unless it represents an independently recognizable customer job, workflow, approach, or solution category.

When a profile describes a narrow market, retain the relevant:

* ICP
* vertical
* technical environment
* product category
* use case

whenever omitting it would cause the seed to drift into another market.

# Insufficient-Evidence Fallback Rules

The fixed slot system must not cause unsupported invention.

When the profile does not explicitly provide enough concepts for a slot, apply this fallback order:

1. Translate another directly supported customer job into conventional market language.
2. Use a distinct workflow implied conservatively by a central supported capability.
3. Use a broader established expression of the same supported problem or solution.
4. Use a narrower supported use case with the necessary market qualifier.
5. Mark the output `partial` and explain the limitation in `warnings` and `generation_quality`.

Never solve missing evidence by:

* inventing another audience
* inventing another capability
* inventing a product category
* using an unrelated adjacent market
* repeating an existing seed with a different suffix
* producing an unnatural phrase
* removing a necessary market qualifier

A conservative broader seed is preferable to an unsupported specialized seed.

# Step 2: Fill the Problem-Demand Slots

Return the 12 problem-demand seeds first and in the exact order below.

Problem-demand seeds must describe what the buyer needs to do, understand, manage, improve, prevent, or achieve.

Except when a recognized subject legitimately contains the term, problem-demand seeds must not primarily describe a product, vendor, application, platform, or tool.

## P01–P02: Core problem anchors

Required role:

`core_problem`

Required count:

Exactly 2

### P01: Primary customer problem or job

P01 must express the shortest useful established description of the central customer problem or job.

It must:

* remain inside the selected market
* be broader than a supporting feature
* be understandable without company context
* preserve a qualifier when the unqualified phrase would drift

### P02: Central functional area

P02 must express the central functional area in which the customer problem occurs.

It must:

* open a different discovery direction from P01
* remain directly connected to the core product
* not be a singular/plural variant of P01
* not merely reverse P01’s word order
* not replace one word with an empty synonym

P01 and P02 may share the overall market, but they must not represent the same search concept.

## P03–P04: ICP-qualified jobs or problems

Required role:

`icp_qualified_problem`

Required count:

Exactly 2

Each seed must:

* include an ICP, market, vertical, use-case, or technical qualifier
* address a different supported job or problem
* prevent a plausible form of market drift
* sound natural as a standalone search phrase

Do not repeat the same root phrase twice with different qualifiers.

Do not attach an ICP mechanically to a phrase when the resulting wording is unnatural.

The two slots must represent two distinct discovery directions, not two versions of the same category.

## P05–P08: Recurring customer workflows

Required role:

`process_or_outcome`

Required count:

Exactly 4

Each seed must represent a different recurring workflow or process performed by the buyer.

Requirements:

* Use four different supported workflows.
* Prefer central recurring workflows over minor features.
* Each workflow must connect independently to the central customer problem.
* Preserve the relevant market qualifier when needed.
* Do not describe software, tools, platforms, or applications.
* Do not use four stages of one proprietary product workflow.
* Do not create a workflow merely by adding `management`, `operations`, or `process` to the same root.

A workflow may be derived conservatively from a central product capability when the associated customer job is clear.

## P09–P10: Pains or failure states

Required role:

`process_or_outcome`

Required count:

Exactly 2

Each seed must represent a different concrete:

* bottleneck
* failure state
* operational risk
* recurring frustration
* breakdown the buyer wants to prevent

Requirements:

* Use natural search language.
* Keep the phrase connected to the selected market.
* Do not fabricate a negative phrase merely to satisfy the slot.
* Do not use two opposite descriptions of the same problem.
* Do not repeat a P06–P09 workflow with a negative adjective.

## P11: Desired outcome, strategy, planning, or decision topic

Required role:

`process_or_outcome`

Required count:

Exactly 1

P11 must represent whichever supported concept is strongest:

* a recognizable desired outcome, or
* a strategy, planning, prioritization, implementation, or evaluation topic

It must:

* remain directly connected to the central customer problem
* use a market qualifier if the phrase would otherwise be generic
* avoid unsupported numerical or performance claims
* differ from the workflows and failure states already used

Do not require both a desired outcome and a strategy or planning topic.

Do not turn the company’s internal methodology into a public market term.

## P12: Adjacent established market frame

Required role:

`market_synonym`

Required count:

Exactly 1

This seed must express an established adjacent framing of the same overall problem market.

Requirements:

* It must open a meaningfully different discovery direction.
* It must still address the same primary buyer and central problem.
* Do not merely change word order.
* Do not use singular/plural variants.
* Do not substitute empty synonyms.
* Do not invent artificial category language.
* Do not repeat P01 or P02 with `management`, `operations`, `strategy`, or `optimization` added unless the resulting concept is independently recognized and meaningfully different.

These are adjacent market frames, not quota-filling synonyms.

## Exact problem-demand role totals

The final problem-demand array must contain:

* `core_problem`: exactly 2
* `icp_qualified_problem`: exactly 2
* `process_or_outcome`: exactly 7
* `market_synonym`: exactly 1

Total:

Exactly 12

# Step 3: Fill the Solution-Demand Slots

Return the 12 solution-demand seeds after the problem-demand seeds and in the exact order below.

Every solution-demand seed must imply a recognizable:

* product category
* tool category
* software category
* platform category
* solution approach
* commercial evaluation area

Do not create proprietary or synthetic product categories.

## S01–S02: Primary solution categories

Required role:

`core_solution_category`

Required count:

Exactly 2

### S01: Primary established solution category

S01 must represent the company’s strongest established software, product, or tool category.

It must:

* describe a recognizable category outside the company
* connect directly to the central customer problem
* preserve a qualifier when needed to prevent drift
* avoid proprietary company wording

### S02: Secondary established solution category

S02 must represent a second recognized solution category supported by the core product.

It must:

* differ conceptually from S01
* remain central enough to justify keyword discovery
* not be based on a minor feature
* not differ only by `software`, `platform`, `tool`, `app`, or `solution`

If the product supports only one clearly established category, use the closest distinct recognized category supported by another central customer job. Do not invent a synthetic category.

## S03–S04: ICP-qualified solution needs

Required role:

`icp_qualified_solution`

Required count:

Exactly 2

Each seed must combine a supported solution category with a necessary:

* ICP
* vertical
* technical environment
* market
* use case

Requirements:

* Each seed must represent a different solution need.
* Each must remain natural as a standalone phrase.
* Each qualifier must materially narrow the market.
* Do not repeat one solution phrase with two minor qualifier changes.
* Do not mechanically attach the ICP to a category when the result is unnatural.
* Do not mirror P03–P04 one-for-one by merely adding `software` or `tools`.

## S05–S07: Recognized solution approaches

Required role:

`solution_approach`

Required count:

Exactly 3

Each seed must describe a different recognized way of solving the central problem.

Possible approach types include:

* automation
* orchestration
* optimization
* monitoring
* analysis
* tracking
* management
* scheduling
* recovery
* calculation

These are categories of approach, not a required list.

Requirements:

* Use only approaches supported by the product.
* Each approach must be meaningfully distinct.
* The phrase must make sense outside the company.
* Preserve a qualifier when the unqualified phrase would drift.
* Do not create synthetic phrases by concatenating features.
* Do not generate three variants of the same approach.
* `AI`, `automated`, and `automation` do not automatically create separate approaches.

## S08–S10: Workflow-specific tool categories

Required role:

`commercial_category`

Required count:

Exactly 3

Each seed must represent a recognizable software or tool category for one of the major workflows identified in P05–P08.

Requirements:

* Use three different workflows.
* Select the three workflows with the strongest recognizable commercial categories.
* The category must make sense outside the company.
* Preserve the market qualifier when needed.
* Do not create a software phrase simply by appending `software` to the corresponding problem seed.
* Translate the workflow into the most conventional commercial category.
* Do not force a software category for the fourth workflow if it lacks a recognizable commercial category.
* Do not use `software`, `platform`, `tool`, and `app` as variants of the same workflow.
* Do not use an ordinary internal feature as a standalone software market.

The relationship to P05–P08 should be conceptually supported but not mechanically mirrored.

## S11–S12: Capability-specific commercial categories

Required role:

`commercial_category`

Required count:

Exactly 2

Each seed must represent an independently recognizable commercial category connected to a different central capability.

A capability is eligible only when:

* it solves a distinct customer need
* it has meaning outside the company
* buyers could plausibly search for a product in that category
* it is central enough to justify keyword discovery
* it is supported by the company profile

Requirements:

* Use two different capabilities or customer needs.
* Do not expose internal implementation details.
* Do not create synthetic categories from feature combinations.
* Do not repeat S08–S10 with another product suffix.
* Do not use minor administrative functionality merely to fill a slot.

If fewer than two capabilities meet these requirements, apply the insufficient-evidence fallback rules and use another distinct supported commercial need.

## Exact solution-demand role totals

The final solution-demand array must contain:

* `core_solution_category`: exactly 2
* `icp_qualified_solution`: exactly 2
* `solution_approach`: exactly 3
* `commercial_category`: exactly 5

Total:

Exactly 12

# Global Semantic Coverage Rules

The fixed slot counts do not justify repetition.

## Semantic subtopic limit

A semantic subtopic is the underlying customer job, workflow, problem, outcome, or solution need represented by a seed.

Across all 24 seeds:

* no semantic subtopic may receive more than two seeds
* different wording does not create a new subtopic
* different product suffixes do not create a new subtopic
* an ICP qualifier does not automatically create a new subtopic
* a commercial modifier does not create a new subtopic

For example, these occupy the same semantic subtopic:

* customer feedback
* customer feedback management
* customer feedback software
* customer feedback platform

Do not retain more than two of them across the full seed set.

When two seeds use the same subtopic, they must represent legitimately different intent territories, such as:

* one problem-demand expression
* one solution-demand category

## Discovery-direction test

Two seeds represent the same discovery direction when submitting them independently to the keyword provider would likely retrieve substantially overlapping keyword ideas.

Treat two seeds as duplicates when their difference is mainly:

* singular versus plural
* word order
* an empty synonym
* the ICP added or removed
* `AI` added or removed
* `automated` versus `automation`
* `software` versus `platform`
* `tool` versus `tools`
* `app` versus `software`
* a commercial adjective such as `best` or `top`

If two seeds would likely produce substantially the same candidate universe, keep the stronger seed and repair the weaker slot with a different supported concept.

## Maximum mirrored problem/solution pairs

A mirrored pair occurs when a solution seed is created primarily by adding a product suffix or approach modifier to a problem seed.

Examples:

```text
subscription billing
subscription billing software
```

```text
customer onboarding
customer onboarding tools
```

Across the entire output, allow no more than two mirrored problem/solution root pairs.

A pair does not count as mirrored when the solution phrase represents a genuinely different recognized category or intent.

The purpose of the two territories is to cover related but different search behavior, not reproduce the same 12 roots with commercial suffixes added.

## Territory separation test

After constructing all seeds, verify:

Problem demand asks:

> What does the buyer need to do, improve, prevent, understand, or achieve?

Solution demand asks:

> What kind of product or recognized approach might the buyer evaluate?

If most solution seeds can be produced by adding `software`, `platform`, `tool`, or `automation` to the problem seeds, the territory separation has failed.

Repair the overlapping slots before returning.

# Seed Keyword Requirements

Generate exactly 12 seed keywords for `problem_demand`.

Generate exactly 12 seed keywords for `solution_demand`.

Generate exactly 24 seed keywords in total.

Every seed must:

* be globally unique after normalization
* contain no company name
* contain no competitor name
* contain no unsupported audience
* contain no unsupported product category
* be grammatically correct
* sound natural when read independently
* represent one clear concept
* be useful as an external keyword-discovery input
* be supported by the selected territory
* be understandable without additional context
* preserve enough market context to avoid obvious category drift
* resemble language a buyer could plausibly type verbatim

Prefer seeds between two and five words.

A one-word seed is acceptable only when it represents a precise, established category and is not excessively broad.

Avoid seeds longer than six words.

Do not write seeds as full questions or sentences.

Avoid:

* what is
* why does
* how can I
* should I
* question marks
* conversational filler

The external keyword provider will generate observed questions, modifiers, and long-tail variations from the seeds.

# Standalone Seed Test

Evaluate every seed using this test:

> If this exact seed were submitted to the external keyword provider without any other information, would the returned ideas likely remain inside the company’s intended market?

Reject or repair the seed when the answer is no.

Bad:

* organic visibility
* seller onboarding
* dose calculation app
* biomarker tracking app
* protocol tracking software
* AI operations software

Better:

* SaaS organic visibility
* marketplace seller onboarding
* peptide dose calculator
* peptide biomarker app
* peptide protocol tracker
* AI for marketplace operations

A broad phrase is acceptable when it is itself the company’s established market category.

Examples:

* customer onboarding
* subscription billing
* product analytics
* cloud cost optimization

Do not add qualifiers mechanically when an unqualified phrase already represents a precise and relevant category.

# Natural Search-Language Test

Every seed must pass all of the following:

* A buyer could plausibly type the phrase into Google.
* The phrase is grammatically correct.
* The phrase uses a conventional word order.
* The phrase does not sound like an internal strategy label.
* The phrase does not sound like a compressed product description.
* The phrase does not depend on its selection reasoning.
* The phrase does not require knowledge of the company’s website.
* The phrase does not concatenate several unrelated concepts.

Reject phrases such as:

* search opportunity prioritization
* peptide health management
* marketplaces operations
* peptide apps for tracking
* marketplace software for operators
* founder-informed content execution workflow

Prefer phrases such as:

* SaaS keyword research
* peptide reconstitution
* marketplace operations
* peptide tracking app
* marketplace management software
* SaaS content strategy

# Seed Breadth Rules

Seeds must be broad enough to produce multiple relevant keyword ideas.

Seeds must be narrow enough to remain within the company’s actual market.

Bad because they are too broad:

* marketing
* software
* analytics
* automation
* growth
* management
* operations software
* tracking app

Bad because they are too narrow or product-overfitted:

* founder email SEO approval workflow
* GitHub publishing for AI SaaS blogs
* automated content revision approval tool
* AI billing reconciliation for seed-stage SaaS founders

Better:

* SaaS SEO
* SEO automation
* peptide dose calculator
* marketplace seller onboarding
* subscription billing software
* customer support automation
* cloud cost optimization

# Problem-Demand Restrictions

Problem-demand seeds must not primarily describe:

* software
* tools
* applications
* platforms
* generators
* vendors
* product comparisons
* commercial alternatives
* automation products

Avoid solution-category modifiers such as:

* software
* app
* platform
* tool
* generator
* alternatives
* versus
* best tools

A problem seed may contain a term such as `automation` only when automation is itself an established problem-domain subject—not when it turns the seed into a product search.

# Solution-Demand Restrictions

Solution-demand seeds should imply:

* a product category
* an automation or management approach
* a tool category
* a software category
* a platform category
* a commercial evaluation area

Do not include:

* company names
* competitor names
* `versus`
* `vs`
* named alternatives

Competitor-specific opportunities will be handled after the competitor set is validated.

# Modifier and Redundancy Rules

Two seeds are not meaningfully distinct when one is primarily another seed plus a modifier such as:

* best
* top
* leading
* AI
* automated
* software
* tool
* tools
* app
* platform
* solution

Examples:

Too similar:

* AI SEO tools
* best AI SEO tools

Too similar:

* peptide tracking app
* peptide tracking apps

Too similar:

* marketplace operations software
* marketplace operations platform

Too similar:

* SEO automation
* automated SEO

Choose the strongest, most conventional version unless the modifier creates a genuinely different established market direction.

The fixed slot requirements must not force semantic duplication.

# Generic Capability Qualification Rules

A feature-oriented seed must preserve the relevant market qualifier when the unqualified phrase could belong to multiple industries.

Reject:

* dose calculation app
* biomarker tracking app
* seller onboarding
* trust and safety operations
* protocol tracking software
* AI operations software

Prefer:

* peptide dose calculator
* peptide biomarker app
* marketplace seller onboarding
* marketplace trust and safety
* peptide protocol tracker
* AI for marketplace operations

Do not assume the provider will infer the intended market.

# Natural Market-Language Rules

Prefer language a buyer could understand and plausibly use without knowing the company’s terminology.

Do not copy awkward marketing language merely because it appears in the company profile.

Do not concatenate:

* multiple pains
* several capabilities
* the ICP
* the product category
* a differentiator

into one seed.

Bad:

* AI SaaS SEO content planning approval publishing tool

Better:

* SaaS SEO
* AI SEO tools
* SEO automation
* SEO tools for SaaS

Do not claim that a term is popular, high-volume, low-competition, or proven.

A seed only needs to be a strong, evidence-backed discovery input. External keyword data will determine whether related demand exists.

# Evidence Rules

Each territory must contain between one and three evidence items.

Use only the company profile.

Each evidence item must contain:

* `source_field`
* `evidence_text`
* `reasoning`

`source_field` must identify a real path in the company profile.

Good source fields:

* `company_identity.product_category.value`
* `company_identity.one_sentence_description.value`
* `icp_and_audience.primary_icp.value`
* `buyer_pains[0].pain`
* `product_capabilities[0].capability`
* `differentiation_and_positioning.positioning_summary.value`
* `differentiation_and_positioning.category_point_of_view.value`

Do not invent source paths.

`evidence_text` should be a concise value or summary from that field.

`reasoning` should explain why the evidence supports the selected territory.

Evidence supports territory selection. It does not prove that a seed has search volume.

# Confidence Rules

Confidence must reflect both:

1. The strength of the company-profile evidence
2. The strength and conventionality of the market-language translation

Use `high` only when:

* the profile directly supports the customer problem, ICP, workflow, or category
* the seed is a direct and conservative expression of that evidence
* the wording is clearly established and natural
* little interpretation was required

Use `medium` when:

* the seed is a reasonable market-language translation
* the exact wording is not directly stated
* the phrase represents an emerging category
* the seed is derived from a supported capability
* a qualifier or category relationship required interpretation

Use `low` when:

* the company profile is vague
* the product category is novel or unclear
* the audience is uncertain
* the seed requires substantial interpretation
* the phrase may not represent established market language

Do not assign `high` merely because:

* the seed sounds plausible
* the seed is grammatical
* the product technically supports the capability
* the phrase resembles the company’s marketing copy

Do not assign the same confidence mechanically to nearly every seed.

If more than 80% of the seeds are marked `high`, verify that the profile directly and clearly supports each one. Downgrade translated, inferred, capability-derived, emerging, or ambiguous concepts to `medium` or `low` as appropriate.

# Illustrative Examples

These examples demonstrate the desired abstraction and separation.

Do not copy their topics unless they match the supplied company profile.

## Subscription Billing Product

Problem-demand examples:

* subscription billing
* SaaS billing operations
* failed payment recovery
* subscription revenue leakage
* recurring revenue management
* billing reconciliation
* subscription pricing strategy

Solution-demand examples:

* subscription billing software
* billing software for SaaS
* payment recovery software
* recurring billing platform
* billing automation
* subscription analytics tools

Avoid producing all of the following together:

* subscription billing
* subscription billing management
* subscription billing software
* subscription billing platform
* subscription billing tools

These occupy one semantic subtopic and do not provide sufficient discovery diversity.

## Cloud Cost Product

Problem-demand examples:

* cloud cost optimization
* AWS cost management
* cloud budget forecasting
* unused cloud resources
* reduce Kubernetes costs
* cloud spend governance

Solution-demand examples:

* cloud cost management software
* FinOps tools
* AWS cost optimization tools
* Kubernetes cost monitoring
* cloud spend analytics
* cloud cost automation

Avoid:

* cloud cost software
* cloud cost platform
* cloud cost tools
* AI cloud cost tools

when they represent the same underlying discovery direction.

## Customer Onboarding Product

Problem-demand examples:

* customer onboarding
* SaaS user activation
* onboarding drop off
* product adoption strategy
* onboarding journey mapping
* improve user activation

Solution-demand examples:

* customer onboarding software
* SaaS onboarding tools
* user activation software
* product adoption platforms
* onboarding automation
* in-app guidance software

The solution set should not simply reproduce every problem root with a product suffix.

# Deterministic Normalization Check

Before returning the output, normalize each seed for comparison by:

1. Applying Unicode normalization
2. Trimming leading and trailing whitespace
3. Converting the phrase to lowercase
4. Collapsing repeated internal whitespace
5. Ignoring harmless terminal punctuation

All 24 normalized seeds must be globally unique.

This check handles mechanical equality only.

The semantic overlap rules must separately remove:

* singular/plural variants
* reordered phrases
* suffix variants
* close grammatical rewrites
* mirrored problem/solution roots
* seeds with substantially identical discovery directions

# Bounded Repair Process

After filling all 24 slots, validate them in this order:

1. Structure and role counts
2. Company-profile support
3. Territory correctness
4. Standalone market context
5. Natural search language
6. Mechanical uniqueness
7. Semantic subtopic limit
8. Mirrored-pair limit
9. Discovery-direction diversity
10. Confidence calibration

When a violation is found:

* repair only the failing seed or seeds
* keep the slot’s required role and purpose
* choose the next strongest unused supported concept for that slot
* do not reorder the array
* do not change any slot count
* re-run all checks affected by the replacement

Do not regenerate the unrestricted seed set from scratch.

Do not weaken a rule merely to retain a seed.

Do not output the validation or repair process.

# Generation Quality

Use `generation_quality` to describe the reliability of the final strategy.

Only include missing information that materially affects:

* territory selection
* market qualification
* seed relevance
* ICP targeting
* workflow identification
* solution-category identification

Relevant missing information includes:

* unclear primary ICP
* unclear product category
* multiple unrelated product categories
* vague buyer pains
* insufficient workflow evidence
* limited product-capability evidence
* unsupported or proprietary category language
* unclear geographic or language market when materially relevant

Do not include irrelevant missing information such as:

* absent pricing
* absent customer logos
* absent named customers
* unspecified implementation details
* unrelated technical details
* operating-system support unless it materially changes the search market

Potential risks must describe uncertainty in seed selection—not general business or SEO risks.

Good potential risks:

* `The product category uses proprietary language, so the nearest established solution category was inferred with medium confidence.`
* `The company serves multiple audiences, but the primary ICP is not clearly prioritized.`
* `The profile describes several capabilities without clearly identifying four distinct customer workflows.`
* `Several capabilities use generic language, so market qualifiers were retained to prevent category drift.`

Bad potential risks:

* `The keywords may not rank.`
* `The company may fail.`
* `The market is too competitive.`
* `Search volume may be low.`

Search-volume and ranking conclusions belong to later pipeline stages.

# Final Validation Checklist

Before returning the structured output, verify every condition below.

## Structure

* Exactly two demand territories are present.
* `problem_demand` appears exactly once.
* `solution_demand` appears exactly once.
* `problem_demand` appears first.
* Each territory contains exactly 12 seeds.
* Exactly 24 seeds exist in total.
* The seeds appear in the required slot order.
* Every slot has its required role.
* Output matches `SeedKeywordsSchema`.

## Problem-demand allocation

* P01–P02 use `core_problem`.
* P03–P04 use `icp_qualified_problem`.
* P05–P11 use `process_or_outcome`.
* P12 uses `market_synonym`.
* P05–P08 represent four distinct workflows.
* P09–P10 represent two distinct pains or failures.
* P11 represents one desired outcome, strategy, planning, or decision topic.
* No problem seed primarily describes a software product or tool.

## Solution-demand allocation

* S01–S02 use `core_solution_category`.
* S03–S04 use `icp_qualified_solution`.
* S05–S07 use `solution_approach`.
* S08–S12 use `commercial_category`.
* S01 and S02 represent conceptually distinct categories.
* S03–S04 represent two different qualified solution needs.
* S05–S07 represent three different supported approaches.
* S08–S10 represent three different workflow categories.
* S11–S12 represent two independently meaningful capability categories.

## Uniqueness and coverage

* All 24 normalized seeds are globally unique.
* No two seeds differ only by singular or plural.
* No two seeds differ only by word order.
* No two seeds differ only by a commercial modifier.
* No semantic subtopic has more than two seeds.
* No more than two mirrored problem/solution root pairs exist.
* The two territories do not reproduce the same underlying seed list.
* Each seed adds a useful discovery direction.

## Market quality

* Every seed is grammatically correct.
* Every seed sounds natural independently.
* Every seed could plausibly be typed verbatim.
* Every seed retains sufficient market context.
* No seed depends on selection reasoning.
* No seed uses an internally constructed strategy label.
* No seed compresses the entire product description.
* No generic capability seed can drift obviously into unrelated markets.
* No unsupported concept was introduced to satisfy a slot.

## Scope

* Every problem seed uses an allowed problem-demand role.
* Every solution seed uses an allowed solution-demand role.
* No seed contains the company name.
* No seed contains a competitor name.
* No seed contains an unsupported audience.
* No seed contains an unsupported category.
* No seed claims search volume, difficulty, or ranking potential.
* No seed is a full question or sentence.
* All seeds remain within one coherent market per territory.

## Evidence and confidence

* Evidence refers to real company-profile fields.
* Evidence supports territory selection rather than claiming keyword demand.
* Confidence reflects both evidence and translation certainty.
* Inferred or capability-derived seeds are not automatically marked `high`.
* `missing_information` includes only gaps material to seed generation.
* `potential_risks` describes seed-selection uncertainty rather than business or ranking risk.

Fix every violation before returning.

# Output Semantics

Return valid structured output matching `SeedKeywordsSchema`.

Do not add commentary outside the structured output.

Do not include hidden reasoning or chain-of-thought.

Use concise reasoning only inside:

* `territory_summary`
* `product_connection`
* evidence `reasoning`
* seed `selection_reasoning`
* `generation_quality`
* `warnings`

The `selection_reasoning` for each seed should briefly identify:

* the slot purpose it fulfills
* the supported customer problem, workflow, outcome, approach, or capability
* why it adds a distinct discovery direction

Do not reference internal slot identifiers unless that is natural and useful. Do not expose the hidden validation process.

Do not fill fields with unsupported claims merely because the schema requires a value.

When the company profile is unclear:

* remain conservative
* lower confidence
* use `partial` status when appropriate
* record the limitation in `warnings`
* explain the uncertainty in `generation_quality`

# Input Instructions

The runtime input is provided in the `<seed_keyword_input>` XML-like block.

Use those values directly.

Use the company profile as the only source of company-specific facts.
