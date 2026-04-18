// api/futureready-analyze.js

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body;

  const core = body.core_questions || {};
  const moduleQ = body.module_questions || {};
  const industry = body.industry || {};
  const debrief = body.debrief || {};

  const coreValues = Object.values(core).map(Number).filter(v => !isNaN(v));
  const moduleValues = Object.values(moduleQ).map(Number).filter(v => !isNaN(v));
  const allValues = [...coreValues, ...moduleValues];

  const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const scaleTo100 = v => Math.round((v / 5) * 100);

  const futureReadyScore = scaleTo100(avg(allValues));

  const domain = (keys) => {
    const vals = keys.map(k => Number(core[k] || 0)).filter(v => v > 0);
    return vals.length ? avg(vals) : 0;
  };

  const domains = {
    leadership: domain(['q1', 'q2', 'q3', 'q4']),
    operational_stability: domain(['q5', 'q6', 'q7', 'q8']),
    cognitive_diversity: domain(['q9', 'q10', 'q11', 'q12']),
    tech_ai: domain(['q13', 'q14', 'q15', 'q16']),
    momentum: avg([
      ...['q17', 'q18', 'q19', 'q20'].map(k => Number(core[k] || 0)),
      ...moduleValues
    ].filter(v => v > 0))
  };

  const industryStabilityScore = scaleTo100(domains.operational_stability || 0);

  const band = (score) => {
    if (score < 50) return 'low';
    if (score < 70) return 'developing';
    if (score < 85) return 'strong';
    return 'elite';
  };

  const frBand = band(futureReadyScore);

  const narrative = {
    executive_summary:
      frBand === 'low'
        ? 'Right now, your organization is carrying significant friction that blocks future‑ready performance...'
        : frBand === 'developing'
        ? 'You have clear signs of future‑ready potential, but key gaps are still slowing momentum...'
        : frBand === 'strong'
        ? 'You are operating with a strong future‑ready posture, with a few targeted upgrades unlocking the next level...'
        : 'You are functioning at an elite future‑ready level, where the focus shifts to compounding advantages...',
    domain_breakdown:
      'Leadership, operational stability, cognitive diversity, technology & AI, and momentum each tell a specific story about how your organization behaves under pressure and change...',
    industry_insights:
      `Within ${industry.selection || 'your industry'}, your current posture places you ahead of many peers in some areas while still leaving room for targeted upgrades in others...`,
    ai_readiness_summary:
      'Your AI readiness is emerging from practical experimentation and early wins, but there is still untapped value in workflows, data, and decision support...'
  };

  const roadmap = {
    day_1_3: 'Clarify the top three operational priorities and assign clear owners with visible accountability...',
    day_4_5: 'Introduce a simple weekly scorecard and review rhythm that connects leadership intent to frontline execution...',
    day_6_7: 'Pilot one AI‑assisted workflow in a low‑risk area to build confidence and visible momentum...'
  };

  const strengths = [
    'You have clear leadership intent and visible ownership at the top.',
    'Your team demonstrates adaptability under changing conditions.',
    'You are already experimenting with technology in meaningful ways.'
  ];

  const bottlenecks = [
    'Operational processes are not yet standardized across locations or teams.',
    'Decision‑making still relies heavily on a few key individuals.',
    'Data is not consistently used to guide weekly priorities.'
  ];

  const facilitator = {
    plan_30_day:
      'Over the next 30 days, focus on stabilizing one flagship process, installing a simple scorecard, and creating one visible AI‑assisted win...',
    momentum_commentary:
      'This client is primed for visible early wins if we anchor around operational stability and one flagship AI‑enabled workflow...'
  };

  return res.status(200).json({
    future_ready_score: futureReadyScore,
    industry_stability_score: industryStabilityScore,
    domains,
    strengths,
    bottlenecks,
    narrative,
    roadmap,
    facilitator
  });
}