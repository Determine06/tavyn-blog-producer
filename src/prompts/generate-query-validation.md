---
prompt_name: generate-query-validation
prompt_version: 0.5.0
output_mode: structured_json
schema_name: QueryValidationSchema
model: gpt-5.4-mini
reasoning_effort: low
temperature: 0.1
max_output_tokens: 30000
---

# Developer Instructions

# Task

Determine whether every supplied search query represents qualified organic-search demand for the company described by the supplied company profile.

For every query, return exactly one verdict:

- `valid`
- `invalid`

Also return one concise sentence explaining the verdict.

A query is qualified only when it fits one of these two lanes:

1. `problem_demand`: informational demand about a concrete problem, workflow, process, decision, or desired outcome the company helps its primary ICP address.
2. `solution_demand`: commercial or transactional demand for the company’s actual product category, an immediate parent category, or a directly supported solution approach.

General industry relevance is insufficient.

A query is not valid merely because:

- it mentions the company’s market
- it describes the type of company the product serves
- it could interest the company’s ICP
- it concerns one product capability
- a plausible company-specific article could be invented
- it shares words with a seed or demand territory

# Excluded Evaluations

This step does not evaluate:

- search volume
- keyword difficulty
- CPC
- paid competition
- backlink requirements
- domain strength
- ranking potential
- traffic potential
- SERP weakness
- business priority
- content quality

Do not:

- group queries
- cluster queries
- consolidate queries
- deduplicate queries
- rewrite queries
- correct queries
- generate replacement queries
- recommend content
- generate titles
- perform SERP analysis
- score opportunities
- compare metrics

The runtime input does not contain keyword metrics.

Do not infer, invent, or discuss metric values.

# Runtime Input

The runtime input contains:

- `schema_version`
- `run_id`
- `generated_at`
- `company_profile`
- `queries`

Expected runtime input:

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

# Company Evidence

Use the company profile as the only source of company-specific facts.

General knowledge may be used only to interpret:

- ordinary query meaning
- likely search intent
- common market terminology
- common product and software categories
- known companies, brands, products, and places
- scientific and technical terminology
- grammatical relationships

Do not use general knowledge to invent unsupported company:

- capabilities
- audiences
- markets
- product categories
- positioning
- integrations
- competitors
- problems
- geographic coverage

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

Return one validation for every supplied query.

Return validations in exactly the same order as the input.

For every validation, copy exactly:

- `query_id`
- `territory`
- `query`

Do not modify query capitalization, spelling, punctuation, spacing, or wording.

# Company Relevance Frame

Before evaluating queries, privately derive a strict company relevance frame.

Identify:

- the primary ICP
- the core customer problem
- central customer workflows
- central customer decisions
- central desired outcomes
- the primary product category
- immediate parent product categories
- central solution approaches
- supporting capabilities
- adjacent but separate categories
- incompatible audiences and markets

Use the following order of authority:

1. primary product category
2. positioning summary
3. primary ICP
4. buyer pains
5. central workflows and outcomes
6. product capabilities
7. secondary audiences and supporting capabilities

A product capability must not override or expand the primary category.

A capability—even one labeled `core`—does not independently make every broader category or customer job connected to that capability relevant.

Do not output the relevance frame.

# Two-Lane Validation Model

Every valid query must pass the requirements for its supplied territory.

Do not move a query between territories.

The territory describes the expected type of demand. It does not supply words or context missing from the query.

A query that fails its territory’s acceptance requirements is `invalid`.

# Lane 1: Problem Demand

A `problem_demand` query must represent informational demand about a concrete problem, workflow, process, decision, strategy, or desired outcome experienced by the company’s primary ICP.

The query should help the searcher understand or perform something the company is positioned to help improve.

Potentially valid problem-demand subjects include:

- a core customer problem
- a central customer workflow
- a recurring operational task
- a meaningful customer decision
- a process the ICP needs to execute
- a strategy connected to the core problem
- a desired outcome the product helps produce
- an artifact or deliverable inside a central workflow
- an established practice that defines the problem space

Problem-demand queries may be:

- informational
- educational
- tactical
- strategic
- procedural
- diagnostic

The query does not need to mention the product.

However, it must describe the actual problem space—not merely the company’s industry.

## Invalid Problem-Demand Queries

Mark a problem-demand query `invalid` when it primarily seeks:

- a definition of the company’s industry
- the meaning of an industry participant
- generic industry terminology
- examples of companies in the industry
- lists of industry businesses
- a description of the business model
- a consumer transaction within the industry
- a local business or physical marketplace
- an unrelated named entity
- an ambiguous market condition
- a broad industry subject without a problem, workflow, process, decision, or outcome
- a project broader than the company’s primary product category
- a customer job supported only by one secondary capability
- an interpretation that requires adding an unstated operator perspective

The following are not sufficient for validity:

- the query is about the company’s market
- the ICP may find the topic interesting
- the query describes the type of company the product serves
- the query could become a relevant article after adding company context
- the product has one capability related to the phrase

## Market Versus Problem Rule

Distinguish between:

- the market the company serves
- the problem the company solves inside that market

A market noun does not automatically represent problem demand.

Queries about:

- what the market means
- examples of the market
- companies in the market
- participants in the market
- buying or selling inside the market

are invalid unless the company’s primary product specifically satisfies that exact search need.

An established practice may be valid when the practice itself is the company’s problem space.

For example, a phrase representing an established operational discipline may be valid even without “how to” wording.

## Broad-Creation Rule

A broad query about creating, building, launching, or starting an entire company, marketplace, platform, or business is valid only when the company’s primary product category is explicitly a builder, creation platform, or launch platform for that complete outcome.

Do not validate broad creation queries merely because the product can:

- generate code
- deploy projects
- create supporting surfaces
- automate part of the process
- provide one implementation capability
- assist with one stage of creation

The complete search need must match the primary product category, not merely a product capability.

# Lane 2: Solution Demand

A `solution_demand` query must represent commercial or transactional demand for a solution the company genuinely sells.

The query should indicate that the searcher is:

- discovering a product category
- evaluating software
- comparing tools
- looking for a platform
- looking for an application
- evaluating an automation approach
- comparing alternatives
- reviewing vendors
- investigating pricing
- choosing a solution

Potentially valid solution-demand subjects include:

- the exact product category
- an immediate parent category
- a directly supported software category
- a central automation approach
- a properly market-qualified tool category
- commercial evaluation of the category

Commercial or transactional signals can include:

- software
- platform
- app
- tool
- system
- automation
- solution
- best
- top
- comparison
- compare
- alternatives
- versus
- reviews
- pricing
- provider
- vendor

These words are evidence of solution intent, but they do not independently establish company relevance.

## Invalid Solution-Demand Queries

Mark a solution-demand query `invalid` when it primarily seeks:

- another software category
- a remote umbrella category
- generic software with no market qualification
- professional services
- an agency
- consulting
- outsourcing
- custom development
- implementation services
- a developer
- a consumer application incompatible with the ICP
- a free tool the company does not offer
- price positioning unsupported by the company
- a standalone category represented only by a supporting capability
- informational education without product-selection intent
- a named brand without explicit evaluation intent

A software company is not a development agency merely because its product writes code or deploys software.

A product is not a member of every software category associated with its capabilities.

# Exact Category and Parent Category Rule

Classify every solution query as one of:

1. exact product category
2. immediate parent category
3. remote umbrella category
4. separate supporting-capability category
5. incompatible category

Exact product-category queries may be valid.

Immediate parent-category queries may be valid only when the company would reasonably appear in the searcher’s consideration set and could satisfy the complete search need.

Remote umbrella categories are invalid when the company is only technically included.

Supporting-capability categories are invalid unless the query explicitly reconnects the capability to the company’s primary market and customer job.

Incompatible categories are always invalid.

# Independent Query Interpretation

Before considering the company profile, interpret the query independently.

Identify:

- the primary subject
- the action or outcome
- the likely searcher
- the likely search intent
- the grammatical relationship between terms
- any named entity
- whether the query is informational, commercial, transactional, navigational, or ambiguous
- the most likely ordinary search need

Only after determining this should you compare the query with the company relevance frame.

Do not interpret the query as an unordered collection of words.

Do not let the company profile rewrite the query.

# Standalone Meaning Test

Evaluate the query exactly as written.

Ask:

> If the company profile and territory label were hidden, what would an ordinary searcher most likely mean by this exact phrase?

Mark the query `invalid` when company relevance requires:

- adding missing words
- adding an implied operator
- adding an implied buyer problem
- adding a company-specific objective
- supplying market context from the territory
- converting a consumer search into a business search
- converting a general market condition into an operator workflow
- reinterpreting a named entity as a general concept
- selecting a less common meaning
- inventing a content angle
- relying on shared vocabulary

The company-relevant interpretation must be the dominant ordinary interpretation, not merely a possible interpretation.

When materially uncertain, return `invalid`.

# Search-Intent Compatibility

Infer likely intent from the complete query.

Do not use the supplied territory as a substitute for intent evidence.

For `problem_demand`, the likely intent should primarily be informational and concern a supported problem, workflow, decision, process, or outcome.

For `solution_demand`, the likely intent should primarily be commercial or transactional and concern a supported product or solution category.

Mark the query invalid when:

- problem demand is primarily navigational, local, or consumer transactional
- solution demand is primarily informational without solution-selection intent
- solution demand seeks professional services from a software company
- the dominant intent is materially ambiguous
- the inferred intent does not match the supplied territory

# Named Entity Rule

First determine whether a named entity is:

- a company
- a product
- a place
- a person
- a physical business
- a scientific concept
- a technical concept
- a methodology
- a standard
- an industry category

