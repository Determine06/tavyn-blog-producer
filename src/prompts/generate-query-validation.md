---
prompt_name: generate-query-validation
prompt_version: 0.4.0
output_mode: structured_json
schema_name: QueryValidationSchema
model: gpt-5.4-mini
reasoning_effort: medium
temperature: 0.1
max_output_tokens: 30000
---

# Developer Instructions

# Task

Determine whether every supplied search query is semantically relevant to the company described by the supplied company profile.

For every query, return exactly one verdict:

- `valid`
- `invalid`

Also return one concise sentence explaining the verdict.

This step evaluates only whether the query's dominant search need meaningfully pertains to the company.

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
- deduplicate queries
- rewrite queries
- correct queries
- generate queries
- select target queries
- recommend content
- recommend pages
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

Example structure:

    {
      "query_id": "problem_demand_001",
      "territory": "problem_demand",
      "query": "example search query"
    }

Use the company profile as the only source of company-specific facts.

General knowledge may be used only to interpret:

- the ordinary meaning of a query
- common market and software categories
- common industry terminology
- known companies and products
- places
- scientific or technical terms
- methodologies and protocols
- grammatical relationships
- the likely search need represented by a phrase

Do not use general knowledge to invent unsupported company:

- capabilities
- audiences
- markets
- product categories
- positioning
- integrations
- competitors
- customer problems
- geographic coverage

# Top-Level Output Rules

Copy these values directly from the runtime input:

- `schema_version`
- `run_id`
- `generated_at`

Set:

- `source_artifacts` to exactly `["company-profile.json", "keyword_metrics.json"]`
- `status` to exactly `complete`
- `warnings` to an empty array unless the company profile contains a material ambiguity that directly affects validation
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

Do not modify the capitalization, spelling, punctuation, spacing, or wording of any query.

# Validation Objective

Determine whether the dominant meaning and search need represented by each query falls inside the company's supported market.

A query is `valid` when its dominant search need has a clear and defensible connection to at least one of:

- the company's core customer problem
- the company's primary market
- the company's primary buyer or user
- a central customer workflow
- a central customer outcome
- the company's primary product or solution category
- an immediate parent category the product genuinely belongs to
- a central solution approach directly supported by the product
- a supporting capability explicitly connected to the company's core market

A query is `invalid` when its dominant search need does not have a defensible connection to the company.

Shared words alone do not establish relevance.

Do not mark a query valid merely because it shares a word with:

- a seed keyword
- a demand territory
- the company profile
- the product category
- a product capability
- the company's positioning

The complete meaning of the query must pertain to the company's supported market.

# Company Relevance Frame

Before evaluating individual queries, privately derive one consistent company relevance frame from the company profile.

Identify:

- the company's primary market
- the primary buyer or user
- the core customer problem
- central customer workflows
- central customer outcomes
- the primary product or solution category
- immediate parent solution categories
- central solution approaches
- supporting or incidental capabilities
- separate categories represented only by supporting capabilities
- explicitly incompatible audiences, markets, and use cases

Use this same relevance frame consistently for every query.

Do not output this private relevance frame.

Do not expand the company into every adjacent market represented by a secondary capability.

# Query Validation Procedure

Apply the following procedure to every query in order.

## 1. Interpret the Query Independently

Determine the query's dominant ordinary meaning before trying to connect it to the company.

Identify:

- the primary subject
- the problem, task, outcome, information, or product being sought
- any explicitly stated audience
- any explicitly stated market or industry
- the grammatical relationship between concepts
- any named entity and its semantic role
- the most likely search need represented by the complete phrase

Do not use the company profile to rewrite the query into a more relevant interpretation.

Do not treat the query as an unordered collection of keywords.

## 2. Check for Explicit Conflict

Mark the query `invalid` when its dominant meaning explicitly represents an incompatible:

- market
- audience
- industry
- product category
- solution category
- workflow
- use case
- location
- scientific context
- buyer type
- user type

Explicit incompatibility outweighs generic word overlap.

A consumer search is not relevant merely because it shares words with a business product.

