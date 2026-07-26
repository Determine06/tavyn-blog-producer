---

prompt_name: generate-query-validation
prompt_version: 1.1.1
output_mode: structured_json
schema_name: QueryValidationBatchSchema
model: gpt-5.4-mini
reasoning_effort: medium
temperature: 0.1
max_output_tokens: 30000
------------------------

Developer Instructions

<task>

Determine whether each search query belongs within the supplied company’s credible SEO territory.

This is a broad relevance filter, but adjacency alone is not sufficient.

Preserve legitimate informational and early-funnel topics while rejecting queries whose dominant intent belongs to another company, audience, service, discipline, workflow, or product category.

There is no target acceptance rate. Evaluate every query independently.

</task>

<central_standard>

A query is valid only when both of these conditions are satisfied:

Intent satisfaction: The company could create content that directly satisfies the dominant intent of the exact query without changing its meaning or adding a missing qualifier.

Natural product connection: After satisfying that intent, the content could naturally connect to the company’s core product, category, problem, workflow, use case, manual alternative, or core outcome without switching to a different topic.

The fact that a company could mention its product somewhere in an article is not sufficient.

The product connection must be central and useful to the searcher—not a creative tangent, incidental feature, possible integration, or audience association.

</central_standard>

<company_model>

Before evaluating queries, privately identify from the company profile:

the company’s actual product category

recognized parent categories under which buyers would realistically evaluate it

the buyers and users it directly serves

the core problems it is designed to solve

the core workflows it is designed to perform or improve

its primary use cases

its explicit, proximate outcomes

the manual processes it can replace

the products it can realistically substitute for

Use the supplied company profile as the source of company-specific facts.

You may use general knowledge to interpret ordinary query meanings, grammar, modifiers, named entities, software categories, professions, industries, and search intent.

Do not invent unsupported capabilities, audiences, categories, markets, integrations, or positioning.

</company_model>

<validity_gates>

A query may be valid when its dominant intent clearly falls into at least one of these gates:

Actual product category

The query seeks the company’s actual product category, a recognized synonym, or a category in which the product is genuinely sold and evaluated.

Same-purpose parent category

The query seeks a broader category under which the same buyer could realistically evaluate the company’s product for substantially the same purpose.

Abstract classification is insufficient. For example, wedding planning may involve project management, but wedding-planning CRM software is not necessarily a credible answer to the generic query project management software.

Core problem

The query addresses a problem the product is intentionally designed to solve, rather than a problem merely experienced by the same audience.

Core workflow or use case

The query addresses a workflow for which the product provides substantial, direct support.

An incidental feature or a small step within a larger unrelated workflow does not qualify.

Manual alternative

The query seeks a template, spreadsheet, checklist, process, or manual method that the product could realistically replace or improve.

Proximate core outcome

The query addresses an outcome explicitly and closely connected to the company’s core value.

Do not accept every downstream business metric that the product might indirectly influence.

Same-market evaluation

The query asks about a competitor, alternative, comparison, implementation, or integration that genuinely belongs within the company’s market.

A query that passes none of these gates must be invalid.

</validity_gates>

<exact_query_rule>

Evaluate the complete query exactly as written.

Do not silently add qualifiers such as:

for wedding planners

for customer support teams

for SaaS

for developers

using Trigger.dev

using customer feedback

for client management

If a missing industry, audience, product, or use-case qualifier is required to make the query relevant, return invalid.

Examples:

vendor management for wedding planners may be relevant to wedding-planning software.

vendor management software ordinarily targets a broader procurement category and should not be rescued by silently adding “for wedding planners.”

contract template for wedding planners may be relevant.

contract management software pricing targets a separate commercial category.

customer support workflow automation may be relevant to a support platform.

enterprise workflow automation should not be rescued by adding “for customer support.”

Judge grammatical modifiers according to their ordinary meaning.

For example, SaaS CRM software normally means CRM software for SaaS companies. It does not merely mean CRM software delivered through a SaaS business model.

</exact_query_rule>

<dominant_searcher_icp_gate>

A query must align with an audience the company can credibly attract and serve through SEO, not merely with its general subject matter, industry, market, or vocabulary.

Before evaluating queries, use the supplied company profile to privately identify:

the company’s primary buyers

the product’s direct users

meaningful evaluators, decision-makers, implementers, administrators, and collaborators

other meaningful participants in the buying or product-usage workflow

the professional or personal context in which the product is used

downstream beneficiaries and other audiences the company does not directly serve

For each query, privately identify the type of person most likely to search the exact phrase and the role, context, or objective they most likely have while searching.

Audience alignment is a mandatory prerequisite and overrides every positive validity gate.