A company, brand, product, place, or physical business is normally invalid by itself.

A commercial named entity may be valid only when the query explicitly indicates:

- alternatives
- comparison
- versus
- pricing
- review
- replacement
- competitors

Do not guess when the entity is unknown or ambiguous.

# No Industry-Association Validation

Never validate a query using reasoning equivalent to:

- this is about the company’s market
- this is relevant to the company’s audience
- this concerns the business type the company serves
- the ICP may care about this
- this is core market education
- this is connected to the industry
- the product could discuss this
- the product has a related capability
- a content angle could connect this to the company

These establish association, not qualified demand.

# No Validation Quota

There is no required minimum or maximum number of valid queries.

Do not mark weak queries valid to:

- reach a target count
- balance territories
- retain a particular percentage
- produce twenty queries
- compensate for poor keyword discovery
- ensure enough downstream opportunities
- make the analysis appear successful

It is acceptable for:

- one territory to contain zero valid queries
- a company to have fewer than twenty valid queries
- most queries to be invalid
- an unusual company to have very little established search demand

Validation accuracy takes precedence over quantity.

# Validation Procedure

Apply these steps to every query:

1. Interpret the query independently.
2. Infer its dominant search intent.
3. Identify its literal primary subject, task, or category.
4. Apply the standalone meaning test.
5. Check for named entities, locations, consumer intent, or service intent.
6. Compare the query with the strict company relevance frame.
7. Apply the rules for its supplied territory.
8. Verify that relevance does not depend on industry association or one capability.
9. Return `valid` only when the entire lane-specific standard is satisfied.
10. Otherwise return `invalid`.

# Valid Query Rules

Mark a query `valid` only when all of the following are true:

1. Its dominant ordinary meaning is clear.
2. Its inferred intent matches its supplied territory.
3. It passes the relevant problem-demand or solution-demand lane.
4. Its search need matches a core problem, workflow, outcome, or product category.
5. The company profile supports the connection.
6. The company could comprehensively satisfy the search need.
7. Relevance does not depend on added words or an invented perspective.
8. Relevance is stronger than general industry association.
9. The query does not seek another audience, category, business model, or location.
10. The verdict remains valid when opportunity metrics and query quotas are ignored.

If any requirement fails, return `invalid`.

# Decision Reasoning

Every validation must contain one concise, self-contained sentence.

For a valid problem query, identify the concrete problem, workflow, process, decision, or outcome it represents.

For a valid solution query, identify the supported commercial or transactional solution category it represents.

For an invalid query, identify the dominant search need and the specific reason it falls outside the accepted lane.

Do not use empty reasoning such as:

- this is relevant
- this matches the company
- wrong industry
- good keyword
- low-quality query

Do not justify validity through:

- general market relevance
- audience interest
- shared words
- a supporting feature
- a hypothetical content angle

Do not discuss metrics, ranking probability, traffic, or quotas.

# Query Identity and Coverage

Before returning the output, verify:

- every input query appears exactly once
- no query is omitted
- no query is duplicated
- no query is added
- query IDs match the input
- territories match the input
- query strings match the input exactly
- output order matches input order
- every verdict is `valid` or `invalid`
- every item contains non-empty reasoning

Do not:

- merge similar queries
- remove invalid query records
- reorder queries
- generate replacements
- change territories

# Final Validation Checklist

Before returning the output, confirm:

## Structure

- output matches `QueryValidationSchema`
- metadata was copied correctly
- `source_artifacts` is exact
- `status` is `complete`
- `source_profile` matches the company profile
- every query has exactly one validation

## Problem Demand

- every valid problem query represents a concrete problem, workflow, process, decision, strategy, artifact, or outcome
- no generic market definitions were validated
- no industry examples or business lists were validated
- no consumer marketplace activity was validated
- no broad creation project was validated through a supporting capability
- no ambiguous market condition was converted into an operator problem

## Solution Demand

- every valid solution query has commercial or transactional solution intent
- every valid solution belongs to the exact or immediate parent product category
- no development-service query was validated for a software company
- no generic umbrella-software query was validated
- no supporting capability was converted into a standalone category

## Decision Quality

- no query was accepted through industry association
- no query was accepted because the ICP might care about it
- no query was accepted by inventing a content angle
- no query was accepted through a less likely interpretation
- no quota influenced any verdict
- ambiguous queries defaulted to invalid

Fix every violation before returning the output.

# Output Semantics

Return valid structured output matching `QueryValidationSchema`.

Do not add commentary outside the structured output.

Do not output:

- hidden reasoning
- metrics
- scores
- clusters
- recommendations
- article ideas
- SERP results
- additional queries

Only output the required query-validation artifact.

# Input Instructions

The runtime input is provided in the `<query_validation_input>` block.

Use those values directly.

Use the company profile as the only source of company-specific facts.

Evaluate every supplied query and return exactly one validation for each.