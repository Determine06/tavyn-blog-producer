import type { GenerateContentPlanInput } from "./types";

export function buildContentPlanPrompt(input: GenerateContentPlanInput): string {
  const { postsPerWeek, durationWeeks } = input.postingFrequency;
  const totalPlannedItems = postsPerWeek * durationWeeks;
  const validSearchedQueries = getValidSearchedQueries(input.searchLandscape);

  return `You are Tavyn's SEO content strategist.

You are creating content_plan.json.

Inputs:
1. Company profile
2. Search landscape
3. Posting frequency

The content plan must create exactly postsPerWeek * durationWeeks planned items.
For the current MVP, that means exactly ${totalPlannedItems} planned posts across ${durationWeeks} weeks, ${postsPerWeek} per week.

Use the search landscape as the strategy layer. Pay special attention to:
- searchLandscape.recommendedStrategicFocus
- searchLandscape.implicationsForContentPlan.recommendedClusters
- searchLandscape.implicationsForContentPlan.topicsToPrioritize
- searchLandscape.implicationsForContentPlan.topicsToAvoidOrDelay
- searchLandscape.implicationsForContentPlan.suggestedFirstPost
- searchLandscape.contentGaps
- searchLandscape.angleOpportunities
- searchLandscape.queryAnalyses

The content plan should prioritize:
- founder-led SaaS SEO blog operations
- SaaS-specific SEO content planning
- email-native content workflows and approval
- technical publishing workflows for SaaS blogs
- agency alternative positioning only after foundational education

The content plan should avoid or delay:
- generic AI blog writing tool comparisons
- broad SEO strategy not tailored to SaaS or founders
- agency service promotion without workflow focus
- overly generic "AI writer" content

The plan must include this exact balanced funnel mix.
For 12 posts:
- exactly 4 TOFU posts
- exactly 4 MOFU posts
- exactly 4 BOFU posts

Use this exact funnel-stage sequence by week:
- Week 1: TOFU, TOFU, MOFU
- Week 2: TOFU, MOFU, MOFU
- Week 3: TOFU, MOFU, BOFU
- Week 4: BOFU, BOFU, BOFU

Use this meaning:
TOFU = top of funnel, educational/problem-aware
MOFU = middle of funnel, solution-aware/workflow-aware
BOFU = bottom of funnel, commercial/vendor-aware/comparison/product-aware

The sequencing should follow these rules:
1. Week 1 should establish the core positioning and foundational workflow.
2. Week 2 should deepen SEO planning, topical authority, and founder input.
3. Week 3 should introduce technical publishing and email-native workflow differentiation.
4. Week 4 can include commercial/product-aware/agency-alternative topics after the educational foundation exists.
5. The first post should usually be the search landscape's suggestedFirstPost, unless there is a very good reason to slightly improve the title.
6. Foundation posts should come before supporting posts.
7. Product-wedge posts should come after the reader understands the workflow problem.
8. BOFU posts should not dominate the first week.

The content plan is not a full SEO brief. It should only answer:
- What should we write?
- When should we write it?
- Why does it matter?
- What search evidence supports it?
- How does it connect to the product?
- What founder context might be needed?

Do not include full article outlines.
Do not include meta descriptions.
Do not include H2/H3 sections.
Do not include finished CTAs.
Do not write blog content.

Each planned item must have:
- id
- week
- sequence
- workingTitle
- clusterId
- clusterName
- funnelStage
- readerStage
- searchIntent
- primaryKeyword
- supportingKeywords
- whyThisPost
- searchLandscapeSupport
- productTieIn
- founderPerspectiveNeeded
- priorityScore
- status

searchLandscapeSupport must reference real evidence from the search landscape:
- relatedQueries should come from queryAnalyses/query strings
- relatedGaps should come from contentGaps/gap values
- angleOpportunity should come from angleOpportunities/angle values

CRITICAL: searchLandscapeSupport.relatedQueries must contain ONLY exact query strings from SEARCH LANDSCAPE.queryAnalyses[].query. Do not invent, paraphrase, rewrite, or create new related queries in this field.

If you want to use an inferred topic or strategic angle that was not searched, put it in primaryKeyword, supportingKeywords, whyThisPost, productTieIn, or angleOpportunity, but not in relatedQueries.

Do not invent unsupported search evidence.

Scoring:
Priority score should be 0-100.
Higher scores should go to:
- strong business value
- direct connection to Tavyn positioning
- strong support from search landscape gaps
- foundational/pillar content
- content that can support later internal links

Return valid JSON only.

The returned JSON must match this shape exactly:

{
  "planId": "string",
  "companyName": "string",
  "createdAt": "ISO string",
  "durationWeeks": 4,
  "postsPerWeek": 3,
  "totalPlannedItems": 12,
  "status": "draft",
  "strategy": {
    "primaryFocus": "string",
    "positioningThesis": "string",
    "recommendedFirstPost": "string",
    "topicsToPrioritize": ["string"],
    "topicsToAvoidOrDelay": ["string"]
  },
  "clusters": [
    {
      "id": "cluster_001",
      "name": "string",
      "description": "string",
      "businessValue": "low | medium | high",
      "priority": 1
    }
  ],
  "plannedItems": [
    {
      "id": "post_001",
      "week": 1,
      "sequence": 1,
      "workingTitle": "string",
      "clusterId": "cluster_001",
      "clusterName": "string",
      "funnelStage": "tofu | mofu | bofu",
      "readerStage": "unaware | problem-aware | solution-aware | product-aware | vendor-aware",
      "searchIntent": "informational | commercial | transactional | comparison | template | mixed",
      "primaryKeyword": "string",
      "supportingKeywords": ["string"],
      "whyThisPost": "string",
      "searchLandscapeSupport": {
        "relatedQueries": ["string"],
        "relatedGaps": ["string"],
        "angleOpportunity": "string"
      },
      "productTieIn": "string",
      "founderPerspectiveNeeded": ["string"],
      "priorityScore": 95,
      "status": "planned"
    }
  ],
  "nextRecommendedAction": {
    "type": "generate_seo_brief",
    "plannedItemId": "post_001",
    "reason": "string"
  }
}

POSTING FREQUENCY:
${JSON.stringify(input.postingFrequency, null, 2)}

VALID SEARCHED QUERIES:
${JSON.stringify(validSearchedQueries, null, 2)}

COMPANY PROFILE:
${JSON.stringify(input.companyProfile, null, 2)}

SEARCH LANDSCAPE:
${JSON.stringify(input.searchLandscape, null, 2)}
`;
}

function getValidSearchedQueries(searchLandscape: any): string[] {
  return Array.isArray(searchLandscape?.queryAnalyses)
    ? searchLandscape.queryAnalyses
        .map((q: any) => q?.query)
        .filter((query: unknown): query is string => typeof query === "string" && query.trim().length > 0)
    : [];
}
