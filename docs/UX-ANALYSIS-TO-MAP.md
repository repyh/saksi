# Analysis → Peta Pekerjaan

Updated 9 November 2026.

## Research and interpretation

- Boy, Eveillard, Détienne & Fekete (2016), *Suggested Interactivity: Seeking Perceived Affordances for Information Visualization*, IEEE TVCG 22(1), 639–648, DOI [10.1109/TVCG.2015.2467201](https://doi.org/10.1109/TVCG.2015.2467201). [Primary abstract indexed by PubMed](https://pubmed.ncbi.nlm.nih.gov/26390473/), [authors' laboratory publication record](https://www.lisn.upsaclay.fr/publications/suggested-interactivity-seeking-perceived-affordances-for-information-visualization-2/?lang=en). The authors tested three suggested-interactivity cues. Only SI3 encouraged interaction in their study; they hypothesize its feedforward contributed to the result. This supports testing cues that communicate an action's outcome, rather than assuming a hand cursor or decorative animation is sufficient. It does not establish that any particular button treatment increases conversion on SAKSI.
- Heer & Shneiderman (2012), *Interactive Dynamics for Visual Analysis*, Communications of the ACM 55(4), 45–54. [Author laboratory page](https://idl.uw.edu/papers/interactive-dynamics). The taxonomy covers selecting, navigating, coordinating views, and guiding analysis. We apply that framework to retain a selection between a macro chart and the map/register.
- van Berkel et al. (2024), *Impact of interaction technique in interactive data visualisations: A study on lookup, comparison, and relation-seeking tasks*, International Journal of Human-Computer Studies 192, 103359, DOI [10.1016/j.ijhcs.2024.103359](https://doi.org/10.1016/j.ijhcs.2024.103359). In the tested tasks, participants performed best with techniques that let them conceal information they considered less relevant, alongside lower intrinsic and extraneous cognitive load. This supports keeping the overview focused and showing a group's next actions only after the user focuses or selects that group; it does not prove a specific number of buttons is optimal here.
- Chernev, Böckenholt & Goodman (2015), *Choice overload: A conceptual review and meta-analysis*, Journal of Consumer Psychology 25(2), 333–358, DOI [10.1016/j.jcps.2014.08.002](https://doi.org/10.1016/j.jcps.2014.08.002). Their meta-analysis of 99 observations (N=7,202) finds choice-set complexity, task difficulty, preference uncertainty, and effort-minimizing goals moderate choice overload. We use this as a caution to avoid presenting repeated, competing calls to action; it is not a claim that button count alone causes overload.

## Applied design

- Underlined group labels, arrow icons, visible outcome labels on drill-down rows, and hover/focus feedback expose which chart marks can be opened.
- A persistent group preview describes the cohort and offers two explicit actions: inspect its composition or open it in Peta Pekerjaan. The same preview works through keyboard focus; it is not hover-only.
- The section has one dominant map action. Repeated per-year map links were removed; focusing a decile reveals one contextual map action, while the overview CTA stays available.
- A clear section label, direct question as the heading, short chart explanation, one key finding, and smaller supporting year statistics establish reading order before the detailed decile interaction.
- Package rows say **Buka di peta**, instead of relying on an unexplained arrow.
- Moving between chart levels focuses the new chart heading and retains a clickable breadcrumb. Scrolling respects reduced-motion preferences.
- The map receives region, year, decile, work category, and kecamatan as applicable. A visible cohort banner explains the active selection and provides an escape to the broader map.
- Deciles are ranked across the whole year's portfolio before geographic/work/location filters are applied. Re-ranking after a filter would silently change the selected cohort.
- The default map still shows located packages. An explicitly selected general-location group opens the register with that scope and location filtering disabled; it does not invent map positions.

## Evaluation boundary

Automated checks cover cohort identity, filtering, query validation, and URL preservation. These are research-informed design changes, not a measured usability improvement. A later task-based study should measure whether first-time users discover a group, open its details, and reach the corresponding map without assistance; compare completion rate, wrong turns, and time to first successful map arrival.
