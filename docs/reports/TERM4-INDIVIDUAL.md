# Eben Studios Term 4 Individual Report

Ayabonga Jervasio Yawa | 221241558

CAPE PENINSULA UNIVERSITY OF TECHNOLOGY

Project 3  |  ICT Application Development

Ayabonga Jervasio Yawa
Student number 221241558
Academic year 2026
Prepared 2 November 2026

## Report purpose

This report reflects on my data and backend contribution to Eben Studios, the lessons gained through implementation and integration, and the improvements still needed. It builds on my submitted Term 3 report and the final local improvement package. The application has passing backend regression tests and a successful frontend build; browser acceptance and production integration remain separate completion checks.

## Contents

1 Project context and my responsibilities  •  2

2 Technical learning from data design  •  3

3 Technical learning from integration and testing  •  4

4 Communication and professional learning  •  5

5 Successes and disappointments  •  6

6 Recommendations for improvement  •  7

7 Verification record and references  •  8


---


# 1 Project context and my responsibilities

Eben Studios is an e-commerce application for a streetwear brand in Woodstock, Cape Town. Customers can browse products, create an account, build a cart, place an order and view their order history. Administrators manage products, images, stock and order progress. The implemented stack is React with Vite, an Express API, Prisma and SQLite. [1–3]

My main responsibility was the data side of the project. In earlier terms I developed UML and entity-relationship diagrams, contributed to the relational schema and supported the group as scribe. During Term 3, that work developed into practical safeguards for money, stock and historical orders. I also contributed to validation, checkout integration and setup documentation. [2]

| Work area | My responsibility | Practical outcome |
| --- | --- | --- |
| Data model and ERD | Main responsibility | Documented the implemented User, Product, Order and OrderItem model. |
| Money and snapshots | Main responsibility | Integer cents and purchase-time product names/prices. |
| Schema migration | Main responsibility | Preservation checks around the final data-integrity migration. |
| Validation and checkout | Contributed | Server checks, transactional ordering and retry protection. |
| Cancellation | Reviewed and tested | Stock comparison before and after repeated cancellation. |
| Setup and documentation | Contributed | Reproducible installation and database preparation. |
| Customer and admin UI | Shared team work | Interface integration with backend business rules. |

This distinction matters because Siyamthanda’s report records broader Express server and API work. I use that report to understand integration findings, without presenting the whole backend or frontend as my individual work. The Term 4 improvement package carries forward my data contribution and closes identified service and interface gaps. [3,4]

The public frontend reference is https://eben-studios.vercel.app/. Local operation is the delivery target for this improvement pass. A frontend URL alone does not establish a working hosted API, persistent database or completed payment process.


---


# 2 Technical learning from data design

## Moving from a diagram to an implemented model

At first, I treated the ERD mainly as a way of explaining which entities belonged in the system. Implementation showed me that a diagram must also explain the records the application actually stores. The earlier design used a broader Laravel-oriented model, while the running application uses four main entities. Updating the ERD to match Prisma helped me connect the design to concrete routes and queries. [2]

OrderItem resolves the relationship between orders and products, but it also records facts about a purchase. Its productName and unitPriceCents fields preserve the name and price used when the order was created. I learnt why this deliberate duplication is useful: updating a catalogue product must not rewrite a customer’s purchase history. Archiving keeps the product record available to existing references while removing it from the public catalogue.

## Representing money and enforcing rules

Using integer cents made monetary calculations easier to reason about. A price of R0.29 becomes 29 cents, so three units total exactly 87 cents. Decimal input is converted and checked before storage; division by 100 happens at the display boundary. The final frontend uses the same approach for cart estimates and order totals. This gave me a clearer understanding of the difference between stored business values and formatted screen values. [2,4]

I also learnt that validation and database constraints serve different purposes. API validation gives the user a useful message before a bad request is saved. Database CHECK constraints and foreign keys protect records when code changes or a write bypasses a normal route. The migration fixture now checks both preserved data and rejection of invalid direct writes, including negative stock and broken references.

## Changing a database without losing its history

The migration work taught me to think about existing records before adding required fields. SQLite table rebuilding required values to be copied, amounts converted and relationships checked. A fresh empty database would not expose all of those risks. Preflight checks and a backup therefore belong before migration, followed by a comparison of counts, identifiers, stock and monetary values. [2,4]

There are limits to what migration can recover. If a product was renamed before snapshots existed, the old name is unavailable unless another record preserved it. Backfilling the current name does not reconstruct that missing history. I would now identify such information requirements earlier and document any recovery limitation explicitly.


---


# 3 Technical learning from integration and testing

## Following a business operation across layers

Checkout made the boundary between frontend and backend responsibility much clearer. The browser can prevent accidental clicks and display a stock warning, but the API must read authoritative prices and update stock inside the same transaction as the order. If a later item is unavailable, earlier deductions must roll back. A successful response is meaningful only when the saved records also satisfy the business rule.