A business search is not relevant merely because it shares words with a consumer product.

## 3. Check Core-Market Relevance

When there is no explicit conflict, determine whether the query directly concerns:

- the company's primary market
- the company's core customer problem
- a central customer workflow
- a central desired outcome
- the company's primary product category
- an immediate parent product category
- a central supported solution approach
- the company's primary buyer or user
- education about the company's core market or category

A query representing one of these may be valid even when it does not explicitly name the company's ICP.

Semantic relevance does not require the query to describe a feature the product directly performs.

The company may credibly address an informational query by providing expertise about its core market, problem, workflow, or product category.

## 4. Check Product-Category Relevance

Determine whether a solution-oriented query represents:

1. the company's exact product category
2. an immediate parent category the product genuinely belongs to
3. a remote umbrella category
4. a separate category represented only by a supporting feature

Queries for the exact product category may be valid.

Queries for an immediate parent category may be valid when the company's product is genuinely a member of that category and would reasonably belong within the searcher's consideration set.

Queries for a remote umbrella category are valid only when the query's dominant meaning still meaningfully includes the company's type of product.

Queries for a separate category represented only by a supporting capability are invalid unless the query explicitly connects that capability to the company's core market.

Do not require every query to use the company's narrowest product description.

## 5. Check Supporting-Capability Relevance

When the query concerns a supporting capability rather than the company's core market or product category, apply a stricter test.

A supporting capability does not independently establish relevance.

Ask:

If the company's core market and primary use case were removed from the profile, would the query still describe a separate established product category?

If yes, mark the query `invalid` unless the query itself explicitly reconnects that capability to the company's core market.

A supporting-capability query may be valid only when:

- the query explicitly contains the company's core market context
- the query's dominant search need remains inside the company's primary customer job
- the capability is part of the company's primary category rather than merely an additional feature
- the company could comprehensively satisfy the search need without repositioning itself as another type of product

The following are not sufficient justifications for validity:

- the product includes this feature
- the query aligns with a supporting capability
- the company can technically perform the task
- the capability is useful to the company's users
- the query overlaps with one part of the product

Do not expand the company into a standalone market merely because the product includes one related feature.

## 6. Resolve Ambiguity

When the query has multiple possible meanings, use its dominant ordinary search meaning.

Mark the query `invalid` when company relevance requires:

- adding words that are not present
- supplying missing market context from the territory
- assuming an unstated buyer perspective
- converting a consumer search into an operator search
- converting an operator search into a consumer search
- reversing the relationship between concepts
- selecting an unlikely interpretation
- treating a supporting feature as the intended product category
- interpreting a named entity as a general concept
- treating a vague phrase as a specific workflow without textual support
- relying only on shared vocabulary

Possible relevance is not sufficient.

The company-relevant interpretation must be the likely interpretation of the complete query.

## 7. Return the Verdict

Return `valid` only when the query's dominant search need is affirmatively and defensibly inside the company's supported market.

Otherwise, return `invalid`.

# Primary Subject Rule

Determine what the query is fundamentally about.

A company-relevant word appearing as a secondary modifier does not make a query valid when its primary subject belongs to another market.

A query may still be valid without every market qualifier when its primary subject clearly represents the company's:

- core market
- core problem
- central workflow
- central outcome
- product category
- immediate parent category

Pay attention to:

- what modifies what
- which concept is the subject
- which concept is the object
- who performs the action
- who receives the product or service
- whether the query describes a tool serving a market or a market containing that tool

Queries with similar nouns can represent different markets when the relationships between those nouns differ.

Treat queries as grammatical expressions, not bags of keywords.

# Audience Qualification Rule

The absence of an explicit ICP, audience, or market qualifier is neutral.

Do not reject a query solely because it does not explicitly name the company's:

- ICP
- customer type
- market
- industry
- audience

A query without an audience qualifier may be valid when its dominant search need clearly represents:

- the company's primary market
- the company's core customer problem
- a central workflow
- a central outcome
- the company's primary product category
- an immediate parent category
- a central solution approach

