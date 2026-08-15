---

prompt_name: generate-content-recommendation
prompt_version: 1.0.1
output_mode: structured_json
schema_name: ContentRecommendationDecisionSchema
model: gpt-5.4-mini
reasoning_effort: medium
temperature: 0.1
max_output_tokens: 10000
-----------------------

# Developer Instructions

# Task

Analyze the live Google organic results for every supplied query recommendation and produce one final editorial content recommendation for each query.

The input contains:

* a validated company profile
* exactly three previously selected query recommendations
* the existing selection reasoning, content angle, product connection, metrics, and opportunity score for each recommendation
* up to ten live organic results for each selected query
* each organic result's position, title, URL, domain, snippet, and displayed date when available

Analyze every supplied recommendation exactly once.

The response must contain exactly three analyses, preserving input order.

Do not select, reject, replace, merge, or reprioritize queries.

This step determines what the company should publish for each already-selected query based on the actual organic SERP.

# Analysis Objective

For each selected query:

1. determine what Google currently interprets the query to mean
2. determine the dominant search intent
3. determine the dominant ranking-page format
4. identify the recurring concepts and promises in titles and snippets
5. determine what kind of page the company should publish
6. generate an original recommended title
7. finalize a SERP-informed content angle
8. finalize a natural product connection
9. assign confidence
10. identify material warnings

The output must be useful for a lead-magnet content recommendation.

It is not a complete article brief, outline, or finished article.

# Required Procedure

For every supplied recommendation, complete the following procedure.

## Step 1: Confirm Query Identity

Copy the following values exactly:

* `recommendation_id`
* `query_id`
* `territory`
* `query`

Do not modify, correct, qualify, or rewrite the query.

## Step 2: Interpret the SERP

Review all supplied organic results for the query before reaching a conclusion.

Use:

* result positions
* titles
* domains
* snippets
* displayed dates when available

Determine the ordinary search need demonstrated by the ranking results.

Do not assume the query means what the company wants it to mean.

When the query wording and ranking results suggest different interpretations, follow the dominant ranking-result interpretation and record the mismatch in `warnings`.

## Step 3: Determine Dominant Intent

Set `dominant_intent` to exactly one of:

* `informational`
* `commercial`
* `transactional`
* `mixed`
* `unknown`

Use:

* `informational` when results primarily teach, explain, or guide
* `commercial` when results primarily compare, evaluate, recommend, or describe solution categories
* `transactional` when results primarily help users access, purchase, download, or use a specific product
* `mixed` when two or more materially different intents are strongly represented
* `unknown` only when the supplied organic results are insufficient to infer intent

Do not copy the provider keyword-intent label automatically.

The live ranking results are the primary evidence for this field.

## Step 4: Determine Dominant Page Type

Set `dominant_page_type` to exactly one of:

* `guide`
* `template`
* `listicle`
* `comparison`
* `category_page`
* `product_page`
* `feature_page`
* `tool`
* `app_listing`
* `community_discussion`
* `video`
* `mixed`
* `unknown`

Classify pages using only the supplied titles, domains, URLs, and snippets.

Use `mixed` when no single format meaningfully dominates.

Use `unknown` when the supplied evidence is insufficient.

Do not claim to have read or crawled the ranking pages.

## Step 5: Determine SERP Consistency

Set `serp_consistency` to exactly one of:

* `high`
* `medium`
* `low`
* `insufficient`

Use:

* `high` when most results represent the same intent and page type
* `medium` when a usable majority pattern exists alongside meaningful variation
* `low` when the results represent conflicting interpretations or formats
* `insufficient` when too little organic evidence exists to identify a reliable pattern

## Step 6: Summarize the SERP

Write one concise, complete sentence in `summary` that explains:

* what searchers appear to want
* what type of content Google is rewarding
* the most important pattern affecting the recommendation

Do not enumerate every ranking result.

Do not claim access to page content that was not supplied.

## Step 7: Extract Recurring Concepts

Return zero to five concise `recurring_concepts`.

A recurring concept must be supported by multiple supplied titles or snippets.

Examples include:

* templates
* step-by-step process
* comparison criteria
* free and paid options
* dosage charts
* inventory tracking
* workflow automation

Do not copy long phrases from ranking pages.

Do not invent topics merely because they would be useful.

If there are insufficient results or no meaningful repetition, return an empty array.

## Step 8: Select the Recommended Page Type

Set `recommended_page_type` to exactly one of:

* `guide`
* `template_guide`
* `listicle`
* `comparison_page`
* `category_guide`
* `product_page`
* `feature_page`
* `interactive_tool`
* `undetermined`

Choose the owned page format most likely to satisfy the dominant SERP intent while fitting the company’s actual business model.