Retry handling provided a practical example. An idempotency key identifies one checkout attempt, so an unchanged retry can return the same order. During final source reconciliation, the backend required that header but the frontend service did not send it. The improvement connects the stored checkout reference to the actual HTTP request. This showed why reviewing each file separately can miss a failure at the point where two components communicate. [4]

Order cancellation taught me to compare data rather than rely on a status label. My Term 3 PowerShell checks initially ran into arrays and ambiguous archived-product matches. Selecting one record and retaining its numeric ID made the stock comparison reliable. The relevant question was whether stock returned once after cancellation, including when the same request was repeated. [2]

## Choosing evidence that tests the claim

My Term 3 report included seven passing helper tests. Those tests supported money conversion and validation, but they could not establish that authenticated HTTP routes, transactions and frontend requests worked together. The final package retains those tests and expands the suite to 21 cases, including HTTP workflows and a legacy migration fixture. All 21 passed in the recorded local run. [4]

The additional cases check duplicate checkout, insufficient stock, concurrent buyers, invalid status changes, customer/admin boundaries, historical snapshots and uploads. Frontend lint and production build also pass. These results give stronger regression evidence than a screenshot alone, although they do not establish browser usability or production readiness.

## Understanding deployment as a separate task

The earlier Vercel problems showed that a deployed interface can still depend on a backend running on someone’s computer. A production API address, allowed browser origins, persistent storage and client-route rewriting all need to agree. The improvement includes configuration and deployment instructions, while retaining SQLite for local use. Moving to PostgreSQL would require a tested data migration, rather than simply rerunning SQLite migrations against a new provider. [3,4]


---


# 4 Communication and professional learning

## Keeping shared work understandable

Working as scribe and maintaining technical documentation helped me see documentation as part of integration. A diagram, setup guide and source file can each look reasonable while describing different versions of the application. When that happens, another team member cannot confidently reproduce the result. My contribution therefore included keeping the data design and setup instructions aligned with the implementation. [2]

The final source comparison reinforced that lesson. The ZIP contained Phase 5 instructions that explicitly described planned work, alongside code from earlier phases. Treating every statement in that guide as completed functionality would have overstated progress. The organised phase folders now separate implementation steps, checkpoint commands, expected results and failure responses. This makes the work easier for another developer to follow. [4]

## Explaining problems precisely

The PowerShell testing difficulties taught me to describe the observed problem before changing the code. A product lookup that returns several records is different from a stock-restoration failure. Recording the selected product ID, starting stock, request and resulting stock makes a problem easier to discuss and reproduce. I would apply that habit to future bug reports instead of relying on a general statement that a feature does not work.

I also learnt to distinguish ownership from collaboration. My database work supported shared screens, and Siyamthanda’s API work supported the same customer journey. Clear contribution boundaries make the report more accurate and help the group identify who should review a particular change. I should be able to explain how my work connects to the system without claiming responsibility for every feature it touches.

## Planning and honest progress reporting

The most useful planning improvement is to define completion before starting a task. For checkout, that means more than creating an order: repeated requests, unavailable stock and cancellation also need checks. For a report, it means having evidence for a statement before writing it as a completed achievement. This approach makes remaining work visible earlier.

Some final checks could not be completed in the authoring environment. Browser startup failed, and GitHub publishing was blocked by integration access and unavailable Git credentials. Those are recorded as limitations, not successful outcomes. The phase guides and transfer package allow the work to continue on an enabled machine. This experience reinforces the value of a handover that explains exactly what was verified and what the next person still needs to do.

For future projects, I would keep a short contribution and verification log during development, including decisions, failed checks and resolved issues. That would reduce the effort needed to reconstruct individual work at submission time and make team discussions more concrete.


---


# 5 Successes and disappointments

## What worked well

The strongest outcome of my data contribution is a model that supports consistent order records. Integer cents make calculations explicit, snapshots protect purchase history, and archiving preserves references. The five-migration history connects those decisions to the implemented schema. These are useful improvements because they protect the behaviour that customers and administrators depend on. [2,4]

The final verification package also addresses several scenarios that had no recorded run in Term 3. It now demonstrates transaction rollback, retry behaviour, lifecycle restrictions and account separation through actual HTTP requests. The legacy fixture adds evidence that representative records survive conversion and that invalid writes are rejected. This makes it easier to detect a regression after later changes.

The application source now connects the backend rules more consistently to the interface. Featured products come from the catalogue, order history uses snapshots, optional product fields can be cleared, and archived items can be restored. The dashboard calls its metric Paid order value and explains that it reflects recorded statuses. These are shared application improvements supporting the data work, rather than a claim of sole interface authorship.

## What remained difficult or incomplete

One disappointment was the gap between described functionality and available evidence. The Term 3 material included important designs and passing helper tests, but some wider behaviours were still unrecorded. The final comparison also found an integration mismatch in the checkout header. I would reduce this risk by checking a complete customer action whenever a service contract changes, then retaining that check as a regression test.

