# UX navigation audit lens

## Selected paper

Ed H. Chi, Peter Pirolli, and James E. Pitkow, “The Scent of a Site: A System for Analyzing and Predicting Information Scent, Usage, and Usability of a Web Site,” in *Proceedings of CHI 2000*, pp. 161–168. [ACM Digital Library](https://doi.org/10.1145/332040.332423) · [Authors’ publication record](https://research.google/pubs/the-scent-of-a-site-a-system-for-analyzing-and-predicting-information-scent-usage-and-usability-of-a-web-site/)

## Why it fits this audit

The paper examines how people use cues near a link to predict what they will find after following it. It presents a system combining information-foraging theory, web usage data, and site structure to analyze and predict navigation and usability. This fits a whole-site review because SAKSI has several connected tasks and destinations: discovering analysis, reaching the map, finding packages and providers, reading detail pages, and submitting or reviewing reports.

The paper is a modeling and analysis paper, not a prescriptive checklist or a user study of SAKSI. The criteria below are an audit adaptation of its information-scent framing; findings should be verified in task-based testing before being treated as observed user behavior.

## Audit questions derived from the paper

For each key task and each navigation step, record:

1. **User goal:** What is the user trying to find or do?
2. **Available cues:** What do the label, nearby text, icon, placement, and visual emphasis imply?
3. **Expected destination:** From those cues, what content or action would a reasonable user expect?
4. **Destination match:** Does the destination provide that content or action, and does it make the next step clear?
5. **Path cost:** How many choices, page changes, or repeated decisions stand between the entry point and task completion? Are there useful shortcuts such as search or direct links?

Flag a navigation concern when the cues are vague, competing, or inconsistent with the destination; when an important destination is hard to discover; or when a route adds avoidable steps or leaves the user unsure where to continue. For each finding, capture the exact route/component, evidence in the interface, affected task, severity, and a concrete improvement. Do not infer user confusion from appearance alone; mark it as a hypothesis until tested.

## Source notes

- The authors’ publication record identifies this as a CHI 2000 paper and gives pages 161–168.
- The paper’s abstract describes combining information-foraging theory, a visualization reference model, and web data-mining techniques to analyze and predict site use and usability.
- “Information scent” is used here in the paper’s sense: cues available before following a link help users estimate the value and likely content of the destination.
