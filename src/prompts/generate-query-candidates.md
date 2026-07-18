---
prompt_name: generate-query-candidates
prompt_version: 1.2.0
output_mode: structured_json
schema_name: QueryCandidatesSchema
model: gpt-5.4-mini
reasoning_effort: low
temperature: 0.25
max_output_tokens: 16000
---

# Developer Instructions

# Task

Generate evidence-backed search query families from a structured company profile.

The output will seed later keyword expansion, keyword-metrics validation, and SERP analysis.

These are unvalidated search hypotheses. They are not final SEO recommendations or a complete keyword universe.

Generate exactly six query families:

- exactly three `problem_demand` families
- exactly three `solution_demand` families
- exactly ten query candidates per family
- exactly sixty query candidates in total
- exactly sixty globally unique normalized query strings

Every family must represent:

- one search job
- one dominant search intent
- one primary audience
- one likely page type

Do not generate a content architecture, pillar pages, subpages, article outlines, briefs, or finished content.

Do not perform keyword research, keyword expansion, or SERP analysis.

Do not estimate or claim:

- search volume
- CPC
- keyword difficulty
- domain authority
- ranking potential
- traffic
- SERP weakness
- business impact

Do not claim that any query will rank.

Your job is to generate realistic search-language hypotheses that will be validated and expanded using external keyword and SERP data later.

# Runtime Input

The runtime input contains a pipeline run identifier, generation timestamp, and structured company profile.

Expected format:

    <query_candidate_input>
      <schema_version>{schemaVersion}</schema_version>
      <run_id>{runId}</run_id>
      <generated_at>{generatedAt}</generated_at>

      <company_profile>
        {companyProfile as JSON}
      </company_profile>
    </query_candidate_input>

Use the company profile as the only source of company-specific facts.

# Top-Level Output Rules

Copy the following values directly from the runtime input:

- `schema_version`
- `run_id`
- `generated_at`

Set:

- `source_artifacts` to exactly `["company-profile.json"]`
- `status` to `complete` when the required output is successfully generated
- `warnings` to an empty array unless the company profile creates a material limitation
- `website_url` from the company profile

Populate `source_profile` from:

- `company_identity.company_name.value`
- `company_identity.product_category.value`
- `icp_and_audience.primary_icp.value`

Return exactly six items in `query_families`.

# Required Family IDs

Use exactly these family IDs:

- `problem_01`
- `problem_02`
- `problem_03`
- `solution_01`
- `solution_02`
- `solution_03`

The following IDs must use `problem_demand`:

- `problem_01`
- `problem_02`
- `problem_03`

The following IDs must use `solution_demand`:

- `solution_01`
- `solution_02`
- `solution_03`

Do not generate any additional family IDs.

Family IDs are identifiers only.

Do not derive search intent, buyer stage, page type, product relevance, or family strategy from the numeric position of a family.

In particular:

- `solution_01` is not automatically a category page
- `solution_02` is not automatically a use-case page
- `solution_03` is not automatically vendor-aware
- `solution_03` is not automatically a landing page

Derive all metadata from the actual search job and query set.

# Primary Audience Rules

Use `icp_and_audience.primary_icp` as the default audience for all six families.

A family may target a secondary audience only when:

- that secondary audience is explicitly present in the company profile
- the product has a clearly supported capability for that audience
- the family represents a strong and distinct search opportunity
- the family summary clearly identifies that audience
- the ten queries remain coherent for that one audience

Do not combine primary and secondary audiences in the same family.

Do not combine consumers, professionals, operators, agencies, clinicians, coaches, or other distinct audiences merely because the product can serve all of them.

# Demand Territory Definitions

## Problem Demand

A `problem_demand` family begins with a problem, workflow, pain, job, question, or desired outcome experienced by the ICP.

The searcher does not need to know that software, an app, a platform, or a tool is the solution.

Problem-demand searches may involve:

- understanding a problem
- diagnosing why something is not working
- learning a process
- improving an outcome
- fixing a workflow
- reducing a recurring pain
- finding a template
- finding a checklist
- learning how to complete a task manually
- understanding a concept or calculation

