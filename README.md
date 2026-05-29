# Tavyn Content Generation Pipeline

## Overview

This repo is a TypeScript prototype for Tavyn's blog generation workflow. It turns a structured company profile into search research, an interpreted SERP landscape, a content plan, a technical SEO brief, founder-informed answers, and final blog markdown.

High-level pipeline:

```txt
company profile
-> search query generation
-> live SERP/search landscape analysis
-> content plan generation
-> technical SEO brief generation
-> founder answers
-> blog markdown generation
```

This is not the publishing system yet. The current prototype generates strategy and content artifacts that can later be handed to a publishing agent, code agent, CMS integration, or GitHub PR workflow.

## Why this architecture exists

Tavyn should not generate random blogs. The product direction is to first understand the company, inspect the real search landscape, build a content plan, generate a technical SEO brief, collect founder context when needed, and only then create a humanized blog draft.

The artifact-first architecture is intentional. Each stage creates an editable JSON or markdown artifact, which makes the workflow inspectable, debuggable, and reusable. If a founder edits the content plan, changes answer quality, or adds context, downstream stages can regenerate without restarting the whole pipeline. This also makes each stage easier to evaluate independently before the system is wired into a production app.

## Folder structure

### `artifacts/`

Stores pipeline artifacts. These files are currently committed because they act as runnable examples and make the pipeline easier to understand during handoff. They should not contain API keys or sensitive credentials.

Important artifacts:

* `company_profile.json`
  * Structured profile of the company.
  * Generated from scraped site content.
  * Source of truth for ICP, positioning, pains, goals, messaging, and SEO topics.

* `search_queries.json`
  * Generated search research queries.
  * Includes TOFU, MOFU, and BOFU coverage.
  * Includes query type, reader stage, and source signals.

* `raw_search_results.json`
  * Normalized Serper results for each query.
  * Evidence layer for the search landscape.

* `search_landscape.json`
  * Interpreted SERP landscape.
  * Includes query analyses, domain visibility, content gaps, angle opportunities, strategic focus, and implications for the content plan.

* `content_plan.json`
  * Four-week plan.
  * Three posts per week.
  * Twelve planned posts.
  * Includes clusters, planned items, search support, product tie-ins, and next recommended action.

* `technical_seo_brief.json`
  * Latest generated technical SEO brief.
  * Also saved under `artifacts/briefs/`.

* `founder_answers.json`
  * Simple founder question and answer artifact.
  * Raw founder answers used by blog generation.

* `blog.md`
  * Latest generated blog markdown.
  * Also saved under `artifacts/blogs/`.

### `src/search-landscape/`

This module does three things:

1. Builds search queries from the company profile.
2. Runs live Serper searches.
3. Uses OpenAI to convert raw SERP results into `search_landscape.json`.

Files:

* `types.ts`
  * Shared types for company profile, query plan, search results, and search landscape.

* `queries.ts`
  * Deterministic query generation.
  * Generates 8 to 12 queries.
  * Covers TOFU, MOFU, and BOFU.
  * Uses company profile fields deeply.

* `run-queries.ts`
  * Creates `artifacts/search_queries.json`.

* `run-first-search.ts`
  * Debugging script to test the first Serper query and inspect the raw response shape.

* `run-search-landscape.ts`
  * Full search landscape pipeline.
  * Calls Serper for all queries.
  * Saves `raw_search_results.json`.
  * Calls OpenAI for analysis.
  * Saves `search_landscape.json`.

Environment variables:

* `SERPER_API_KEY`
* `OPENAI_API_KEY`
* Optional `OPENAI_MODEL`

### `src/content-plan/`

Turns `company_profile.json` and `search_landscape.json` into a four-week content plan.

Files:

* `types.ts`
  * Content plan types.
  * Posting frequency hyperparameters.
  * Planned item structure.

* `prompt.ts`
  * Prompt for OpenAI content plan generation.

* `generate.ts`
  * OpenAI call and validation.
  * Validates exactly 12 planned items.
  * Validates three posts per week for four weeks.
  * Validates each planned item references real searched queries from `search_landscape.queryAnalyses`.

* `run-content-plan.ts`
  * Terminal runner.
  * Sets `postsPerWeek = 3`.
  * Sets `durationWeeks = 4`.
  * Writes `artifacts/content_plan.json`.

The content plan is not an outline. It only answers:

* What to write.
* When to write it.
* Why it matters.
* What search evidence supports it.
* How it connects to the product.
* What founder context may be needed.

### `src/brief-generation/`

Creates a technical SEO brief for the next queued content plan item.

Files:

* `types.ts`
  * Technical SEO brief type.

* `prompt.ts`
  * Prompt for technical SEO brief generation.

* `generate.ts`
  * OpenAI call and validation.
  * Validates meta title length.
  * Validates meta description length.
  * Validates no internal or external link fields are included.
  * Validates founder question triggers.

* `run-brief-generation.ts`
  * Selects the planned item from `contentPlan.nextRecommendedAction.plannedItemId`.
  * Generates `artifacts/briefs/post_001_technical_seo_brief.json`.
  * Creates latest copy at `artifacts/technical_seo_brief.json`.

The SEO brief is technical, not qualitative. It includes:

* Search target.
* Keyword map.
* SERP requirements.
* On-page SEO.
* Technical publishing requirements.
* Content coverage checklist.
* SEO risk warnings.
* Founder question triggers.

Internal and external linking are intentionally skipped for the MVP.

### `src/blog-generation/`

Creates final blog markdown from:

* Company profile.
* Content plan.
* Technical SEO brief.
* Founder answers.

Files:

* `types.ts`
  * Blog generation input and output types.

* `prompt.ts`
  * Prompt for final blog writing.
  * Strongly instructs humanized writing.
  * No em dashes.
  * No AI slop.
  * Uses founder answers deeply.
  * Uses the SEO brief as the SEO contract.

* `generate.ts`
  * OpenAI call.
  * Markdown validation.
  * Checks frontmatter.
  * Checks no em dashes.
  * Checks estimated word count.
  * Checks primary keyword.
  * Checks founder context.
  * Checks soft Tavyn product tie-in.

* `run-blog-generation.ts`
  * Generates `artifacts/blogs/post_001.md`.
  * Creates latest copy at `artifacts/blog.md`.
  * Writes a generation report.

This module does not publish anywhere. It only produces markdown.

## Environment setup

Create a local `.env` file:

```bash
OPENAI_API_KEY=your_openai_api_key_here
SERPER_API_KEY=your_serper_api_key_here
OPENAI_MODEL=gpt-4.1-mini
```

`.env` is ignored by Git and should never be committed.

## How to run the pipeline

Run the commands in this order:

```bash
npx tsx src/search-landscape/run-queries.ts
npx tsx src/search-landscape/run-first-search.ts
npx tsx src/search-landscape/run-search-landscape.ts
npx tsx src/content-plan/run-content-plan.ts
npx tsx src/brief-generation/run-brief-generation.ts
npx tsx src/blog-generation/run-blog-generation.ts
```

Command outputs:

* `npx tsx src/search-landscape/run-queries.ts`
  * Reads `artifacts/company_profile.json`.
  * Writes `artifacts/search_queries.json`.

* `npx tsx src/search-landscape/run-first-search.ts`
  * Uses the first generated search query to verify Serper connectivity and response shape.
  * Calls Serper and requires `SERPER_API_KEY`.

* `npx tsx src/search-landscape/run-search-landscape.ts`
  * Runs all Serper searches.
  * Writes `artifacts/raw_search_results.json`.
  * Calls OpenAI to analyze the SERP landscape.
  * Writes `artifacts/search_landscape.json`.

* `npx tsx src/content-plan/run-content-plan.ts`
  * Reads company profile and search landscape.
  * Calls OpenAI to generate a four-week content plan.
  * Writes `artifacts/content_plan.json`.

* `npx tsx src/brief-generation/run-brief-generation.ts`
  * Reads company profile, search landscape, and content plan.
  * Selects `contentPlan.nextRecommendedAction.plannedItemId`.
  * Calls OpenAI to generate the technical SEO brief.
  * Writes `artifacts/briefs/post_001_technical_seo_brief.json` and `artifacts/technical_seo_brief.json`.

* `npx tsx src/blog-generation/run-blog-generation.ts`
  * Reads company profile, content plan, technical SEO brief, and founder answers.
  * Calls OpenAI to generate final markdown.
  * Writes `artifacts/blogs/post_001.md`, `artifacts/blog.md`, and a generation report.

## Current MVP assumptions

* Posting frequency is hardcoded as a hyperparameter in `src/content-plan/run-content-plan.ts`.
* Current value is three posts per week.
* Duration is four weeks.
* Total planned posts is twelve.
* Internal linking is not implemented yet.
* External linking is not implemented yet.
* Publishing is not implemented here.
* GitHub/code publishing is handled elsewhere.
* Artifacts are currently file-based, not database-backed.
* Scripts use native `fetch`, not SDKs.
* Validation is lightweight and can be expanded.

## Integration notes for co-founder

How to integrate this into a larger app:

1. Replace file reads and writes with database artifacts or object storage.
2. Replace terminal runners with service functions or background jobs.
3. Keep artifacts versioned because founders may edit them.
4. Treat each stage as async and independently retryable.
5. Keep `company_profile`, `search_landscape`, `content_plan`, `technical_seo_brief`, `founder_answers`, and `blog_md` as separate persisted entities.
6. Do not merge stages too early, because editability and observability are key Tavyn product values.
7. Connect the publishing handoff after `blog.md`.

Possible production tables or entities:

```txt
company_profiles
search_query_plans
search_landscapes
content_plans
planned_content_items
technical_seo_briefs
founder_answer_sets
generated_blogs
```

## Security notes

* Never commit `.env`.
* Never log API keys.
* Be careful with GitHub access messaging.
* Avoid overclaiming automated publishing until integration is finalized.
* Treat generated artifacts as product data. Review them before sharing externally.

## Future roadmap

* Internal linking from site inventory.
* External linking recommendations.
* Existing content inventory.
* Competitor domain enrichment.
* Full page content extraction.
* Content refresh loop.
* AEO/GEO briefs.
* Publishing handoff JSON.
* Direct GitHub PR publishing.
* Founder review loop over email.