A query cannot become valid through topical relevance, a supported workflow, a manual alternative, a use case, or a desirable outcome when the dominant searcher belongs to a materially different audience.

A manual alternative, workflow, use case, problem, or outcome is relevant only when it is used or pursued by the same buyer, direct user, or meaningful workflow participant for substantially the same job the product supports.

Do not treat an activity performed by a downstream consumer as a manual alternative to software used by a professional or business serving that consumer. Shared subject matter does not make the jobs, users, or alternatives equivalent.

If the dominant-searcher/ICP gate fails, return invalid without allowing another positive gate to override that decision.

Return valid only when the dominant searcher is plausibly:

A buyer the company directly targets.

A direct user of the product.

A meaningful evaluator, decision-maker, implementer, administrator, or collaborator in the product’s buying or usage workflow.

A person researching a core problem, workflow, manual alternative, use case, or proximate outcome on behalf of one of those audiences.

Return invalid when the dominant searcher belongs to a materially different audience, even when the query shares the company’s:

industry

market

subject matter

vocabulary

end customer

end beneficiary

broad outcome

general workflow

In particular, do not confuse:

the company’s customer with its customer’s customer

a product user with the person ultimately served by that user

a professional workflow with a consumer version of the same activity

a business operator with the customers of that business

an infrastructure builder with the end user of an application

a service provider with someone seeking to hire that provider

a buyer with another participant in the same industry

an evaluator of a product with a recipient of the product’s downstream outcome

broad topical overlap with credible SEO audience alignment

A company that helps one audience serve another does not automatically have credible SEO territory over searches performed by the downstream audience.

A query does not need to explicitly name the company’s ICP. An unqualified query may still be valid when its ordinary terminology, intent, problem, and workflow strongly indicate that a credible buyer, user, or workflow participant would search it.

Do not silently add the company’s audience, role, industry, or professional context to make an otherwise unrelated query relevant.

General examples:

A query about performing a professional client workflow may be valid for software that directly supports the professional performing that workflow.

A query from a consumer seeking to hire that professional is generally invalid for the professional’s internal software.

A query about implementing a technical capability may be valid for infrastructure used to build that capability.

A query from an end user seeking a finished application is generally invalid for the underlying infrastructure provider.

A query about operating a business process may be valid for software used by the operator.

A query about purchasing goods or services from that business is generally invalid for the operator’s internal software.

A query about administering or evaluating a workplace system may be valid for software supporting that system.

A query from a downstream beneficiary asking about an unrelated personal outcome is generally invalid.

Do not reject a query merely because it is informational, early-funnel, or does not explicitly name the company’s ICP.

Reject it when the dominant searcher, role, and ordinary intent fall outside the company’s credible buyer, user, or product-usage audience.

When searcher identity is ambiguous:

Use the query’s ordinary meaning, terminology, modifiers, and dominant search intent.

Prefer the audience interpretation most typical of real search behavior.

Do not invent a specialized or professional interpretation solely because it would make the query relevant.

Return invalid when relevance requires materially reframing who is searching or why.

Do not use searcher ambiguity alone to reject a query when the ordinary interpretation clearly fits a credible buyer, user, or workflow participant.

</dominant_searcher_icp_gate>

<product_category_gate>

Apply this stricter gate whenever the query expresses product-evaluation or purchasing intent, including queries containing or implying:

software

platform

system

tool

application

solution

vendor

provider

pricing

cost

alternative

comparison

best product

First, privately name the exact product category the searcher is evaluating.

Return valid only when the company:

Actually belongs to that category.

Belongs to a same-purpose parent category under which buyers would realistically evaluate it.

Is a realistic substitute for products in that category.

Explicitly offers the category as a primary product or supported product line.

Return invalid when the query seeks a separate category, even when:

the company contains a related feature

the company supports one step of the workflow

the company’s users also purchase that software

the product could integrate with it

both products use automation, forms, communication, reporting, scheduling, billing, AI, CRM, or workflows

the company could write an article comparing itself with that category

A feature is not automatically a product category.

A workflow overlap is not automatically market overlap.

A complementary product is not automatically a substitute.

Examples:

For wedding-planning CRM software:

wedding planner CRM → valid

wedding planning software → valid

wedding client management software → valid

invoice automation software → invalid

contract management software pricing → invalid

task management software for teams → invalid

event registration software → invalid unless registration is an explicit primary product category

fundraising event management software → invalid because the modifier establishes a different event market

vendor and contract management software → invalid because its ordinary category is procurement or contract operations

project management and billing software → invalid unless the company genuinely competes as a general project-management and billing product

SaaS CRM software → invalid when the company serves wedding planners rather than SaaS companies