The local frontend can build successfully without proving that every control works in a real browser. Browser acceptance, keyboard use and responsive layout checks remain pending because the available browser tools failed to start. The supplied checklist and smoke script identify those checks. I cannot claim an accessibility percentage, a completed user acceptance exercise or a new browser screenshot from this pass.

The application also remains a prototype in several practical respects. Payment-provider confirmation, production recovery procedures, monitoring and stronger account protections are future work. A manually assigned Paid status is not evidence that funds settled. Product images still need owner review, and upload signature checks do not replace complete image decoding or malware screening.

These limits do not remove the value of the completed data and integration work. They define the boundary of what the evidence supports and give the next development stage a specific starting point.


---


# 6 Recommendations for improvement

I would complete acceptance and operational safeguards before extending the catalogue model. The recommendations below are ordered by their effect on reliable use and by the evidence still missing. They are proposed next steps, not completed features.

| Priority and action | Reason | Completion evidence |
| --- | --- | --- |
| 1 Complete browser acceptance | Build/API tests cannot establish customer and admin usability. | Run the smoke script and B01–B18 checklist; record browser, date, results and corrected failures. |
| 2 Publish and review the branch | Shared history and remote CI are needed for reviewable team handover. | Push the supplied branch, open a PR, inspect passing Actions and resolve review findings. |
| 3 Validate hosted API and recovery | The live frontend needs a reachable backend and durable data/uploads. | Hosted checkout and restart tests; restore a backup in a separate environment and compare records. |
| 4 Verify payment events | Manual Paid status cannot establish settlement. | Test signed provider callbacks, duplicate events, failed payments and reconciliation. |
| 5 Strengthen accounts and uploads | Local validation is only part of operational protection. | Account recovery/throttling tests, image decoding checks and review of remaining dependency findings. |
| 6 Add categories only with a full contract | Unsupported controls confuse customers and add incomplete scope. | Agreed schema/API/UI, migration test and working category filtering before release. |

## Improving my own working process

I would maintain the ERD and migration notes in the same change as the schema, then ask a teammate to follow the setup instructions from a clean clone. That exercise would reveal assumptions hidden in my own machine, such as an existing database file or a missing environment value. The acceptance criterion would be a reproducible install and a passing documented check, rather than only my confirmation that it works locally.

I would also record my responsibilities and test evidence throughout the term. Each substantial change should identify the problem, the affected data rule, the test used and any unresolved limitation. This would make progress reviews more useful and improve the accuracy of my final reflection. Where a feature is shared, the log should explain my contribution and name the integration boundary without implying sole ownership.

## Conclusion

The project strengthened my ability to connect data modelling with running software. My most important learning was to evaluate an implementation through the records and behaviour it preserves, and to support completion claims with appropriate evidence. The remaining acceptance and deployment work is documented so that the next stage can build on a clear, reproducible local baseline.


---


# 7 Verification record and references

This report was prepared after the local implementation and available verification. The source package contains the complete phase guides and test outputs. Counts below refer to the final recorded local run, not the existing live deployment. [4]

| Verification | Recorded outcome |
| --- | --- |
| Backend tests | 21 passed; 0 failed; 0 skipped. |
| JavaScript syntax | 20 backend source, script and test files passed. |
| Schema and migrations | Valid Prisma schema; five migrations; fresh HTTP database and legacy fixture checked. |
| Frontend checks | Lint and production build passed after clean dependency installation. |
| Dependency snapshot | Backend 0 advisories; frontend runtime 0; frontend full audit 6 moderate development-tool findings. |
| Browser and accessibility | Pending local acceptance; no visual pass or conformance score claimed. |
| GitHub and deployment | Local branch committed; publishing blocked in this session. No production deployment performed. |

## References

[1] Cape Peninsula University of Technology. 2026. Project specification for 2026, dated 1 February. Supplied PDF, page 3: Term 4 individual report requirements.

[2] Yawa, A. J. 2026. Term 3 Individual Submission. Student number 221241558, 29 September. Supplied submitted PDF, especially pages 2–3, 6–10.

[3] Mnyabiso, S. 2026. Eben Studios Term 3 Project Report. Supplied PDF, especially pages 1–2 and 7–12: API work, observed test failures and deployment limitations.

[4] Eben Studios project materials. 2026. Supplied EbenStudios ZIP and reviewed improvement branch. Implementation commit e7703cb; subsequent handover/documentation updates recorded in Git history. See docs/AUDIT.md, docs/DATA-DESIGN.md and docs/testing/RESULTS.md.

Repository: https://github.com/JerivasioYawa/EbenStudios

Frontend reference: https://eben-studios.vercel.app/ (deployment reference supplied with the project; not revalidated as a working full stack in this pass).

The advisory rubric assessment is supplied separately. It is not part of the individual submission and does not represent a lecturer-awarded mark.