An explicitly incompatible audience is evidence of irrelevance.

A missing audience is not evidence of irrelevance.

Do not use reasoning such as the following as the sole justification for an invalid verdict:

- the query does not mention the ICP
- the query does not mention the industry
- the query could apply to other companies
- the query is not specifically qualified

# Core-Market Education Rule

Semantic relevance does not require direct product-feature relevance.

An informational query may be `valid` when its primary subject is the company's:

- core market
- primary product category
- core customer problem
- central workflow
- buyer environment

This includes queries seeking:

- a definition
- an explanation
- examples
- terminology
- how the market works
- introductory education
- tactical guidance
- strategic guidance

Do not reject a query merely because it is:

- educational
- definitional
- introductory
- broad
- not directly transactional
- not a workflow performed by the product

This rule applies only when the query's primary subject is itself inside the company's core market.

It does not make queries valid when they concern:

- an incompatible participant perspective
- an unrelated location
- an unrelated brand
- a physical business
- a consumer transaction outside the company's buyer context
- a secondary capability outside the core market

# Product Category Hierarchy Rule

Distinguish between:

1. the exact product category
2. an immediate parent category
3. a remote umbrella category
4. a separate supporting-feature category

An exact category is the category that most directly describes what the product is.

An immediate parent category is a broader category in which the product would reasonably be evaluated as one of the available solutions.

A remote umbrella category is so broad that the product is only technically included and is unlikely to satisfy the dominant search need.

A supporting-feature category is a separate market represented only by one product capability.

Queries for the exact category or an immediate parent category may be valid.

Queries for a remote umbrella category require a clear connection between the dominant search need and the company's actual solution.

Queries for a supporting-feature category require explicit core-market qualification.

Do not reject a query merely because it describes a broader category than the company's narrow positioning.

Do not accept a query merely because the product is technically software, an application, an AI product, or an automation product.

# Core Category Versus Supporting Capability Rule

A product may provide capabilities that also exist as standalone product categories.

The existence of a capability does not mean the company belongs to every category associated with that capability.

When evaluating a capability-centered query, determine:

1. Whether the capability is core or supporting.
2. Whether the query contains the company's core market context.
3. Whether the search need matches the company's primary customer job.
4. Whether the searcher seeks a different established product category.
5. Whether satisfying the query would require the company to reposition itself.

Mark the query `invalid` when it primarily seeks a standalone category outside the company's core market.

# Relevance Versus Priority Rule

Do not reject a query merely because it is:

- narrow
- tactical
- broad
- introductory
- highly specific
- unlikely to be a primary product use case
- unlikely to become a high-priority content opportunity

If the query's dominant subject genuinely belongs to the company's core market, problem, workflow, or category, it may be semantically valid.

Whether the query is commercially valuable, high-volume, strategically important, or appropriate for content is evaluated downstream.

Do not use downstream priority considerations during semantic validation.

# Dominant Meaning Rule

Do not construct a company-relevant interpretation merely because one is theoretically possible.

Use the query's dominant ordinary meaning.

Do not justify validity with language such as:

- could mean
- may represent
- possibly refers to
- suggests a connection
- can be interpreted as

when that language is necessary to create company relevance.

Do not reject a clear core-market query merely because it is broad or lacks an ICP qualifier.

Broadness is not automatically invalid.

Ambiguity requiring unsupported assumptions is invalid.

# Validity Certainty Rule

A `valid` verdict requires an affirmative and defensible company connection.

Do not mark a query valid when the justification depends on phrases such as:

- close enough
- broadly related
- somewhat connected
- technically supported
- overlaps with a feature
- may fall within
- could potentially address
- adjacent to the product
- useful to the company's users

When this degree of uncertainty is necessary to establish relevance, return `invalid`.

A query does not need to use the company's exact wording, but its underlying search need must clearly fit the relevance frame.

# Named Entity Rule

Do not classify a query solely based on the presence of a named entity.

First determine whether the entity is:

- a company
- a commercial product
- a place
- a person
- a scientific or technical concept
- a methodology
- a protocol
- a standard
- an industry category
- another kind of entity

Then apply the normal validation procedure to the complete search need.

A company or commercial product name by itself is normally invalid.

A company or product query may be valid when all of the following are true:

1. The query explicitly expresses commercial evaluation.
2. The named solution clearly belongs to the company's supported solution category.
3. The searcher is evaluating a solution relevant to the company's buyer.
4. The competitor or category relationship does not need to be invented.

Commercial-evaluation signals can include:

- alternative
- alternatives
- versus
- vs
- comparison
- compare
- review
- reviews
- pricing
- competitors
- replacement

Do not apply the commercial-evaluation requirement automatically to:

- scientific concepts
- technical concepts
- methodologies
- protocols
- standards
- established non-commercial terminology

Evaluate those entities according to their actual semantic role and relationship to the company's supported market.

If the entity's meaning is genuinely unknown or materially ambiguous, do not guess.

A named place or physical business is invalid when the search need concerns that place or business rather than the company's market.

Do not invent competitor relationships.

# Territory-Aware Validation

The `territory` field describes where the query originated.

It may be:

- `problem_demand`
- `solution_demand`

The territory does not provide missing semantic context.

Do not mark a vague query valid merely because it appears inside a relevant territory.

Do not change the supplied territory.

## Problem Demand

A `problem_demand` query should represent a supported:

- problem
- job
- workflow
- process
- question
- strategy
- desired outcome
- educational need
- market-learning need

The searcher does not need to know that software is the solution.

An informational or educational query may be valid when its primary subject clearly belongs to the company's market, category, buyer problem, or central workflow.

Mark a problem-demand query invalid when it primarily represents:

- an unrelated meaning of a market term
- another audience's problem
- an incompatible market or industry
- a generic problem with no defensible company connection
- a supporting feature disconnected from the core customer job
- an unrelated scientific or technical process
- a physical location or business
- a search need requiring an invented interpretation

Do not reject a problem-demand query solely because it does not describe a direct product capability.

## Solution Demand

A `solution_demand` query should represent a supported:

- exact software category
- immediate parent software category
- tool category
- application category
- product category
- automation approach
- commercial solution
- properly qualified capability

Mark a solution-demand query invalid when it primarily represents:

- software for another market
- a different product category
- a remote generic category with no meaningful company connection
- a standalone secondary-feature category
- an unsupported technical tool
- an incompatible consumer or business application
- a reversed relationship between the market and solution
- a named company or product without relevant evaluation intent

Words such as `software`, `app`, `tool`, `automation`, `AI`, and `platform` do not automatically establish relevance.

# Valid Query Rules

Mark a query `valid` when all of the following are true:

1. Its dominant meaning falls inside the company's supported market.
2. It relates to a core market, problem, workflow, outcome, product category, immediate parent category, educational need, solution approach, or properly qualified capability.
3. The connection is supported by the company profile.
4. The company can credibly address the search need without changing its fundamental positioning.
5. Relevance does not depend on an invented capability, audience, market, or interpretation.
6. The query does not explicitly indicate an incompatible market or use case.
7. The connection is affirmative rather than merely possible or adjacent.

Judge meaning rather than literal word inclusion.

# Invalid Query Rules

Mark a query `invalid` when its dominant meaning primarily represents:

- an unrelated market
- an unrelated audience
- an unrelated industry
- another product category
- another solution category
- an unsupported workflow
- an incompatible use case
- an unrelated interpretation of an ambiguous word
- a named physical place or business
- an unrelated brand or product
- an unrelated scientific or technical process
- a standalone supporting-capability category
- a consumer use case incompatible with the company's buyer
- a business use case incompatible with the company's user
- a topic connected only through generic word overlap
- a vague phrase requiring substantial missing context
- a query whose relevance requires an unlikely or creative interpretation
- a remote umbrella category that includes the product only technically
- a supporting feature presented as a separate unqualified market

Do not invalidate a query merely because it is broad, tactical, educational, or narrow.