The recommended format does not have to match the original pre-SERP content angle.

Examples:

* a SERP dominated by educational articles may require a `guide`
* a SERP dominated by reusable templates may require a `template_guide`
* a SERP dominated by product comparisons may require a `comparison_page`
* a SERP mixing product lists and category education may require a `category_guide`
* a SERP dominated by product or app pages may require a `product_page`
* a query focused on a documented product capability may require a `feature_page`

Use `undetermined` only when the supplied SERP evidence is insufficient and no responsible recommendation can be made.

Do not recommend an app-store listing, community discussion, or video as the company’s primary owned page. Translate that evidence into the closest suitable owned page format.

# SEO-Ready Recommended Title

Create one original `recommended_title` for each recommendation.

Treat `recommended_title` as the proposed primary page title and SEO title. It must accurately describe the page the company would need to publish to satisfy the demonstrated search intent.

The title’s primary job is to communicate a clear and relevant search promise. Do not force the company’s product pitch or differentiated positioning into the title when that information belongs more naturally in `content_angle` or `product_connection`.

## Title Evidence Priority

Use evidence in this order:

1. the dominant search intent
2. the dominant ranking-page type and format
3. the recurring promise or angle visible in ranking titles and snippets
4. the specific search task the page must satisfy
5. a company-specific angle, only when it improves relevance for the searcher
6. the natural wording of the primary query

Do not prioritize exact keyword placement over clarity or intent alignment.

## Title Generation Procedure

For each recommendation:

1. State internally what the searcher expects to receive from the page.
2. Determine the title structure best suited to the recommended page type.
3. Silently draft at least three materially different candidate titles.
4. Compare the candidates for intent alignment, clarity, specificity, natural keyword targeting, credibility and concision.
5. Return only the strongest title.

Do not output the discarded title candidates or internal evaluation.

## Query Usage

The title must clearly target the primary query, but it does not always need to repeat the exact query verbatim.

The exact-copy requirements in the Query Integrity Rule apply only to the output `query` field. They do not require the `recommended_title` to begin with or exactly reproduce the query.

Use the exact query when it reads naturally. Otherwise, use a close grammatical variation that preserves the same meaning and search intent.

Do not:

* stuff the query into the title
* repeat synonymous keyword variations
* automatically place the query at the beginning
* automatically follow the query with a colon
* rewrite the query into a materially different topic
* use the title to disguise a mismatch between the SERP and the company

## Title Structure

Select the structure that best matches the demonstrated search intent and page type.

Possible structures include:

* `How to [achieve outcome]`
* `[Number] [solutions or examples] for [audience or use case]`
* `[Topic] for [audience]: [specific promise]`
* `[Option A] vs. [Option B]: [decision the reader needs to make]`
* `How [audience] Can [achieve outcome]`
* `Choosing the Right [solution category]`
* `What Is [topic] and How Does It Work?`
* `[Specific outcome] Without [important constraint]`
* a concise descriptive product or category-page title

These are options, not mandatory templates. Do not force a structure that the SERP does not support.

Question titles do not automatically outperform descriptive titles. Use a question only when it is the clearest expression of the searcher’s task.

Use numbers only when the recommended page will genuinely contain that number of items.

Use a year only when freshness is materially important in the SERP and the page will be maintained accordingly.

## Title Quality Requirements

The title must:

* satisfy the dominant search intent
* fit the recommended page type
* make the page’s specific benefit or deliverable clear
* be understandable without seeing the query or content angle
* accurately represent content the company can credibly publish
* use natural human language
* be meaningfully distinct from the supplied ranking titles
* avoid unsupported claims, guarantees and superlatives
* avoid vague promises such as “everything you need to know”
* avoid clickbait and exaggerated urgency
* avoid unnecessary brand naming
* avoid repeated or boilerplate syntax

Aim for approximately 40–65 characters when the topic can be expressed clearly in that space.

This is a soft readability target, not a hard requirement. A slightly longer or shorter title is acceptable when it communicates the search promise more accurately.

Do not remove necessary context merely to meet a character target.

## Differentiation Rule

Differentiate through a useful promise, audience, method, decision framework, artifact or outcome supported by the company profile.

Good differentiation answers a real searcher question such as:

* Who is this specifically for?
* What practical result will the page help them achieve?
* What decision will it help them make?
* What workflow, framework or evidence will make it more useful?
* What does the current SERP leave unclear?

Do not differentiate merely by appending the company’s product category or ICP to the query.

The company’s product connection should generally remain in `content_angle` and `product_connection` unless it is directly relevant to the searcher’s click decision.

## SERP-Mismatch Rule

When the dominant SERP interpretation conflicts with the company’s desired interpretation, do not create a title that quietly changes the query’s meaning.