A problem-demand query should normally be satisfiable by:

- a guide
- an educational article
- a workflow explanation
- a template
- a checklist
- a tutorial
- a reference resource

A problem-demand query must not primarily expect:

- software
- an app
- a platform
- a product
- a generator
- an automated tool
- a vendor comparison
- a product directory
- a commercial tool-selection page
- an interactive calculator when the calculator itself is the desired solution

Problem-demand families should normally use:

- `informational` search intent
- `problem_aware` buyer stage
- page types such as `guide`, `workflow`, `problem_article`, or `template`

Problem-demand queries must not use the `tool` query type.

Do not turn product features into problem-demand families.

Bad problem-demand query:

- peptide tracking app

Better problem-demand queries:

- how to track a peptide protocol
- peptide protocol spreadsheet
- peptide protocol checklist

Bad problem-demand query:

- seo brief generator

Better problem-demand queries:

- how to write an seo brief
- seo content brief template
- seo brief checklist

Bad problem-demand query:

- marketplace dispute software

Better problem-demand queries:

- how to handle marketplace disputes
- marketplace dispute resolution workflow
- dispute handling checklist

## Solution Demand

A `solution_demand` family begins with a solution category, product approach, software use case, alternative, comparison, or tool-selection decision.

The searcher knows that a tool, platform, app, service, or defined solution may solve the problem.

Solution-demand searches may involve:

- finding software for a use case
- evaluating a product category
- selecting an app or tool
- comparing solution approaches
- looking for automation
- replacing a manual workflow
- finding a generator or calculator
- determining which solution fits a specific ICP
- evaluating which type of product to adopt

A solution-demand query should normally imply that the expected result is:

- software
- an app
- a platform
- a tool
- a generator
- an interactive calculator
- an automation product
- a solution-category page
- a product comparison
- a vendor-evaluation resource

Solution-demand families should normally use:

- `commercial` or `transactional` search intent
- `solution_aware` or `vendor_aware` buyer stage
- page types such as `category_page`, `use_case_page`, `comparison`, `alternatives`, `tool`, or `landing_page`

Do not generate branded competitor queries during this step.

Competitors will be discovered from actual SERP results later.

# Candidate-Level Territory Test

Territory must be correct for every individual query, not merely for the family as a whole.

Before accepting each candidate, ask:

> What type of result would the searcher most likely expect?

If the expected result is primarily an educational resource, workflow, explanation, template, checklist, or tutorial, the query belongs in `problem_demand`.

If the expected result is primarily software, an app, a platform, a generator, a calculator, an automation product, or a product comparison, the query belongs in `solution_demand`.

Reject any candidate that does not match its family’s territory.

The same broad topic may support both a problem-demand family and a solution-demand family only when the expected pages and query intents are clearly different.

Valid separation:

Problem demand:

- how to write an seo brief
- seo brief checklist
- seo content brief template

Solution demand:

- seo brief generator
- seo content brief software
- ai seo brief tool

Invalid separation:

Problem demand:

- seo brief generator
- content brief software

Solution demand:

- seo brief generation tool
- content brief automation

The invalid example places solution-seeking queries in both territories.

# Family Coherence Rules

Every family must represent one coherent search job.

All ten candidates in a family should be satisfiable by the same general page.

Before accepting a family, apply the one-page test:

> Could one focused page satisfy all ten queries without becoming broad, confusing, or multi-purpose?

If not, split the concepts internally and select only the stronger search job for the family.

Do not combine independent jobs merely because the product performs both.

Bad family:

- seller onboarding and marketplace growth automation

This incorrectly combines:

- seller recruitment
- seller verification
- seller onboarding
- funnel optimization
- retention
- growth experimentation

Better family:

- marketplace seller onboarding software

Or:

- marketplace retention software

Choose one. Do not combine both.

Bad family:

- shared protocol and biomarker management software

This may incorrectly combine:

- protocol sharing
- clinician collaboration
- coach dashboards
- biomarker interpretation
- multi-client management

Choose one coherent search job and one audience.

A family may contain closely related workflow stages when buyers naturally understand them as one job.

For example, content review, approval, and publishing may form one coherent workflow if the queries consistently reflect that combined job.

# Family Distinctness Rules

Each family must represent a meaningfully different search job or a clearly different demand territory.

Do not create multiple families that are simply alternate wording for the same topic.

Bad separation:

- SaaS content workflow
- SaaS blog workflow
- SaaS content production process

These likely belong in one family.

Good separation:

- building a SaaS content workflow
- finding SaaS SEO opportunities
- creating an SEO content brief

A problem-demand and solution-demand family may address the same underlying buyer job only when their expected result types are clearly different.

Example:

- problem family: how to organize a peptide protocol
- solution family: peptide tracking app

The problem family must contain educational and manual-workflow queries.

The solution family must contain app and software-selection queries.

Do not place app, tracker, software, generator, calculator, or tool queries in both families.

Different families should not compete for the same page or dominant search intent.

# Product Differentiator Versus Search Demand

The company’s differentiators should shape the product angle, not automatically become query language.

Do not assume that buyers search for a feature simply because the company emphasizes it.

Be especially skeptical of:

- proprietary workflows
- internal product terminology
- novel category names
- marketing slogans
- named product mechanisms
- specific integrations
- unusual delivery methods
- distinctive features without established market language

Bad approach:

The product uses email-first review, so generate:

- email-first seo workflow
- approve seo content by email
- email based seo revisions

Better approach:

Target broader existing solution language:

- content approval workflow software
- seo content workflow software
- blog publishing workflow software

The email-first workflow may later become the product angle for those queries.

Bad approach:

The product publishes through GitHub, so generate:

- github publishing workflow for content

Better approach:

- content publishing workflow software
- blog publishing automation
- seo content approval software

Only include a differentiator or integration in query wording when it is plausible that buyers independently search for that exact capability.

When uncertain, use broader market-language wording and record the differentiator in reasoning rather than forcing it into the query.

# Required Reasoning Process

Before producing the structured output:

1. Identify the primary ICP.
2. Identify the ICP’s most important problems, jobs, workflows, and desired outcomes.
3. Identify the established solution category and supported use cases.
4. Separate product positioning language from plausible buyer search language.
5. Generate provisional problem-demand families.
6. Generate provisional solution-demand families.
7. Reject families that are merely product features or differentiators.
8. Reject families that combine multiple audiences.
9. Reject families that combine multiple independent search jobs.
10. Apply the one-page test to every provisional family.
11. Merge families that represent the same underlying search job and demand territory.
12. Select the three strongest and most coherent families for each territory.
13. Derive search intent, buyer stage, page type, and product relevance independently for each family.
14. Generate more than ten provisional query variants per family internally.
15. Apply the candidate-level territory test to every provisional query.
16. Reject any query that does not match the family’s dominant intent.
17. Select the ten strongest natural queries for each family.
18. Maintain a global normalized-query registry across all six families.
19. Replace exact duplicates and meaningless near-duplicates.
20. Perform a final family-coherence, territory, metadata, and uniqueness review.
21. Confirm that no search demand or rankability claims were made.

Do not expose hidden chain-of-thought.

Only provide concise reasoning in schema fields that request reasoning, evidence, risks, notes, or confidence.

# Evidence Rules

Each family must contain one or two evidence items from the company profile.

Each evidence item must contain:

- `source_field`
- `evidence_text`
- `reasoning`

Use precise source paths such as:

- `company_identity.product_category`
- `icp_and_audience.primary_icp`
- `icp_and_audience.secondary_audiences[0]`
- `buyer_pains[0].pain`
- `product_capabilities[1].capability`
- `differentiation_and_positioning.positioning_summary`
- `differentiation_and_positioning.primary_differentiators[0]`
- `differentiation_and_positioning.category_point_of_view`

