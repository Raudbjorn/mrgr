# Weighted uncertainty choice — 2026-09-07

The four 0.25 weights, point-estimate floors and retained unweighted conjunction are unchanged. The first weighted deletion/t candidate under-covered in its simulated development layout: 94.10%, 93.55%, 93.85% coverage for nominal 95%. Its source and result are preserved as `weighted-effects-candidate-v1.mjs` and `weighted-effects-calibration-v1.json`. It is not the accepted weighted interval. Calibration used simulated outcomes, before any repaired solver response.

The accepted weighted interval uses a conservative independent-lineage bound. This avoids tuning a t critical value to these simulations. For case i in cell s, let a_i=0.25/n_s and D_i=selected_i−comparator_i in [−1,1]. Then the weighted estimate is sum_i a_i D_i. Group all cases in lineage g together: X_g=sum_{i in g} a_i D_i and m_g=sum_{i in g} a_i. Thus X_g is in [−m_g,m_g], with arbitrary dependence inside a lineage. Conditional on the fixed cell/lineage frame and independent lineages, Hoeffding's bound gives

    P(|sum_g X_g − E sum_g X_g| >= w)
      <= 2 exp(−w² / (2 sum_g m_g²)).

Setting w=sqrt(2 log(40) sum_g m_g²) yields a two-sided 95% interval, clipped to [−1,1]. This is our application of the bounded independent-sum result in [Hoeffding (1963)](https://www.cs.rpi.edu/academics/courses/spring06/random/hoefding.pdf), not a new claim about the sampling design. The implementation verifies the inversion and unit total mass. It reports the rejected deletion/t interval separately as a diagnostic; it never selects the narrower interval based on results.

The guarantee requires independent lineage contributions and concerns the expected contrast conditional on this fixed frame. It does not correct acquisition bias, establish deployment prevalence, or supply a causal semantic-quality interpretation. Correlation across lineages from provider-wide drift remains a limitation; the three-run records expose some such variation without claiming to estimate it precisely. Missing cells still block standardization, and insufficient cell lineage support is explicitly unavailable rather than silently renormalized.

Cost of conservatism: the bound covered truth in all 6,000 calibration draws, but **none** of the +30pp scenario draws had a positive lower bound at this 60-case/34-lineage size. This is not a powerful interval. Development readiness uses the unchanged point-estimate floors, so the wider bound cannot rescue or stop a point-estimate failure. If readiness passes, power assessment must include this bound and may conclude insufficient information inside the inherited envelope. Do not substitute a favorable narrower interval or expand the envelope afterward. No confirmation is authorized.