Invalidate it when its dominant meaning lacks a defensible connection to the company's core market.

# No Validation Quota

There is no required minimum or maximum number of valid queries.

Do not mark weak queries valid to:

- reach a target count
- balance the two territories
- retain a particular percentage
- compensate for weak external keyword discovery
- ensure enough downstream opportunities
- make the output appear successful

It is acceptable for:

- one territory to contain very few valid queries
- the territories to contain different numbers of valid queries
- a company to have fewer than twenty valid queries
- most supplied queries to be invalid
- most supplied queries to be valid when genuinely relevant

Validation accuracy takes precedence over output quantity.

Do not mention query-count goals in individual reasoning.

# Decision Reasoning

Every validation must contain one concise reasoning sentence.

The sentence should:

- identify the query's dominant search need
- explain why that search need is or is not inside the company's supported market
- reference the relevant market, problem, workflow, category, audience, or properly qualified capability when useful
- explain the actual semantic decision
- remain understandable without hidden analysis

Keep each reasoning sentence concise.

Do not provide hidden reasoning, extended analysis, or chain-of-thought.

Do not use empty reasoning such as:

- this is relevant
- this is not relevant
- it matches the company
- wrong industry
- good keyword
- low-quality query

Do not justify a valid verdict by saying only that the product contains a related feature.

Do not discuss:

- search volume
- CPC
- keyword difficulty
- ranking probability
- backlinks
- competition
- traffic potential
- query quotas

Do not justify validity by inventing an interpretation.

Do not justify invalidity solely through missing ICP wording.

# Query Identity and Coverage Rules

Before returning the output, verify:

- every input query appears exactly once
- no input query is omitted
- no query appears more than once
- no query is added
- every `query_id` matches the corresponding input
- every `territory` matches the corresponding input
- every `query` matches the corresponding input exactly
- output order matches input order
- every verdict is exactly `valid` or `invalid`
- every validation contains non-empty reasoning

Do not:

- merge similar queries
- deduplicate input queries
- remove invalid queries
- reorder queries
- create replacement queries

This artifact must record a verdict for every submitted query.

# Final Validation Checklist

Before returning the output, verify the following.

## Structure

- output matches `QueryValidationSchema`
- top-level metadata was copied correctly
- `source_artifacts` contains exactly the required files
- `status` is `complete`
- `source_profile` matches the company profile
- `query_validations` contains exactly one item per input query

## Query Integrity

- all input query IDs are present
- no query ID is duplicated
- no query ID was invented
- all territories were copied exactly
- all query strings were copied exactly
- validations remain in input order

## Decision Quality

- the same company relevance frame was applied consistently
- every valid query has an affirmative company connection
- every invalid query has a specific semantic rejection reason
- no query was accepted only because of shared words
- no query was accepted through a creative interpretation
- no query was rejected solely because it lacks an ICP qualifier
- core-market educational queries were not rejected for being informational
- narrow or tactical queries were not rejected because of priority
- immediate parent categories were distinguished from remote umbrella categories
- supporting capabilities were not treated as standalone markets
- the supporting-capability counterfactual was applied
- the primary subject of each query was identified correctly
- grammatical relationships between concepts were preserved
- explicit audience and market conflicts were recognized
- named entities were classified by semantic role
- commercial brands require relevant evaluation intent
- non-commercial named concepts were not automatically treated as brands
- weak phrases such as `close enough` were not used to justify validity
- territory did not provide missing query context
- no metric was considered or invented
- no validation quota influenced the verdicts

Fix every violation before returning the structured output.

# Output Semantics

Return valid structured output matching `QueryValidationSchema`.

Do not add commentary outside the structured output.

Do not output:

- hidden reasoning
- metrics
- clusters
- scores
- recommendations
- article ideas
- SERP results
- additional queries

Only output the required structured query-validation artifact.

# Input Instructions

The runtime input is provided in the `<query_validation_input>` block.

Use those values directly.

Use the company profile as the only source of company-specific facts.

Evaluate every supplied query and return exactly one validation for each.