The `source_field` and `evidence_text` must refer to the same company-profile value.

Do not cite information outside the provided company profile.

Do not cite raw website content unless it already appears as evidence in the company profile.

Evidence proves company relevance. It does not prove search demand.

# Market-Language Rules

Use phrases that a real buyer might type into Google.

The company’s positioning should shape the content angle, not dictate the query wording.

Be skeptical of:

- invented category language
- internal product terminology
- marketing slogans
- feature names
- overly specific positioning phrases
- queries that sound like article headlines
- phrases created merely by combining profile terms
- queries that require knowledge of the company’s product design

Bad query:

- workflow-native SEO execution agent

Better queries:

- SaaS SEO workflow
- SEO content workflow
- SaaS content production
- automate SaaS SEO
- SEO workflow software

Bad query:

- close the content execution gap

Better queries:

- content production bottlenecks
- content workflow problems
- blog publishing workflow
- content production process

Bad query:

- marketplace growth leaks

Better queries:

- marketplace funnel drop off
- marketplace conversion problems
- how to improve marketplace retention
- marketplace retention strategy

# Query Candidate Rules

Generate exactly ten query candidates per family.

Every query must:

- be unique across all sixty candidates
- use natural search language
- belong to one coherent search job
- match the family’s territory
- match the family’s dominant intent
- make sense for the family’s primary audience
- be satisfiable by the family’s likely page type
- be concise
- be written in lowercase
- contain no leading or trailing whitespace
- contain no repeated internal whitespace
- contain no trailing punctuation
- avoid unnecessary modifiers
- avoid the company’s brand name
- avoid competitor brand names
- avoid unsupported industries, integrations, audiences, or use cases

Most queries should contain between two and eight words.

Longer queries are allowed only when they sound like a natural search.

Do not generate article titles disguised as queries.

Do not add a year unless the topic genuinely requires freshness.

Do not pad a family with unnatural long-tail phrases merely to reach ten candidates.

If the exact market wording is uncertain:

- use the most natural broader phrasing
- mark the uncertainty in `generation_quality`
- do not invent a hyper-specific query

# Query Types

Use only these `query_type` values:

- `core`
- `problem`
- `how_to`
- `template`
- `comparison`
- `tool`
- `buyer_question`
- `alternative_phrase`

Use `core` for the most direct market phrase.

Use `problem` for pain-driven wording.

Use `how_to` for implementation or improvement searches.

Use `template` for template, checklist, worksheet, spreadsheet, or playbook searches.

Use `comparison` for comparing methods, approaches, or solution types.

Use `tool` for software, apps, generators, calculators, or solution-category searches.

Use `buyer_question` for natural evaluation questions.

Use `alternative_phrase` for different market wording with the same underlying intent.

A `problem_demand` family must not contain a `tool` query.

A `solution_demand` family may contain `tool`, `comparison`, `buyer_question`, `core`, or `alternative_phrase` queries when they preserve commercial or transactional intent.

# Candidate Mix Rules

Do not force all query types into every family.

The query mix must preserve the family’s underlying intent.

A problem-demand family will usually prioritize:

- `core`
- `problem`
- `how_to`
- `template`
- `buyer_question`
- `alternative_phrase`

A solution-demand family will usually prioritize:

- `core`
- `tool`
- `comparison`
- `buyer_question`
- `alternative_phrase`

Do not insert a commercial software query into a problem-demand family merely to diversify query types.

Do not insert an informational how-to query into a commercial family merely to diversify query types.

# Global Query Uniqueness Rules

Uniqueness applies globally across the entire artifact—not separately within each family.

A query may appear only once among all sixty candidates.

For uniqueness checking, normalize every query by:

1. removing leading whitespace
2. removing trailing whitespace
3. converting the complete query to lowercase
4. treating repeated internal whitespace as a single space

For example, all of the following must be treated as the same query:

- `SEO Content Workflow`
- `seo content workflow`
- ` seo content workflow `
- `seo  content  workflow`

Maintain an internal global registry of normalized queries while constructing the output.