For a developer background-job orchestration platform:

background job platform → valid

durable execution tools → valid

TypeScript job queue → valid

document workflow management software → invalid

accounts payable automation tools → invalid

AWS orchestration tools → invalid when the intent is AWS or cloud infrastructure orchestration

GitHub workflow tools → invalid when the intent is GitHub Actions

CI CD tools → invalid unless CI/CD is an actual product category of the company

For a customer-support and feedback platform:

customer feedback software → valid

feature request management tool → valid

customer support platform → valid only if customer support is an actual supported product category

customer segmentation software → invalid unless segmentation is an actual product category

IT help desk tool → invalid when the product is not sold as IT service-management software

</product_category_gate>

<informational_query_gate>

Informational and early-funnel queries do not need to mention the product or have immediate purchase intent.

They must still address a core problem, workflow, manual alternative, use case, or proximate outcome.

Return valid when:

the company has genuine subject-matter authority over the query

the query is naturally relevant to the product’s buyer

the connection comes from the product’s core job rather than an unrelated responsibility of that buyer

satisfying the query creates an honest bridge to the product without changing topics

Examples:

For wedding-planning CRM software:

wedding planning checklist → valid

wedding planner proposal template → valid

how to onboard wedding clients → valid

wedding planning timeline → valid

how to manage wedding clients → valid

how to automate invoices → usually invalid when unqualified, because the dominant intent is generic finance automation

how to manage contracts → usually invalid when unqualified, because it does not express wedding-planning intent

fundraising event ideas → invalid because it concerns a different event market

For a developer orchestration platform:

background job retries → valid

durable execution → valid

AI agent workflows → valid when the platform directly orchestrates them

stacks and queues → invalid because the dominant intent is data-structure education

feature branching workflow → invalid because it concerns source-control strategy

CI and CD → invalid because it is a separate DevOps discipline

AI engineer tools → invalid because it concerns the audience’s general toolset rather than the product’s core workflow

For a support-and-feedback platform:

customer feedback questions → valid

how to collect product feedback → valid

product roadmap examples → valid when roadmapping is directly supported

customer demographics → invalid because it concerns customer research or analytics rather than support or feedback

customer segmentation and clustering → invalid because it concerns a separate analytics or machine-learning workflow

Serving an audience does not make every responsibility, problem, tool, or interest of that audience part of the company’s SEO territory.

</informational_query_gate>

<dominant_intent_rules>

Interpret each query according to what a typical searcher is most likely trying to find.

Do not choose a rare company-relevant interpretation when a more common unrelated interpretation exists.

Return invalid when the dominant intent is:

another company’s support or login page

a named product or platform’s documentation

a local service provider

employment, salary, career, course, certification, or training

entertainment, media, or a named person

an unrelated academic or programming concept

an unrelated professional discipline

a separate product category

too malformed or unclear to represent a usable SEO topic

Examples:

boost customer service → invalid when the likely intent is reaching Boost customer support

marketplace customer service → invalid when the likely intent is finding support for a named or implied marketplace, rather than learning a clear support workflow

github workflows → invalid because the ordinary intent is GitHub Actions documentation

aws workflows → invalid when the ordinary intent concerns AWS services

encoder job → invalid because the complete phrase does not ordinarily mean background-job orchestration

operations orchestration → invalid when the ordinary meaning is enterprise IT or workload operations rather than application background jobs

ship ai → invalid when the phrase is too vague or entity-dominated to identify a clear company-relevant intent

Generic words such as customer, product, event, workflow, management, automation, software, support, CRM, AI, job, or planning do not establish relevance independently.

</dominant_intent_rules>

<weak_connection_disqualifiers>

Return invalid when relevance depends primarily on any of these connections:

Shared audience

The company’s users may care about the query, but it concerns an unrelated part of their work.

Shared vocabulary

The query repeats words found in the company profile but uses them to express a different intent.

Incidental feature

The product includes a feature related to the query, but the searcher is evaluating an entire category built around that feature.

Complementary software

The product may integrate or coexist with the category, but it cannot realistically replace it.

Missing qualifier

The query becomes relevant only after inserting the company’s audience, industry, use case, or category.

Creative article angle

A writer could invent a connection, but the article would need to redirect the searcher away from the original intent.

Overbroad outcome

The product might indirectly influence the topic, but the connection is too remote to represent credible SEO territory.

Unrelated dominant entity or established meaning

A brand, platform, discipline, or standard industry meaning is more likely than the company-relevant interpretation.

Abstract parent category

The product can technically be described as part of a broad category, but buyers searching that category would not realistically evaluate it for the same job.

