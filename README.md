# Tavyn Blog Producer

Local TypeScript pipeline for generating Tavyn blog strategy artifacts from a company website and staged external data.

The project currently supports:
- Firecrawl company website crawling
- structured company profile generation with OpenAI
- topical cluster candidate generation with OpenAI
- SERP collection with Serper for legacy selected-query cluster artifacts
- query metric enrichment with DataForSEO
- cached JSON artifacts for each pipeline step

## Current Pipeline

Run the local pipeline with:

```bash
npm run dev
```

The pipeline uses cached artifacts by default. Use force flags to regenerate specific steps:

```bash
npm run dev -- --force-crawl
npm run dev -- --force-profile
npm run dev -- --force-clusters
npm run dev -- --force-serp
npm run dev -- --force-query-metrics
```

Current topical cluster generation outputs `query_candidates`, not a final selected SERP query. When clusters are regenerated in this new format, the main pipeline stops before SERP collection and logs that validated selected queries are required first.

## Repo Structure

```text
src/
  cache/
    runCachedStep.ts              Cached artifact wrapper used by pipeline steps.

  config/
    env.ts                        Environment variable loading and required-env helper.

  lib/
    logger.ts                     Shared logging helpers.

  llm/
    loadPrompt.ts                 Markdown prompt/frontmatter loader.
    openaiClient.ts               OpenAI client setup.
    runPrompt.ts                  Basic prompt runner.
    runStructuredPrompt.ts        Structured OpenAI response helper.
    runStructuredPromptFile.ts    Universal prompt-file runner for typed structured prompts.

  output/
    saveLocalJson.ts              JSON output helper.

  prompts/
    universal-dev.md              Shared developer instructions attached to LLM calls.
    generate-company-profile.md   Company profile prompt.
    generate-topical-clusters.md  Topical cluster candidate prompt.

  schema/
    *.json                        JSON example/reference schemas used while designing artifacts.

  steps/
    generateCompanyProfile.ts              Firecrawl crawl and company profile generation.
    generateCandidateTopicalClusters.ts    Topical cluster candidate generation.
    collectSerpData.ts                     Legacy Serper collection for primary-query artifacts.
    collectQueryMetrics.ts                 DataForSEO metric enrichment.

  types/
    *.schema.ts                   Zod schemas and inferred TypeScript types.

  cli.ts                          Legacy direct step commands.
  index.ts                        Main `npm run dev` pipeline entrypoint.
```

## Artifacts

Generated artifacts are written under:

```text
artifacts/<safe-hostname>/
```

For Tavyn, the default location is:

```text
artifacts/tavyn-dev/
```

Current artifact names:
- `crawl-context.json`
- `company-profile.json`
- `topical-clusters.json`
- `serp-data.json`
- `query-analysis.json`

Artifacts are ignored by Git.

## Environment Variables

Required for the current pipeline, depending on which steps run:

```text
OPENAI_API_KEY
FIRECRAWL_API_KEY
SERPER_API_KEY
DATAFORSEO_LOGIN
DATAFORSEO_PASSWORD
```

Hyperparameter logging can be enabled for OpenAI structured prompt calls:

```bash
LOG_HYPERPARAMETERS=true npm run dev -- --force-profile
```

## Development Checks

Run TypeScript validation with:

```bash
npx tsc --noEmit
```

See `CLI.md` for more command examples and force-flag details.