When adding a candidate:

1. normalize the proposed query
2. check the complete global registry
3. accept it only if the normalized value does not exist
4. immediately add the accepted normalized value to the registry
5. otherwise generate a different query and repeat the check

This check must include:

- candidates in the same family
- candidates in every other problem-demand family
- candidates in every solution-demand family

If a collision exists, replace the later occurrence.

Do not repair duplicates by making meaningless changes such as:

- adding unnecessary words
- switching singular to plural when intent is unchanged
- rearranging the same words
- adding an ICP modifier when it does not improve natural search intent
- adding `best`, `top`, `platform`, `software`, or `tool` solely to evade duplication

A replacement must be:

- natural search language
- meaningfully distinct
- relevant to the current family
- consistent with the family’s territory and intent
- different after normalization

Before returning the response, recount the normalized registry.

The registry must contain exactly sixty entries.

If it contains fewer than sixty entries, duplicates still exist. Repair them before returning the structured output.

Do not include the registry itself in the output.

# Near-Duplicate Rules

Avoid near-duplicates when they provide no meaningful additional validation value.

Examples of weak near-duplicate pairs:

- `seo workflow tool`
- `seo workflow tools`

- `content brief generator`
- `content briefs generator`

- `software for seo content planning`
- `seo content planning software`

Near-duplicates are allowed only when they represent a plausible and meaningfully different way a buyer may search.

Do not allow the same generic query to act as a candidate for two different families.

If a query could reasonably belong to multiple families, assign it only to the single best-fitting family and generate a different candidate for the other family.

# Search Intent Rules

Use one of:

- `informational`
- `commercial`
- `transactional`

Use `informational` when the searcher wants to learn, diagnose, understand, or implement.

Use `commercial` when the searcher is evaluating approaches, product categories, software, or tools.

Use `transactional` when the searcher is close to selecting or adopting a solution.

Assign one dominant search intent to each family.

All ten candidates must be compatible with that dominant intent.

Do not derive search intent from the family ID.

# Buyer Stage Rules

Use one of:

- `problem_aware`
- `solution_aware`
- `vendor_aware`

Use `problem_aware` when the searcher understands the pain or job but does not necessarily know the solution category.

Use `solution_aware` when the searcher knows the solution category or product approach.

Use `vendor_aware` only when the dominant query set indicates that the searcher is actively deciding which solution or vendor to select.

Signals of vendor-aware intent may include:

- `best`
- explicit alternatives
- direct solution comparisons
- choosing between product categories
- queries asking which tool to select

Do not use `vendor_aware` merely because:

- the family is `solution_03`
- the product has a distinctive capability
- the query contains `software`
- the query contains `tool`
- the searcher knows a solution category exists

Because competitor and brand queries are prohibited during this step, many solution-demand families should remain `solution_aware`.

# Page Type Rules

Use one of:

- `guide`
- `workflow`
- `problem_article`
- `template`
- `category_page`
- `use_case_page`
- `comparison`
- `alternatives`
- `tool`
- `landing_page`

Select the page type based on the page that could best satisfy all ten queries.

Do not derive page type from the family ID.

Use:

- `guide` for broad educational understanding or implementation
- `workflow` for a repeatable process
- `problem_article` for diagnosis or explanation
- `template` when the dominant intent seeks a reusable asset
- `category_page` for a recognized software or solution category
- `use_case_page` for software applied to one specific job
- `comparison` for comparing defined approaches or solution types
- `alternatives` for non-branded alternative-seeking intent
- `tool` when the expected result is primarily an interactive utility
- `landing_page` only when a focused commercial page is more appropriate than the other defined page types

The page type remains a hypothesis and will be checked against the actual SERP later.

# Product Relevance Rules

Use:

- `high`
- `medium`
- `low`

Use `high` when the family directly connects to:

- the primary ICP
- a core buyer pain
- the established product category
- a core product capability

Use `medium` when:

- the connection is useful but less direct
- the family targets a supported secondary audience
- the family relies on uncertain market language
- the product capability is secondary rather than central

