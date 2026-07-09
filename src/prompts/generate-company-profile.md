---
prompt_name: generate-company-profile
prompt_version: 0.1.0
output_mode: structured_json
schema_name: CompanyProfileSchema
model: gpt-5.4-mini
reasoning_effort: low
temperature: 0.1
max_output_tokens: 3000
---

# Developer Instructions

# Task

Generate a structured company profile from crawled website markdown.

Your job is to extract what the company sells, who it sells to, what pains it solves, what capabilities it claims, how it positions itself, and how it communicates.

This profile will be used by later pipeline steps for content planning, SERP analysis, cluster evaluation, SEO briefs, and audit generation.

Do not generate content clusters.
Do not recommend blog topics.
Do not evaluate SERP opportunities.
Do not write SEO briefs.
Do not produce customer-facing audit copy.

# Runtime Input

The runtime input will contain:

- `schemaVersion`
- `websiteUrl`
- `generatedAt`
- `pages`
  - `url`
  - `title`
  - `markdown`
- `combinedMarkdown`

The code should inject the actual runtime data into the user message.

Expected runtime input format:

    <company_profile_input>
      <schema_version>{schemaVersion}</schema_version>
      <generated_at>{generatedAt}</generated_at>
      <website_url>{websiteUrl}</website_url>

      <source_pages>
        {pages as JSON with url and title}
      </source_pages>

      <crawled_markdown>
        {combinedMarkdown}
      </crawled_markdown>
    </company_profile_input>

Use the runtime values directly for:

- `schema_version`
- `website_url`
- `generated_at`
- `source_pages`

# Extraction Goal

Create a useful, evidence-backed profile of the company based only on the crawled website content.

The profile should help later pipeline steps understand:

- company identity
- product category
- business model
- ICP and audience
- buyer pains
- product capabilities
- positioning and differentiation
- brand voice and communication style
- profile quality and uncertainty

# Source Weighting

Prioritize high-signal company pages such as:

- homepage
- product pages
- platform pages
- feature pages
- pricing pages
- solution pages
- use case pages
- about pages
- core marketing pages

Treat these as lower-priority context unless the target field specifically concerns trust, security, or operational maturity:

- security pages
- legal pages
- policy pages
- support pages
- changelog pages
- docs pages
- isolated demo examples
- sample outputs
- repeated navigation or CTA sections

If pages conflict, prefer clear product and positioning claims from core marketing pages over legal, support, or demo content.

# Evidence Rules

Use only the provided crawled website markdown.

Do not invent:

- product features
- pricing
- customers
- integrations
- competitors
- search metrics
- domain authority
- traffic estimates
- rankings
- technical website facts

Evidence may be:

- a short quote
- a page-level observation
- a repeated pattern across pages

For evidence fields, include concise evidence references from the crawl.

Good evidence examples:

- `Homepage: "Automate customer support workflows across email and chat."`
- `Pricing page: describes three plans for small teams, growing teams, and enterprise teams`
- `Product section: repeated emphasis on automated ticket routing and SLA alerts`
- `Security page: describes SSO, audit logs, and role-based permissions`

Do not include long copied passages.

If the structured output schema expects evidence objects instead of strings, preserve the same idea:

- source page
- section if clear
- short quote, page observation, or repeated pattern

# Confidence Rules

Use confidence levels consistently.

Use `high` when the detail is directly stated in clear website copy.

Use `medium` when the detail is strongly implied by multiple pieces of copy.

Use `low` when the detail is inferred from limited, vague, noisy, or indirect evidence.

Do not use `high` confidence for information that is only implied.

If information is missing, use `unknown`, `null`, an empty array, or a low-confidence note according to the structured output schema.

# Field Guidance

## Company Identity

Extract:

- company name
- domain
- one-sentence description
- product category
- business model
- stage or maturity

The one-sentence description should be clear, specific, and no more than 30 words.

The product category should describe what the company actually is.

Good product category examples:

- customer support automation platform
- subscription billing software
- B2B SaaS analytics platform
- product onboarding platform
- sales workflow automation tool
- cloud cost management software

Bad product category examples:

- generic AI tool
- software company
- CRM, unless the company clearly sells CRM software
- marketing platform, unless more specific information is unavailable
- analytics, unless the company clearly sells analytics software

For `stage_or_maturity`, only infer maturity from direct clues such as:

- waitlist
- beta
- early access
- launch
- founding customer spots
- established customer logos
- enterprise pages
- pricing pages

If maturity is unclear, use low confidence.

# ICP and Audience

Identify the primary ICP from direct website language.

If the site names the ICP directly, use that.

If the ICP is implied, describe the likely ICP conservatively and lower the confidence.

Secondary audiences should only be included when supported by the website.

Do not invent audiences just because they would make sense commercially.

# Buyer Pains

Extract customer pains that are explicitly stated or strongly implied.

A buyer pain should describe the customer’s problem, not the product’s feature.

Good buyer pain examples:

- support teams spend too much time triaging repetitive tickets
- finance teams struggle to reconcile subscription invoices across tools
- sales teams lose context between CRM records and product usage data
- customer success teams cannot easily identify accounts at risk
- operations teams rely on manual spreadsheets for recurring workflows

Bad buyer pain examples:

- needs AI
- wants better growth
- wants automation
- wants more traffic
- needs CRM software, unless directly supported

# Product Capabilities

Extract concrete things the product claims to do.

A capability should be written as a product function, not vague marketing language.

Good capability examples:

- routes support tickets by priority
- syncs product usage data into customer records
- generates renewal risk reports
- sends automated onboarding reminders
- reconciles subscription invoices
- provides role-based access controls
- integrates with billing and CRM systems

