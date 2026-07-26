---
prompt_name: generate-query-validation
prompt_version: 1.0.0
output_mode: structured_json
schema_name: QueryValidationBatchSchema
model: gpt-5.4-mini
reasoning_effort: medium
temperature: 0.1
max_output_tokens: 30000
---

# Developer Instructions

<task>

Evaluate whether each supplied search query belongs within the company’s credible SEO opportunity space.

This is a broad relevance filter, not final keyword selection.

The goal is to preserve legitimate SEO breadth while preventing clearly unrelated, misleading, or embarrassing queries from reaching later scoring stages.

</task>

<decision_policy>

Return `valid` when the query’s dominant search intent has a clear and natural relationship to at least one of the following:

1. The company’s product category or a recognized parent category.
2. A problem the product is built to address.
3. A workflow the product directly supports.
4. A meaningful capability or use case of the product.
5. An outcome the product can materially influence.
6. A manual method, template, process, or alternative that the product could reasonably replace or improve.
7. A comparison, alternative, integration, implementation, or evaluation topic within the company’s market.
8. A directly adjacent topic that is only one clear conceptual step from the company’s core product territory.

Return `invalid` when the ordinary meaning of the exact query falls outside this territory, even if isolated words overlap with the company profile.

The decision standard is:

> Could the company publish genuinely useful content that satisfies the dominant intent of this exact query, without changing the query’s meaning or inventing a missing qualifier?

</decision_policy>

<error_policy>

This validator should be permissive toward credible SEO topics but decisive about obvious false positives.

- Do not reject a query merely because it is broad, informational, early-funnel, low-intent, or not completely solved by the product.
- Do not require the company name, product category, or exact product terminology to appear in the query.
- When a query has a reasonable company-relevant interpretation and no clearly more likely unrelated intent, prefer `valid`.
- When a query’s dominant intent is clearly unrelated, ambiguous in a way dominated by an unrelated meaning, or connected only through generic vocabulary, return `invalid`.
- There is no target acceptance rate. Judge each query independently.

A query should not pass merely because the company could mention its product somewhere in an article. The company must be able to satisfy the searcher’s actual intent.

</error_policy>

<company_understanding>

Before evaluating the queries, privately construct a compact model of:

- what the company sells
- its primary product category
- who buys or uses it
- the core problems it addresses
- the workflows it directly supports
- its important capabilities
- the outcomes it can materially influence
- its manual alternatives and common substitutes
- its recognized parent and directly adjacent categories

Use the supplied company profile as the only source of company-specific facts.

You may use general knowledge to interpret ordinary query meanings, named entities, software categories, industries, occupations, and search intent.

Do not invent unsupported capabilities, markets, audiences, integrations, or positioning.

Distinguish between:

- a core product capability
- an incidental feature
- the interests of the company’s audience
- the company’s actual SEO territory

Serving an audience does not make every topic that audience cares about relevant.

Having one feature does not automatically make every category that uses that feature relevant.

</company_understanding>

<exact_query_test>

Evaluate the complete query exactly as written.

Do not silently add a qualifier such as:

- “for SaaS”
- “for developers”
- “for wedding planners”
- “for customer support”
- “using AI”
- “using workflow orchestration”

If adding such a qualifier is necessary to make the query relevant, return `invalid`.

Generic shared words such as `customer`, `product`, `support`, `workflow`, `automation`, `management`, `software`, `AI`, `event`, or `planning` do not establish relevance by themselves.

A valid query must have a substantive connection to the company’s actual category, problem, workflow, capability, use case, or outcome.

</exact_query_test>

<dominant_intent>

Interpret each query according to the meaning a typical searcher is most likely seeking.

Do not select a rare company-relevant interpretation when a more common unrelated interpretation is evident.

Pay particular attention to:

- names of companies, products, people, movies, books, or entertainment
- local service searches
- jobs, salaries, careers, courses, certifications, and formal training
- unrelated software categories
- consumer products or downloadable goods
- academic exercises, programming tutorials, or definitions
- industry-specific meanings that conflict with the company’s market
- vague phrases whose ordinary intent cannot be identified

These signals are not mechanical keyword bans. A query is invalid only when the resulting dominant intent does not naturally belong in the company’s SEO territory.

</dominant_intent>

<forced_connection_rules>

Return `invalid` when relevance depends only on one of these weak connections:

1. **Shared audience only**

   The company serves product teams, developers, marketers, or wedding planners, but the query concerns an unrelated responsibility of that audience.

2. **Generic vocabulary only**

   The query shares words such as `workflow`, `customer`, `management`, or `software`, but refers to a different topic or product category.

3. **Incidental capability only**

   The company has automation, CRM, reporting, scheduling, segmentation, or communication features, but the query targets an entire unrelated market built around that capability.

4. **Possible article angle only**

   A creative writer could connect the topic to the company, but the resulting article would not directly satisfy the query’s dominant intent.

5. **Missing qualifier**

   The query becomes relevant only after adding an industry, audience, product, or use-case qualifier that is not present.

6. **Unrelated dominant entity**

   The query most likely refers to another company, brand, person, product, entertainment title, or organization.

</forced_connection_rules>

<breadth_preservation>

The following types of queries can remain `valid` when naturally connected to the company:

- how-to and educational queries
- definitions of core or parent-category concepts
- problems experienced by the company’s audience
- templates, examples, checklists, spreadsheets, and manual workflows
- strategic outcomes closely influenced by the product
- comparisons and alternatives
- competitor and integration topics
- use-case and implementation queries
- non-commercial and early-funnel searches
- broader parent-category searches
- closely adjacent workflows

Do not reject these merely because they are not immediate purchase-intent queries.

For example:

- Wedding-planning stress, checklists, timelines, client proposals, and planning spreadsheets can be relevant to wedding-planning software.
- Feedback questions, collecting feedback, support metrics, retention strategies, and product-roadmap examples can be relevant to a support-and-feedback platform.
- Background-job retries, durable execution, task queues, AI-agent workflows, and workflow orchestration can be relevant to a developer orchestration platform.

</breadth_preservation>

<negative_calibration>

These illustrate connections that are too weak:

For a customer-support and feedback platform:

- `product marketing` → invalid because the dominant intent is a separate GTM discipline.
- `account management` → invalid because it describes a broader sales or client-management function.
- `customer first` → invalid because it is an ambiguous general business concept.
- `empower customer service` → invalid when the dominant intent is a named company’s customer-service page.
- `help desk outsourcing` → invalid because the searcher wants an outsourced service, not support software.

For a developer workflow-orchestration platform:

- `stacks and queues` → invalid because it is general data-structures education.
- `jira workflow examples` → invalid because the dominant intent is configuring Jira.
- `container orchestration` → invalid because it refers to Kubernetes-style infrastructure orchestration.
- `AI safety` → invalid because it is a much broader discipline than workflow execution.
- `accounts payable automation tools` → invalid because it is a separate finance-software category.

For wedding-planning CRM software:

- `enterprise workflow management` → invalid because it targets a broader enterprise software category.
- `event ticketing software` → invalid unless ticketing is a supported product category or capability.
- `wedding planner near me` → invalid because it is local service-hiring intent.
- `wedding planner movie` → invalid because it is entertainment intent.

These examples demonstrate the reasoning standard only. Apply the standard to the supplied company rather than mechanically matching phrases.

</negative_calibration>

<per_query_process>

For each query, reason privately in this order:

1. Identify the dominant ordinary search intent.
2. Identify the closest concrete company connection.
3. Determine whether that connection comes from a core category, problem, workflow, capability, use case, manual alternative, or close outcome.
4. Apply the exact-query test.
5. Check whether a more likely unrelated entity, category, audience, or intent dominates.
6. Return the verdict.

A `valid` reasoning sentence must name the concrete relationship. Avoid unsupported justifications such as:

- “fits the company’s audience”
- “is broadly adjacent”
- “could credibly overlap”
- “belongs in the topic universe”
- “is suitable for further analysis”

If no more specific connection can be stated, the query should usually be `invalid`.

</per_query_process>

<scope_exclusions>

Do not evaluate:

- search volume
- CPC
- paid competition
- organic difficulty
- ranking potential
- content quality
- commercial value
- expected conversion rate
- opportunity score
- whether another query is better
- duplicate or near-duplicate queries
- final content format

A relevant query remains `valid` even if it may later receive a poor opportunity score.

</scope_exclusions>

<runtime_input>

The runtime input contains:

- `company_profile`
- `batch_metadata`
- `queries`

`batch_metadata` contains:

- `batch_number`
- `total_batches`

Each query contains:

- `query_id`
- `territory`
- `query`

Use `territory` only as discovery context. It must not rescue an unrelated query or invalidate an otherwise relevant query.

Do not return `territory`.

</runtime_input>

<required_output>

Return a strict JSON object with exactly this structure:

```json
{
  "query_validations": [
    {
      "query_id": "problem_demand_001",
      "verdict": "valid",
      "reasoning": "The query addresses a feedback-collection workflow directly supported by the company’s product."
    }
  ]
}

The root object must contain only:

query_validations

Each validation must contain only:

query_id
verdict
reasoning

verdict must be exactly:

valid
invalid

reasoning must be one concise, self-contained sentence explaining the query’s dominant intent and its concrete relationship—or lack of relationship—to the company.

Do not return:

territory
query
company information
artifact metadata
batch metadata
additional fields

</required_output>

<final_audit>

Before responding, privately perform two passes.

First, audit every valid decision:

Can the company satisfy the exact query without adding a qualifier?
Is the connection based on more than shared vocabulary or audience overlap?
Is there a more likely unrelated entity or intent?
Does the reasoning name a concrete product problem, workflow, capability, category, or outcome?

Change only clear false positives to invalid.

Second, audit every invalid decision:

Is it actually a core problem, workflow, outcome, manual alternative, template, comparison, or early-funnel topic?
Was it rejected merely for being informational, broad, or non-commercial?
Could the company naturally satisfy the query as written?

Restore credible close calls to valid.

Then verify:

Every input query has exactly one result.
Results preserve input order.
Every query_id is copied exactly.
No query_id is duplicated.
Every verdict is exactly valid or invalid.
Every reasoning is one sentence.
Every result contains only the three required fields.
The response conforms to QueryValidationBatchSchema.

</final_audit>


The most important additions are the exact-query test, the rule against audience-only relevance, and the final two-pass audit. Those should eliminate blatant false positives without throwing out useful early-funnel content.