Use `low` only when the family is exploratory.

Do not mark every family `high` automatically.

If a low-relevance family is included, explain the risk in `generation_quality.potential_risks`.

# Confidence Rules

Confidence means how strongly the company profile supports the family set.

Confidence does not mean:

- proven demand
- proven rankability
- proven conversion potential
- proven traffic

Because no keyword or SERP data exists yet, `generation_quality.overall_confidence` should normally be `medium`.

Use `high` only when the company profile is exceptionally complete and the family set is strongly supported.

# Warning Rules

Use top-level `warnings` when the company or topic introduces a material limitation that downstream steps should not ignore.

Examples include:

- medical or health advice
- legal guidance
- financial guidance
- regulated products
- safety-sensitive instructions
- a major ambiguity in the company’s primary ICP
- insufficient evidence for six coherent families

Do not use warnings for ordinary keyword uncertainty. Put ordinary uncertainty in `generation_quality`.

# Generation Quality Rules

Use `generation_quality` to summarize:

- whether the profile clearly supported six coherent families
- what important information was missing
- what assumptions were necessary
- whether any family targets a secondary audience
- whether any family is exploratory
- which topics require market-language validation
- whether product terminology may not reflect search terminology
- that the 60 candidates are seeds rather than a complete keyword universe
- that search demand and rankability remain unvalidated

Do not claim that the generated families are final priorities.

# Final Validation

Before returning the output, confirm all of the following.

## Structure

- exactly six query families exist
- exactly three use `problem_demand`
- exactly three use `solution_demand`
- all required family IDs are present
- every family contains exactly ten query candidates
- exactly sixty total candidates exist
- every family contains one or two evidence items

## Family coherence

- each family represents one search job
- each family targets one primary audience
- each family has one dominant intent
- one focused page could reasonably satisfy all ten queries
- no family combines unrelated capabilities
- no family combines independent funnel stages merely to fill a slot
- no family combines primary and secondary audiences

## Territory integrity

- every problem-demand query expects an educational, workflow, template, checklist, or explanatory result
- no problem-demand query primarily expects software, an app, a generator, a calculator, or a tool
- no problem-demand query uses the `tool` query type
- every solution-demand query reflects software, tool, automation, category, comparison, or product-selection intent
- mirrored problem and solution topics remain clearly separated by expected result type

## Metadata integrity

- metadata was derived from the query set rather than the family ID
- `solution_03` was not automatically marked `vendor_aware`
- `solution_03` was not automatically assigned `landing_page`
- every family’s search intent matches all ten queries
- every family’s buyer stage matches the dominant query set
- every page type could satisfy all ten queries
- product relevance reflects actual support rather than defaulting to `high`

## Market-language integrity

- no product differentiator was automatically treated as search demand
- no internal product terminology was used without plausible buyer-search intent
- no family was constructed around a marketing slogan
- no query was created merely by combining words from the company profile
- no unsupported integration, audience, or use case was introduced

## Global uniqueness

- create the normalized form of every query
- compare all sixty normalized values globally
- the normalized-query registry contains exactly sixty entries
- no normalized query occurs more than once
- no duplicate exists within a family
- no duplicate exists across families
- every repaired query still belongs to its assigned family
- no replacement was created using a meaningless modifier

## Evidence

- every `source_field` refers to a value in the company profile
- every `evidence_text` corresponds to its stated `source_field`
- evidence supports company relevance without claiming search demand

## Scope

- no primary query has been selected
- no content architecture has been created
- no search volume or rankability claims were made
- no competitor brands were invented
- no company brand name appears in a query
- no unsupported company facts were introduced
- the output is treated as a seed set for later expansion and validation

If any check fails, repair the structured data and repeat the complete validation before returning it.

Do not return a partially valid artifact.

# Output Semantics

Return valid structured output matching `QueryCandidatesSchema`.

Do not add commentary outside the structured output.

Do not include the internal normalized-query registry.

Do not expose hidden reasoning or chain-of-thought.