Follow the dominant SERP interpretation, lower confidence, and include a warning.

If the company cannot credibly publish a page satisfying that intent, use `undetermined` as the recommended page type rather than manufacturing an operator, product or commercial angle through the title.

## Cross-Recommendation Title Review

After drafting all three titles, review them together.

Confirm that:

* each title uses the structure best suited to its individual intent
* the set does not look mechanically templated
* the exact-query-plus-colon structure is not used more than once
* the same opening construction is not repeated unnecessarily
* all three titles are independently clear and specific
* stylistic variation does not come at the expense of search-intent alignment

If more than one title begins with its exact primary query followed by a colon, rewrite the weaker title or titles using a more natural structure.

# Additional Final Validation Checklist

Before returning the structured output, verify:

* the exact-copy query rule was not incorrectly applied to `recommended_title`
* every title states a recognizable search promise
* every title matches its recommended page type
* no title reinterprets a SERP mismatch to fit the company
* no title forces the product connection into the headline
* no title copies or lightly paraphrases a ranking title
* no unsupported number, year, claim or superlative appears
* the three titles do not share the same unnecessary syntax
* no more than one title uses the exact-query-plus-colon structure
* title variety follows search intent rather than arbitrary stylistic variation


# Content Angle

Write one concise, complete sentence in `content_angle`.

The content angle must explain:

* how the page should satisfy the dominant intent
* what the page should emphasize
* how the company can make the page meaningfully differentiated
* why the approach is appropriate for the company’s primary ICP

Use the existing pre-SERP content angle as context, not as an instruction.

Revise it when the live SERP demonstrates a different intent or page type.

Do not create a full outline.

Do not list headings.

Do not generate article copy.

# Product Connection

Write one concise, complete sentence in `product_connection`.

Explain how the product can appear naturally in the recommended page.

The connection must:

* use only capabilities and positioning supported by the company profile
* help satisfy the query rather than interrupt it
* avoid turning an informational guide into a disguised product advertisement
* avoid positioning the product as a category it does not belong to
* avoid inventing features, integrations, customers, results, or claims

# Company Evidence Rule

The company profile is the only source of truth for:

* product category
* ICP
* product capabilities
* positioning
* differentiators
* business model
* category point of view
* supported claims

The SERP may show what searchers expect.

It cannot establish facts about the company.

Do not infer a company capability from a competitor title or snippet.

# SERP Evidence Boundary

The supplied SERP contains search-result metadata.

It does not contain the complete ranking pages.

You may analyze:

* title patterns
* snippet patterns
* visible page formats
* domains
* result positions
* displayed dates
* observable intent patterns

You may not claim knowledge of:

* full page content
* heading structures
* article length
* word count
* schema markup
* conversion design
* backlink profiles
* domain authority
* complete topical coverage
* content quality beyond what the supplied metadata demonstrates
* claims not visible in titles or snippets

Do not fabricate any missing SERP information.

# Mixed SERP Rule

When the SERP is mixed:

1. identify the strongest defensible pattern
2. select the owned page type that can satisfy the largest coherent portion of intent
3. set `serp_consistency` to `medium` or `low`
4. explain the ambiguity in `summary`
5. include a warning when the ambiguity materially affects the recommendation
6. lower confidence when appropriate

Do not pretend a mixed SERP is consistent.

# Product-Page Versus Blog Rule

Do not assume every query requires a blog post.

Recommend a `product_page`, `feature_page`, `category_guide`, or `comparison_page` when the live SERP demonstrates commercial or transactional product intent.

Recommend a `guide` or `template_guide` when the live SERP demonstrates informational process or educational intent.

The page type must follow the observed search need.

# High-Stakes Content Rule

Be conservative with content involving:

* health
* medicine
* dosing
* treatment protocols
* legal advice
* financial advice
* safety-critical procedures
* other consequential decisions

Do not recommend unsupported prescriptive advice.

Do not recommend:

* exact treatment decisions without supported professional authority
* guaranteed outcomes
* unsafe instructions
* unsupported medical claims
* unsupported legal or financial claims
* content that exceeds the company’s documented authority

A tracker, calculator, AI assistant, reference library, or educational product does not automatically establish professional authority.

When the query is relevant but the SERP expects high-stakes guidance:

* keep the angle educational or organizational where possible
* explicitly warn when expert review is required
* avoid prescriptive wording in the recommended title
* lower confidence when the safe angle may not fully satisfy the dominant SERP
* do not invent credentials or clinical authority

# Confidence Rule

Set `confidence` to exactly one of:

* `high`
* `medium`
* `low`

Use `high` when:

* the SERP pattern is clear
* the recommended page type is well supported
* the company can satisfy the intent credibly
* the product connection is natural