Use only values allowed by the structured output schema.

If unsure, choose the most conservative valid value.

# Differentiation and Positioning

Extract how the company appears to differentiate itself.

Look for:

- workflow claims
- channel or interface claims
- publishing claims
- ICP-specific positioning
- user-involvement claims
- category point of view
- trust or security claims

Do not exaggerate ordinary features into major differentiators.

The positioning summary should explain how the company wants to be understood in the market.

The category point of view should summarize the company’s belief about the problem or category.

Good category POV examples:

- Support teams need automation that fits existing queues, not another disconnected inbox.
- Revenue teams make better decisions when billing, CRM, and product usage data are connected.
- Customer onboarding works better when follow-up is triggered by behavior, not manual checklists.
- Security workflows should be continuous and auditable, not handled through one-off manual reviews.

# Brand Voice and Communication Style

Extract brand voice from the company’s marketing copy.

Look for:

- tone
- writing style
- common phrases
- repeated messaging patterns

Prioritize homepage, product, feature, solution, and core marketing pages.

Do not let isolated UI labels, navigation text, FAQ questions, legal pages, or security pages dominate the brand voice.

Security or policy pages may inform trust positioning, but homepage and product pages should carry more weight for brand voice.

# Profile Quality

Use `profile_quality` to describe how reliable the generated profile is.

Include missing information such as:

- unclear pricing
- unclear customer examples
- unclear integrations
- unclear company maturity
- limited number of crawled pages
- vague or repeated copy
- demo content that could confuse product interpretation
- important FAQ questions without visible answers

Potential risks should describe risks in the profile extraction, not business risks.

Good potential risk examples:

- `Only one page was crawled, so audience and positioning details may be incomplete.`
- `Some demo content appears in the crawl and should not be mistaken for the company's actual product category.`
- `Pricing is not stated in the crawled content.`
- `Some FAQ questions appear without full answers.`
- `Repeated UI sections may make certain messages appear more prominent than they are.`

Bad potential risk examples:

- `The company may fail.`
- `The product has weak SEO.`
- `The market is too competitive.`

# Crawl Noise Handling

Crawled markdown may contain:

- repeated sections
- navigation labels
- button text
- FAQ questions without answers
- malformed spacing
- concatenated UI text
- duplicated product cards
- duplicated CTAs
- demo examples
- sample reports
- sample briefs
- sample keywords
- sample blog outlines
- fake sample outputs

Ignore low-signal UI noise unless it supports a meaningful repeated pattern.

If the same section appears multiple times because of repeated layout, responsive rendering, or crawl duplication, count it as one signal, not multiple independent pieces of evidence.

Do not mistake demo content, sample briefs, sample keywords, sample reports, or sample blog titles for the company’s actual product category, ICP, or customer segment.

Example:

If a crawl includes a sample report about improving enterprise payroll workflows, that does not mean the company sells payroll software.

Treat it as demo content unless the site directly says the company sells payroll software.

# Deduplication Rules

Merge overlapping capabilities, pains, and differentiators. Do not create separate entries for the same idea with slightly different wording.

For example, `automates ticket routing` and `routes support tickets automatically` should usually be one capability.

# Secondary Audience Rules

Only include secondary audiences when the website directly names or clearly supports them.

Do not infer secondary audiences just because they could use the product.

If support is weak, leave `secondary_audiences` empty and mention the uncertainty in `audience_notes`.

Secondary audiences must be distinct buyer or user groups, not sub-roles, behaviors, or participation patterns within the primary ICP.

# Secondary Audience Strictness

Only include a secondary audience if it is a distinct buyer or user segment separate from the primary ICP.

Do not list sub-roles, participants, reviewers, approvers, admins, or behaviors inside the primary ICP as secondary audiences.

For example:
- If the primary ICP is `small business owners`, do not add `owners who approve invoices` as a secondary audience.
- If the primary ICP is `customer support teams`, do not add `support managers who review escalations` as a secondary audience.
- If the primary ICP is `sales teams`, do not add `sales reps who update pipeline stages` as a secondary audience.

If a person participates in the workflow but is not a distinct audience segment, describe that in `audience_notes`, buyer pains, or product capabilities instead.

# Demo Evidence Rules

Demo examples, sample briefs, sample reports, fake outputs, placeholder data, and example workflows may support a field only when they confirm stronger evidence from core marketing copy.

Do not use demo or sample content as the primary evidence for company category, ICP, business model, maturity, pricing, integrations, or customer segments.

For example:
- A sample report about payroll workflows does not mean the company sells payroll software.
- A demo dashboard showing ecommerce data does not mean ecommerce brands are the ICP.
- A sample brief about CRM migration does not mean the company sells CRM software.

# Business Model Rules

Do not infer a subscription business model unless pricing pages, plan names, recurring billing language, or SaaS purchase language clearly support it.

If the site only shows a waitlist, early access, or launch CTA, describe the business model conservatively.

# Output Semantics

Return a valid structured output matching `CompanyProfileSchema`.

Do not add commentary outside the structured output.

Do not fill optional fields just because the schema allows them. Leave fields empty, null, unknown, or low-confidence when the crawl does not support them.

Do not include hidden reasoning or chain-of-thought.

Use concise reasoning only inside schema fields that ask for descriptions, notes, confidence, risks, or evidence.

When evidence is missing, stay conservative.

Prefer a useful low-confidence extraction over a confident unsupported claim.

# Input Instructions

The runtime input is provided in the `<company_profile_input>` XML-like block. Use those values directly and do not infer beyond the provided crawled markdown.