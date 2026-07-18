# Tavyn Blog Producer CLI

## Default crawl

Command:

npm run dev

What it does:
- Uses the default website: https://tavyn.dev/
- Runs the local pipeline from crawl through query candidates
- Uses cached artifacts when they exist
- Runs a step only when its artifact is missing or its force flag is passed
- Stops after query-candidates.json because keyword validation is not implemented yet

## Custom website crawl

Command:

npm run dev -- https://example.com

What it does:
- Uses the provided website URL
- Uses cached crawl artifact for that website if it exists
- Runs Firecrawl only if no cached crawl artifact exists

## Force default website crawl

Command:

npm run dev -- --force-crawl

What it does:
- Uses the default website: https://tavyn.dev/
- Ignores the cached crawl artifact
- Reruns Firecrawl
- Overwrites the crawl artifact

## Force custom website crawl

Command:

npm run dev -- https://example.com --force-crawl

What it does:
- Uses the provided website URL
- Ignores the cached crawl artifact
- Reruns Firecrawl
- Overwrites the crawl artifact for that website

## Force profile flag

Command:

npm run dev -- --force-profile

What it does:
- Uses cached crawl context if available
- Regenerates company-profile.json
- Does not rerun crawl unless --force-crawl is also passed

## Force crawl and profile

Command:

npm run dev -- --force-crawl --force-profile

What it does:
- Ignores the cached crawl artifact
- Reruns Firecrawl
- Overwrites crawl-context.json
- Regenerates company-profile.json

## Generate query candidates from cached crawl and profile

Command:

npm run query-candidates

What it does:
- Uses the default website: https://tavyn.dev/
- Uses cached crawl-context.json if available
- Uses cached company-profile.json if available
- Regenerates query-candidates.json
- Does not rerun crawl or company profile unless their cached artifacts are missing
- Stops after query-candidates.json

## Generate query candidates for a custom website from cached crawl and profile

Command:

npm run dev -- https://example.com --force-query-candidates

What it does:
- Uses the provided website URL
- Uses cached crawl-context.json for that website if available
- Uses cached company-profile.json for that website if available
- Regenerates query-candidates.json for that website
- Does not rerun crawl or company profile unless their cached artifacts are missing
- Stops after query-candidates.json

## Force query candidates

Command:

npm run dev -- --force-query-candidates

What it does:
- Uses cached crawl context if available
- Uses cached company-profile.json if available
- Regenerates query-candidates.json
- Stops after query-candidates.json

Compatibility alias:
- npm run dev -- --force-clusters

## Legacy force topical clusters alias

Command:

npm run dev -- --force-clusters

What it does:
- Uses cached crawl context if available
- Uses cached company-profile.json if available
- Regenerates query-candidates.json
- Preserved as a temporary alias for --force-query-candidates

## Force full early pipeline

Command:

npm run dev -- --force-crawl --force-profile --force-query-candidates

What it does:
- Reruns Firecrawl
- Regenerates company-profile.json
- Regenerates query-candidates.json
- Stops after query-candidates.json

## Force SERP data collection

Command:

npm run dev -- --force-serp

What it does:
- Not currently connected to the main pipeline
- The pipeline stops after query-candidates.json

Required environment variable:
- SERPER_API_KEY

## Force query metrics collection

Command:

npm run dev -- --force-query-metrics

What it does:
- Not currently connected to the main pipeline
- The pipeline stops after query-candidates.json

Required environment variables:
- DATAFORSEO_LOGIN
- DATAFORSEO_PASSWORD

## Force full current pipeline

Command:

npm run dev -- --force-crawl --force-profile --force-query-candidates

What it does:
- Reruns Firecrawl
- Regenerates company-profile.json
- Regenerates query-candidates.json
- Stops after query-candidates.json

## Hyperparameter logging

Command:

LOG_HYPERPARAMETERS=true npm run dev -- --force-profile

What it does:
- Prints the exact structured OpenAI request payload before the API call
- Shows the final model, developer message, input, schema config, max output tokens, and reasoning effort
- Stays off by default when LOG_HYPERPARAMETERS is not set to true

## Query LLM analysis

Status:
- Placeholder only. LLM query analysis is not implemented yet.

## Artifact location

Crawl artifacts are saved under:

artifacts/<safe-hostname>/crawl-context.json

Company profile artifacts are saved under:

artifacts/<safe-hostname>/company-profile.json

Query candidate artifacts are saved under:

artifacts/<safe-hostname>/query-candidates.json

SERP data artifacts are saved under:

artifacts/<safe-hostname>/serp-data.json

Query analysis artifacts are saved under:

artifacts/<safe-hostname>/query-analysis.json

Examples:
- https://tavyn.dev/ -> artifacts/tavyn-dev/crawl-context.json
- https://www.example.com -> artifacts/example-com/crawl-context.json

## Notes

- Generated artifacts are ignored by Git.
- Use --force-crawl when you want fresh Firecrawl data.
- Use npm run query-candidates when you want cached crawl/profile inputs and a fresh query-candidates.json for the default Tavyn site.
- Later pipeline steps like keyword validation, SERP results, and final audit JSON will use the same cached-step pattern.
