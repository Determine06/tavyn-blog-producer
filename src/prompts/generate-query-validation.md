---

prompt_name: generate-query-validation
prompt_version: 0.9.0
output_mode: structured_json
schema_name: QueryValidationBatchSchema
model: gpt-5.4-mini
reasoning_effort: low
temperature: 0.1
max_output_tokens: 30000
------------------------

# Developer Instructions

## Task

Evaluate whether each supplied search query is topically relevant enough to remain in the company’s SEO opportunity pool.

This is a broad SEO relevance check, not final keyword selection.

A query is `valid` when a knowledgeable SEO strategist could reasonably consider creating content targeting that search query on this company’s website.

The content should feel natural and credible coming from the company and should attract searchers meaningfully connected to its product, market, audience, problems, workflows, capabilities, category, or outcomes.

The query does not need to mention the exact product, describe something the product completely solves, or show purchase intent. Informational, educational, early-funnel, comparison, and meaningfully adjacent queries can still be valid SEO opportunities.

A query is `invalid` when its ordinary search intent falls outside the company’s natural SEO territory or can only be connected through a forced interpretation, a missing qualifier, or a generic shared word.

Use this central judgment:

> Would targeting this exact search query make strategic sense for this company’s SEO, given what the searcher is actually looking for?

Preserve reasonable SEO breadth, but reject semantic drift.

## Understand the Company

Before evaluating the queries, privately build a clear understanding of:

* what the company sells
* who it serves
* the problems and workflows it supports
* its important capabilities and approaches
* the outcomes it can meaningfully influence
* its market, product category, and directly adjacent categories

Treat the company profile as a connected description of the company’s SEO territory, not as a list of words that must appear in every query.

Use the supplied company profile as the source of company-specific facts. You may use general knowledge to understand the ordinary meaning of search queries, products, industries, workflows, categories, and named entities.

Do not invent unsupported company capabilities, audiences, or markets.

## Evaluate Search Intent

Interpret every query according to its dominant, ordinary search intent.

Judge the complete query rather than isolated words. Generic words such as `customer`, `product`, `support`, `management`, `workflow`, or `software` do not establish relevance on their own.

Do not invent a specialized article angle that changes what the query ordinarily means. If an important industry, audience, problem, or use-case qualifier would need to be added before the query became relevant, return `invalid`.

Malformed, incomplete, or incoherent queries should be invalid when they do not express a usable search topic.

There is no target acceptance rate. Evaluate every query independently based on its actual SEO relevance to the supplied company.

### Calibration Example

For a customer-feedback and product-management platform:

Valid queries could include:

* `customer feedback questions`
* `customer retention strategies`
* `product management strategy`
* `product feedback tools`
* `customer service vs customer support`
* `product roadmap examples`
* `support crm`

Invalid queries could include:

* `customer names`
* `abbreviation for product`
* `for product`
* `product packaging`
* `property management software`
* `inventory management software`
* `project management software for accountants`
* `product management bootcamp`

The valid examples represent search intents that naturally belong within the company’s SEO territory.

The invalid examples are connected only through generic vocabulary, an unrelated product category, malformed wording, or unrelated search intent.

Apply the same strategic judgment to the supplied company. Do not mechanically copy the classifications from this example.

## Scope of This Stage

Later pipeline stages will evaluate:

* search volume
* CPC
* competition
* ranking potential
* commercial value
* content format
* opportunity scores
* final blog recommendations

Do not reject an otherwise relevant query because it may perform poorly on one of those dimensions.

This stage should only determine whether the query belongs in the company’s credible SEO opportunity space.

## Runtime Input

The runtime input contains:

* `company_profile`
* `batch_metadata`
* `queries`

This is one ordered batch from a larger validation run.

`batch_metadata` contains:

* `batch_number`
* `total_batches`

Each query contains:

* `query_id`
* `territory`
* `query`

Use `territory` only as context for understanding how the query was discovered. Do not return it.

## Required Output

Return a strict JSON object with exactly this structure:

```json
{
  "query_validations": [
    {
      "query_id": "problem_demand_001",
      "verdict": "valid",
      "reasoning": "This query represents a natural SEO topic for the company because it addresses a workflow closely connected to its product and audience."
    }
  ]
}
```

The root object must contain only:

* `query_validations`

Each validation must contain only:

* `query_id`
* `verdict`
* `reasoning`

Do not return:

* `territory`
* `query`
* company information
* artifact metadata
* batch metadata
* any additional fields

## Output Integrity

Return exactly one validation for every supplied query.

Preserve the exact input order.

Copy every `query_id` exactly as provided.

Do not add, remove, combine, reorder, or duplicate queries.

`verdict` must be exactly:

* `valid`
* `invalid`

`reasoning` must be one concise, self-contained sentence explaining why the query’s actual search intent does or does not belong within the company’s SEO territory.

Before responding, verify privately that:

1. Every input query has exactly one result.
2. The results remain in input order.
3. Every `query_id` is copied exactly.
4. No `query_id` is duplicated.
5. Every verdict is either `valid` or `invalid`.
6. Every result contains only the three required fields.
7. The response conforms to `QueryValidationBatchSchema`.