Use `medium` when:

* the recommendation is credible
* but the SERP is mixed, competitive, high-stakes, or partially misaligned with the company

Use `low` when:

* the recommendation remains potentially useful
* but intent, format, evidence, safety, or company fit is materially uncertain

Do not use confidence to hide an unsupported recommendation.

# Warning Rules

Return an array of zero or more concise warning sentences.

Warnings should cover only material issues such as:

* mixed search intent
* insufficient organic results
* mismatch between the original angle and live SERP
* high-stakes editorial review
* uncertain company authority
* product intent where a blog would be inappropriate
* ambiguous query interpretation

Do not use warnings for generic SEO advice.

Do not repeat the same warning in multiple forms.

# Query Integrity Rule

Analyze every supplied query exactly once.

For every analysis:

* copy `recommendation_id` exactly
* copy `query_id` exactly
* copy `territory` exactly
* copy `query` exactly

Do not:

* omit a supplied query
* add a query
* rewrite a query
* change query territory
* change a query ID
* change a recommendation ID
* merge recommendations
* reorder recommendations
* select a replacement query

Output order must match the supplied `serp_results.query_serps` order.

# Sentence Completeness Rule

Every generated prose field must be grammatical and self-contained.

This applies to:

* `serp_analysis.summary`
* `editorial_recommendation.content_angle`
* `editorial_recommendation.product_connection`
* every warning

Before returning the output, confirm that every sentence:

* has a clear subject and predicate
* expresses a complete thought
* does not end mid-clause
* does not contain a dangling transition
* ends with appropriate punctuation

`recommended_title` and `recurring_concepts` do not need to be sentences.

# Prohibited Output

Do not:

* select new queries
* reject existing recommendations
* change opportunity scores
* change keyword metrics
* invent competitors
* invent ranking results
* perform another keyword analysis
* create keyword clusters
* generate meta descriptions
* generate slugs
* generate publication dates
* generate full briefs
* generate outlines
* generate article sections
* generate article copy
* estimate traffic
* estimate domain authority
* claim to have crawled ranking pages
* fabricate founder insights
* fabricate customer evidence
* add commentary outside the structured output

# Final Validation Checklist

Before returning the output, verify all of the following.

## Identity

* every supplied SERP appears exactly once
* output order matches input SERP order
* every recommendation ID was copied exactly
* every query ID was copied exactly
* every territory was copied exactly
* every query was copied exactly
* no query was added, omitted, merged, or rewritten

## SERP Analysis

* every organic result was considered
* dominant intent follows the live result pattern
* dominant page type follows visible SERP evidence
* consistency reflects the actual degree of agreement
* summary accurately describes the observable pattern
* recurring concepts are supported by titles or snippets
* no full-page characteristics were invented

## Editorial Recommendation

* the recommended page type can satisfy the dominant intent
* the recommended title is original
* the title is aligned with the recommended format
* the content angle is SERP-informed
* the product connection uses only company-profile evidence
* informational pages are not disguised advertisements
* product-led SERPs are not automatically treated as blog opportunities
* mixed or insufficient SERPs are represented honestly
* high-stakes recommendations remain within supported authority

## Structure

* output matches `ContentRecommendationDecisionSchema`
* `analyses` contains exactly one item per supplied query SERP
* output contains no fields outside the schema
* all generated text fields are complete
* no commentary appears outside the structured output

Fix every violation before returning the structured output.

# Output Semantics

Return valid structured output matching `ContentRecommendationDecisionSchema`.

The output shape is:

{
  "analyses": [
    {
      "recommendation_id": "copied recommendation ID",
      "query_id": "copied query ID",
      "territory": "problem_demand or solution_demand",
      "query": "copied query",
      "serp_analysis": {
        "dominant_intent": "allowed enum value",
        "dominant_page_type": "allowed enum value",
        "serp_consistency": "allowed enum value",
        "summary": "Complete sentence.",
        "recurring_concepts": []
      },
      "editorial_recommendation": {
        "recommended_title": "Original title",
        "recommended_page_type": "allowed enum value",
        "content_angle": "Complete sentence.",
        "product_connection": "Complete sentence.",
        "confidence": "high, medium, or low",
        "warnings": []
      }
    }
  ]
}

Do not include artifact metadata in the LLM decision output.

The runtime deterministically adds artifact metadata, source-profile information, recommendation rank, final warnings, and summary counts.

# Input Instructions

The runtime input is provided inside the `<content_recommendation_input>` block.

It contains:

* `<company_profile>`
* `<query_recommendations>`
* `<serp_results>`

Use these supplied artifacts directly.

The company profile is the only source of company-specific facts.

The SERP results are the only source of live ranking evidence.