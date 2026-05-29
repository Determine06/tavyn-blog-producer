import type { BlogGenerationInput } from "./types";

export function buildBlogGenerationPrompt(input: BlogGenerationInput): string {
  return `You are Tavyn's blog generation engine.

You are writing the final blog post in Markdown.

Inputs:

1. Company profile
2. Content plan
3. Selected planned item
4. Technical SEO brief
5. Founder answers

Use the technical SEO brief as the SEO contract.

You must satisfy:

* search target
* keyword map
* SERP requirements
* on-page SEO
* technical publishing fields
* content coverage checklist
* SEO risk warnings

Use the founder answers to add:

* authentic founder POV
* non-generic insight
* product accuracy
* practical examples
* stronger differentiation from generic AI writing tools

Do not include:

* internal links
* external links
* citation placeholders
* fake data
* fake case studies
* unsupported claims
* guaranteed rankings
* em dashes
* obvious AI filler

The final output should be Markdown only.

The Markdown should include YAML frontmatter at the top:

---
title: "..."
slug: "..."
description: "..."
tags:
  - "..."
---

Use:

* title from the SEO brief H1 unless a cleaner human title is needed
* slug from technicalSeoBrief.onPageSeo.recommendedSlug
* description from technicalSeoBrief.onPageSeo.metaDescription.draft
* tags from technicalSeoBrief.technicalPublishing.suggestedTags

After frontmatter, write the blog.

The blog should:

* be close to the recommended target word count
* use the primary keyword naturally
* include secondary and semantic terms naturally
* satisfy the content coverage checklist
* include practical sections
* not be too product-heavy too early
* mention Tavyn softly in the second half or conclusion
* explain that SEO takes time to compound, roughly 3-6 months, without making a guarantee
* explain that founder involvement makes content less generic
* explain why email-native workflows reduce dashboard/tool friction
* explain the role of GitHub publishing and SERP/question analysis where relevant
* end with a natural CTA or soft product mention

Human writing requirements:

* sound natural, direct, and practical
* use clear sentences
* include specific founder/operator context
* avoid generic AI phrases
* avoid corporate filler
* avoid over-polished consultant language
* avoid excessive buzzwords
* avoid saying "in today's digital landscape"
* avoid saying "delve"
* avoid saying "unlock"
* avoid saying "game-changer"
* avoid saying "leverage" unless truly necessary
* avoid em dashes entirely

Important:
Do not output explanations before or after the Markdown.
Do not wrap the Markdown in code fences.
Return only the blog markdown.

COMPANY PROFILE:
${prettyJson(input.companyProfile)}

CONTENT PLAN:
${prettyJson(input.contentPlan)}

SELECTED PLANNED ITEM:
${prettyJson(input.plannedItem)}

TECHNICAL SEO BRIEF:
${prettyJson(input.technicalSeoBrief)}

FOUNDER ANSWERS:
${prettyJson(input.founderAnswers)}
`;
}

function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