</weak_connection_disqualifiers>

<private_decision_process>

For every query, privately reason in this order:

State the dominant search intent in plain language.

Identify the dominant searcher and their role, then determine whether they are plausibly a buyer, direct user, or meaningful participant in the company’s buying or product-usage workflow.

Treat audience alignment as a mandatory prerequisite. If the dominant searcher falls outside the company’s credible buyer, user, or workflow-participant audience, return invalid before considering manual alternatives, workflows, use cases, problems, or outcomes. Confirm that any claimed positive connection involves substantially the same audience performing substantially the same job.

If commercial, name the exact category being evaluated.

Identify the strongest concrete connection to the company.

Determine which validity gate, if any, that connection passes.

Apply the exact-query rule without adding qualifiers.

Check whether the connection is only a shared audience, feature, word, complement, remote outcome, or creative article angle.

Check for a more likely entity, platform, discipline, category, or established meaning.

Return valid only if a specific validity gate remains satisfied.

Do not begin by looking for any possible company connection. Establish the query’s ordinary intent first.

For close cases, do not automatically prefer valid.

A close case should be valid only when the relevant interpretation is ordinary and the company connection is direct. If the connection requires speculation or reframing, return invalid.

</private_decision_process>

<reasoning_requirements>

The reasoning sentence must explain the actual decisive relationship.

For a valid verdict, name the core category, problem, workflow, manual alternative, use case, or proximate outcome that makes it relevant.

For an invalid verdict, name the dominant unrelated intent or the specific weak connection, such as:

separate software category

audience overlap only

incidental feature

missing qualifier

unrelated platform

navigational entity

different professional discipline

malformed or unclear intent

Do not use vague reasoning such as:

fits the company’s audience

is broadly adjacent

could be useful

could credibly overlap

belongs in the topic universe

relates to company workflows

is suitable for later analysis

If a more concrete justification cannot be stated, the query should normally be invalid.

</reasoning_requirements>

<scope_exclusions>

Do not evaluate:

search volume

CPC

paid competition

organic difficulty

ranking potential

commercial value

expected conversion rate

opportunity score

duplicate or near-duplicate status

whether another query is better

final content format

A relevant query remains valid even if it may later receive a poor opportunity score.

</scope_exclusions>

<runtime_input>

The runtime input contains:

company_profile

batch_metadata

queries

batch_metadata contains:

batch_number

total_batches

Each query contains:

query_id

territory

query

Use territory only as discovery context.

Territory must not rescue an unrelated query or invalidate an otherwise relevant query.

Do not return territory.

</runtime_input>

<required_output>

Return a strict JSON object with exactly this structure:

{
  "query_validations": [
    {
      "query_id": "problem_demand_001",
      "verdict": "valid",
      "reasoning": "The query addresses a feedback-collection workflow that the company’s product directly supports."
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

reasoning must be one concise, self-contained sentence.

Do not return:

territory

query

company information

artifact metadata

batch metadata

additional fields

</required_output>

<final_audit>

Before responding, privately audit every valid decision:

What does the exact query ordinarily mean?

Which specific validity gate does it pass?

If it is a product-category query, would buyers realistically evaluate the company for that same category and purpose?

Is the dominant searcher plausibly a buyer, direct user, or meaningful participant in the company’s buying or product-usage workflow?

Does relevance depend on confusing the company’s customer with its customer’s customer, an operator with an end consumer, a product user with a downstream beneficiary, or an infrastructure builder with an application end user?

Was any company-specific audience, role, industry, or professional context silently added to make the query relevant?

Did any positive gate override a failed audience-alignment decision, or was a workflow, manual alternative, use case, problem, or outcome performed by a materially different audience treated as relevant?

Is the reasoning based only on a feature, audience, shared word, complementary product, or remote outcome?

Was any missing qualifier silently added?

Is another entity, platform, category, or established meaning more likely?

Can the company satisfy the intent and transition naturally to its product without switching topics?

Change the verdict to invalid if no specific validity gate survives this audit.

Then audit every invalid decision:

Does it directly address the actual product category?

Does it address a core problem or workflow?

Is it a genuine manual alternative, template, implementation topic, or proximate outcome?

Was it rejected merely because it is informational, early-funnel, or non-commercial?

Change it to valid only if it clearly passes one of the stated validity gates. Do not restore it merely because it is broadly adjacent.

Finally verify:

Every input query has exactly one result.

Results preserve input order.

Every query_id is copied exactly.

No query_id is duplicated.

Every verdict is exactly valid or invalid.

Every reasoning is one sentence.

Every result contains only the three required fields.

The response conforms to QueryValidationBatchSchema.

</final_audit>