// ═════════════════════════════════════════════════════════════════════
// FUTURE-READY TRANSFORMATION ANALYSIS ENGINE — v1.1.0
// SME Media Group, LLC | Clarksville, TN
// Endpoint: POST /api/futureready-analyze
//
// v1.1.0 changes:
//   - Added x-api-key authentication (Bug #6)
//   - Added validation_warnings[] to response (Bug #5)
//   - Removed body[''] phantom key (Bug #4)
//   - ISS edge case cap when FRS < 40 (Bug #7)
// ═════════════════════════════════════════════════════════════════════

// ─── DOMAIN CONFIGURATION ────────────────────────────────────────────────
const DOMAINS = [
  {
    key: 'Leadership',
    label: 'Leadership Clarity & Alignment',
    questions: [1, 2, 3, 4],
    weight: 0.25,
    descriptors: {
      critical:  'Leadership direction is undefined or inconsistent, creating confusion across the organization.',
      atRisk:    'Leadership has a general vision but struggles to communicate priorities or align the team around them.',
      developing:'Leadership direction is partially defined with emerging alignment, though gaps remain in communication.',
      strong:    'Leadership demonstrates clear strategic vision with effective communication across most levels.',
      optimized: 'Leadership operates with full strategic clarity — vision, priorities, and adaptability are embedded in culture.'
    },
    actions: {
      critical:  ['Conduct an emergency leadership alignment session to define the top 3 organizational priorities',
                   'Draft a one-page mission clarity statement and circulate to all team leads within 48 hours'],
      moderate:  ['Schedule weekly 15-minute leadership sync meetings to align on priorities',
                   'Create a decision-making framework document to reduce ambiguity'],
      growth:    ['Implement quarterly strategic reviews with cross-functional input',
                   'Develop a leadership communication cadence (weekly updates, monthly town halls)']
    }
  },
  {
    key: 'OperationalStability',
    label: 'Operational Stability & Workflow',
    questions: [5, 6, 7, 8],
    weight: 0.25,
    descriptors: {
      critical:  'Core processes are ad hoc and inconsistent, leading to frequent errors, rework, and unpredictable outcomes.',
      atRisk:    'Some processes exist but lack standardization — performance tracking is minimal or reactive.',
      developing:'Operational processes are partially documented with inconsistent execution across teams.',
      strong:    'Operations are well-structured with clear workflows, metrics, and cross-team collaboration.',
      optimized: 'Operational systems are fully standardized, measured, and continuously improved — disruption-resilient.'
    },
    actions: {
      critical:  ['Map your top 3 revenue-generating workflows end-to-end — identify every handoff point and bottleneck',
                   'Assign a single process owner for each critical workflow with accountability for documentation'],
      moderate:  ['Implement a simple KPI dashboard tracking 3-5 operational metrics weekly',
                   'Standardize your most repeated process with a documented SOP by end of week'],
      growth:    ['Conduct a quarterly process efficiency audit across all departments',
                   'Implement cross-training to reduce single-point-of-failure risks']
    }
  },
  {
    key: 'CognitiveDiversity',
    label: 'Workforce & Financial Health',
    questions: [9, 10, 11, 12],
    weight: 0.20,
    descriptors: {
      critical:  'The organization faces compounding workforce and financial pressures — talent retention is low and revenue concentration is dangerously high.',
      atRisk:    'Workforce development is reactive and financial sustainability depends heavily on a narrow revenue base.',
      developing:'Talent investment is emerging and the financial model shows stability, but diversification and development are inconsistent.',
      strong:    'The organization invests meaningfully in people and maintains a sustainable, moderately diversified financial position.',
      optimized: 'Workforce development is a strategic priority with clear growth paths, and financial health is robust with diversified revenue streams.'
    },
    actions: {
      critical:  ['Conduct stay interviews with your top 3 performers this week — identify what keeps them and what threatens retention',
                   'List all revenue streams and calculate concentration risk — if one source exceeds 60%, begin diversification planning immediately'],
      moderate:  ['Create a 90-day professional development plan for each team member',
                   'Identify and pursue one new revenue stream or service line this quarter'],
      growth:    ['Implement a quarterly employee engagement pulse survey',
                   'Build a 12-month financial scenario model testing revenue diversification impact']
    }
  },
  {
    key: 'TechAI',
    label: 'Technology & AI Integration',
    questions: [13, 14, 15, 16],
    weight: 0.15,
    descriptors: {
      critical:  'Technology adoption is minimal — the organization relies on manual processes and has no AI awareness or strategy.',
      atRisk:    'Basic technology tools are in place but underutilized. AI is acknowledged but not understood or explored.',
      developing:'Technology is moderately integrated into workflows. The team has some AI awareness but lacks a clear adoption path.',
      strong:    'Technology is well-integrated across core functions. AI opportunities are identified with initial implementation underway.',
      optimized: 'Technology and AI are strategic differentiators — fully embedded, continuously evaluated, and driving measurable efficiency gains.'
    },
    actions: {
      critical:  ['Audit your current tech stack — list every tool, its purpose, adoption rate, and monthly cost',
                   'Identify 3 manual processes that could be automated with existing tools (no new purchases required)'],
      moderate:  ['Schedule a team AI literacy session — focus on practical use cases relevant to your industry',
                   'Pilot one AI-powered tool (scheduling, customer service, or data analysis) within 14 days'],
      growth:    ['Develop a 6-month technology roadmap with quarterly investment milestones',
                   'Assign a technology champion to evaluate emerging tools and report monthly']
    }
  },
  {
    key: 'Momentum',
    label: 'Leadership Momentum & Adaptability',
    questions: [17, 18, 19, 20],
    weight: 0.15,
    descriptors: {
      critical:  'Leadership lacks adaptability and accountability — the organization struggles to respond to challenges and rarely tracks progress on goals.',
      atRisk:    'Leaders are inconsistent in modeling improvement behaviors. Goal tracking is sporadic and team motivation is uneven.',
      developing:'Leadership shows emerging adaptability with some accountability structures in place, though consistency across the team remains a challenge.',
      strong:    'Leaders actively model adaptability and accountability. Progress is tracked consistently and the team demonstrates meaningful alignment.',
      optimized: 'Leadership sets the standard for continuous improvement — adaptability, accountability, and goal transparency are embedded in daily operations.'
    },
    actions: {
      critical:  ['Hold an emergency leadership accountability session — define 3 specific, measurable commitments leaders will model this week',
                  'Implement a daily or weekly team progress check-in to establish rhythm and visibility around goals'],
      moderate:  ['Create a simple leadership scorecard tracking adaptability, follow-through, and team alignment monthly',
                  'Assign one "momentum owner" per team to track and report weekly progress toward key outcomes'],
      growth:    ['Implement a quarterly leadership retrospective — what worked, what slowed us down, what changes next quarter',
                  'Develop a team motivation and alignment dashboard visible to all staff, updated weekly']
    }
  }
];

// ─── SCORE TIERS ─────────────────────────────────────────────────────
const TIERS = [
  { min: 0,  max: 39,  label: 'Critical',   desc: 'Immediate intervention required' },
  { min: 40, max: 59,  label: 'At Risk',    desc: 'Significant gaps in multiple areas' },
  { min: 60, max: 74,  label: 'Developing', desc: 'Foundation present but inconsistent' },
  { min: 75, max: 89,  label: 'Strong',     desc: 'Well-positioned with targeted improvements' },
  { min: 90, max: 100, label: 'Optimized',  desc: 'Future-ready across all domains' }
];

function getTier(score) {
  return TIERS.find(t => score >= t.min && score <= t.max) || TIERS[0];
}

function getTierKey(score) {
  if (score <= 39) return 'critical';
  if (score <= 59) return 'atRisk';
  if (score <= 74) return 'developing';
  if (score <= 89) return 'strong';
  return 'optimized';
}

// ─── INDUSTRY PROFILES ───────────────────────────────────────────────
const INDUSTRY_PROFILES = {
  'default':      { label: 'General Business', challenges: 'market competition, operational efficiency, and talent retention', aiOpportunities: 'workflow automation, customer analytics, and predictive scheduling', benchmarkContext: 'organizations in similar stages of growth' },
  'hvac':         { label: 'HVAC / Plumbing / Electrical', challenges: 'seasonal demand fluctuations, skilled labor shortages, and customer acquisition costs', aiOpportunities: 'predictive maintenance scheduling, automated dispatch routing, smart inventory management, and AI-powered customer communication', benchmarkContext: 'trades and field service organizations' },
  'healthcare':   { label: 'Healthcare', challenges: 'regulatory compliance, staff burnout, patient experience expectations, and technology integration', aiOpportunities: 'patient intake automation, appointment scheduling optimization, clinical documentation assistance, and predictive staffing models', benchmarkContext: 'healthcare and wellness organizations' },
  'retail':       { label: 'Retail / E-Commerce', challenges: 'inventory management, omnichannel customer experience, competitive pricing pressure, and supply chain volatility', aiOpportunities: 'demand forecasting, personalized marketing automation, dynamic pricing, and chatbot customer service', benchmarkContext: 'retail and e-commerce businesses' },
  'professional': { label: 'Professional Services', challenges: 'client retention, project scope management, utilization rates, and knowledge management', aiOpportunities: 'proposal automation, time tracking optimization, client sentiment analysis, and knowledge base management', benchmarkContext: 'professional services firms' },
  'construction': { label: 'Construction', challenges: 'project cost overruns, safety compliance, subcontractor coordination, and material cost volatility', aiOpportunities: 'project scheduling optimization, safety monitoring, cost estimation automation, and drone-based site inspection', benchmarkContext: 'construction and trades businesses' },
  'manufacturing':{ label: 'Manufacturing', challenges: 'supply chain disruption, quality control consistency, equipment downtime, and workforce training', aiOpportunities: 'predictive maintenance, quality inspection automation, supply chain optimization, and production scheduling', benchmarkContext: 'manufacturing and production companies' },
  'food':         { label: 'Food & Beverage', challenges: 'food safety compliance, labor costs, inventory waste, and customer taste trends', aiOpportunities: 'inventory optimization, demand forecasting, automated ordering, and customer preference analytics', benchmarkContext: 'food and beverage industry peers' },
  'technology':   { label: 'Technology', challenges: 'rapid market evolution, talent competition, product-market fit, and scaling operations', aiOpportunities: 'automated testing, user behavior analytics, intelligent feature prioritization, and AI-augmented development', benchmarkContext: 'technology companies at similar scale' },
  'nonprofit':    { label: 'Nonprofit / Volunteer Organization', challenges: 'funding sustainability, volunteer retention, impact measurement, and operational efficiency with limited resources', aiOpportunities: 'donor analytics and segmentation, grant writing assistance, volunteer scheduling optimization, and impact reporting automation', benchmarkContext: 'nonprofit and mission-driven organizations' },
  'education':    { label: 'Education', challenges: 'student engagement, curriculum relevance, administrative burden, and technology integration', aiOpportunities: 'adaptive learning platforms, automated grading, enrollment prediction, and personalized student communication', benchmarkContext: 'educational institutions and training organizations' }
};

function matchIndustry(input) {
  if (!input) return INDUSTRY_PROFILES['default'];
  const lower = input.toLowerCase();
  if (lower.includes('hvac') || lower.includes('plumb') || lower.includes('electri') || lower.includes('trades')) return INDUSTRY_PROFILES['hvac'];
  if (lower.includes('health') || lower.includes('medical') || lower.includes('dental') || lower.includes('clinic')) return INDUSTRY_PROFILES['healthcare'];
  if (lower.includes('retail') || lower.includes('ecommerce') || lower.includes('e-commerce') || lower.includes('shop') || lower.includes('veteran')) return INDUSTRY_PROFILES['retail'];
  if (lower.includes('professional') || lower.includes('consult') || lower.includes('legal') || lower.includes('law') || lower.includes('account') || lower.includes('engineer') || lower.includes('architect')) return INDUSTRY_PROFILES['professional'];
  if (lower.includes('construct') || lower.includes('build') || lower.includes('contracting')) return INDUSTRY_PROFILES['construction'];
  if (lower.includes('manufactur') || lower.includes('production') || lower.includes('factory') || lower.includes('logistics')) return INDUSTRY_PROFILES['manufacturing'];
  if (lower.includes('food') || lower.includes('beverage') || lower.includes('restaurant') || lower.includes('catering')) return INDUSTRY_PROFILES['food'];
  if (lower.includes('tech') || lower.includes('software') || lower.includes('saas') || lower.includes('digital')) return INDUSTRY_PROFILES['technology'];
  if (lower.includes('nonprofit') || lower.includes('non-profit') || lower.includes('volunteer') || lower.includes('charity') || lower.includes('foundation')) return INDUSTRY_PROFILES['nonprofit'];
  if (lower.includes('education') || lower.includes('school') || lower.includes('training') || lower.includes('university')) return INDUSTRY_PROFILES['education'];
  return INDUSTRY_PROFILES['default'];
}


// ═════════════════════════════════════════════════════════════════
// INPUT PARSER — v1.1.0 (hardened)
// ═════════════════════════════════════════════════════════════════

function parseInput(body) {
  const warnings = [];

  // ── Contact fields ──────────────────────────────────────────────
  // Bug #4 FIX: removed body[''] phantom key
  const client = {
    name:     body.name     || body.data_name    || 'Organization',
    email:    body.email    || body.data_email   || '',
    company:  body.company  || body.data_company || '',
    title:    body.title    || body.data_title   || '',
    phone:    body.phone    || body.data_phone   || '',
    industry: body.industry || body.IndustrySelection || body.industrySelection || body.data_industry || '',
    debrief:  body.debrief  || body.DebriefSelection  || body.debriefSelection  || ''
  };

  client.displayName = client.company || client.name || 'the organization';

  // ── Question scores Q1-Q20 ──────────────────────────────────────
  // Bug #5 FIX: warnings emitted when fields are missing/defaulted
  const questions = {};
  for (let i = 1; i <= 20; i++) {
    let val = body[`q${i}`] || body[`Q${i}`] || body[`data_q${i}`];
    if (val === undefined || val === null || val === '') {
      // Zapier Catch Hook positional fallback (kept for legacy compatibility)
      val = body[`_${i + 4}`];
    }
    let num = parseInt(val, 10);
    if (isNaN(num) || num < 1) {
      // Bug #5 FIX: emit warning instead of silent default
      if (val !== undefined && val !== null && val !== '') {
        warnings.push(`Q${i}: unrecognized value "${val}" — defaulted to 1`);
      } else {
        warnings.push(`Q${i}: field missing or empty — defaulted to 1`);
      }
      num = 1;
    }
    if (num > 5) num = 5;
    questions[i] = num;
  }

  return { client, questions, warnings };
}


// ═════════════════════════════════════════════════════════════════
// SCORING ENGINE
// ═════════════════════════════════════════════════════════════════

function calculateDomainScores(questions) {
  const scores = {};
  for (const domain of DOMAINS) {
    const qScores = domain.questions.map(q => questions[q] || 1);
    const sum = qScores.reduce((a, b) => a + b, 0);
    const maxPossible = domain.questions.length * 5;
    scores[domain.key] = Math.round((sum / maxPossible) * 100);
  }
  return scores;
}

function calculateFRS(domainScores) {
  let weightedSum = 0;
  for (const domain of DOMAINS) {
    weightedSum += (domainScores[domain.key] || 0) * domain.weight;
  }
  return Math.round(weightedSum);
}

function calculateISS(domainScores, frs) {
  const scores = Object.values(domainScores);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance);
  const consistencyScore = Math.max(0, Math.round(100 - (stdDev * 2)));
  let iss = Math.round(mean * 0.6 + consistencyScore * 0.4);
  iss = Math.min(100, Math.max(0, iss));
  // Bug #7 FIX: cap ISS when FRS is Critical to prevent misleading "stable" narrative
  if (frs < 40) iss = Math.min(iss, frs + 15);
  return iss;
}

function identifyStrengthsAndBottlenecks(domainScores) {
  const sorted = DOMAINS.map(d => ({
    key: d.key,
    label: d.label,
    score: domainScores[d.key]
  })).sort((a, b) => b.score - a.score);

  return {
    strengths: sorted.slice(0, 3),
    bottlenecks: sorted.slice(-3).reverse()
  };
}


// ═════════════════════════════════════════════════════════════════
// NARRATIVE ENGINE
// ═════════════════════════════════════════════════════════════════

function generateExecutiveSummary(data) {
  const { client, domainScores, frs, iss, strengths, bottlenecks, industryProfile } = data;
  const name = client.displayName;

  let opening;
  if (frs >= 90)      opening = `${name} achieved a Future-Ready Score of ${frs}/100, placing the organization in the Optimized tier. This is an exceptional result, indicating mature systems, clear leadership, and strategic positioning across all domains.`;
  else if (frs >= 75) opening = `${name} achieved a Future-Ready Score of ${frs}/100, placing the organization in the Strong tier. The organization demonstrates well-developed capabilities with targeted areas for continued growth and refinement.`;
  else if (frs >= 60) opening = `${name} achieved a Future-Ready Score of ${frs}/100, placing the organization in the Developing tier. A foundation is present across key areas, but inconsistencies between domains are limiting overall performance and growth potential.`;
  else if (frs >= 40) opening = `${name} achieved a Future-Ready Score of ${frs}/100, placing the organization in the At Risk tier. Significant gaps exist across multiple domains that require focused attention to prevent further deterioration and unlock growth.`;
  else                opening = `${name} achieved a Future-Ready Score of ${frs}/100, placing the organization in the Critical tier. The organization requires immediate, concentrated intervention across foundational areas to stabilize operations and establish a path forward.`;

  const s1 = strengths[0], b1 = bottlenecks[0];
  const spread = s1.score - bottlenecks[bottlenecks.length - 1].score;

  let middle = `\n\nThe organization's primary strength lies in ${s1.label} (${s1.score}/100)`;
  if (strengths[1]) middle += `, supported by ${strengths[1].label} (${strengths[1].score}/100)`;
  middle += `. These areas provide a competitive foundation to build upon.`;
  middle += `\n\nHowever, ${b1.label} (${b1.score}/100) represents the most pressing concern`;
  if (bottlenecks[1] && bottlenecks[1].score < 60) middle += `, closely followed by ${bottlenecks[1].label} (${bottlenecks[1].score}/100)`;
  middle += `. Without targeted intervention in these areas, the organization faces increasing vulnerability.`;
  if (spread > 40) middle += ` The ${spread}-point gap between the highest and lowest domain scores reveals significant organizational imbalance that must be addressed.`;
  middle += `\n\nIndustry Context: As a ${industryProfile.label} organization, common challenges include ${industryProfile.challenges}. The scores observed align with patterns typical of ${industryProfile.benchmarkContext}.`;

  const issNote = iss >= 70
    ? `The Industry Stability Score of ${iss}/100 reflects reasonable organizational consistency.`
    : `The Industry Stability Score of ${iss}/100 indicates notable variance between domains, suggesting uneven development that should be addressed systematically.`;
  const closing = `\n\n${issNote} The 7-Day Fix-First Roadmap attached to this report provides immediate, actionable steps designed to address the most critical gaps — high-impact actions that can be executed this week without outside help.`;

  return opening + middle + closing;
}

function generateDomainBreakdown(data) {
  const { domainScores } = data;
  let output = '';
  for (const domain of DOMAINS) {
    const score = domainScores[domain.key];
    const tier = getTier(score);
    const tierKey = getTierKey(score);
    output += `■ ${domain.label}: ${score}/100 (${tier.label})\n`;
    output += `${domain.descriptors[tierKey]}\n\n`;
  }
  return output.trim();
}

function generateIndustryInsights(data) {
  const { client, domainScores, frs, industryProfile } = data;
  const techScore = domainScores.TechAI;
  const opsScore = domainScores.OperationalStability;
  const name = client.displayName;

  let insights = `Industry: ${industryProfile.label}\n\n`;
  insights += `For ${industryProfile.label} organizations, the key challenges typically center on ${industryProfile.challenges}. ${name}'s current profile reflects these dynamics`;

  if      (opsScore < 60 && techScore < 60) insights += `, with both operational and technology scores suggesting the organization has not yet built the infrastructure needed to scale sustainably.`;
  else if (opsScore >= 60 && techScore < 60) insights += `, with solid operational foundations in place but a significant technology gap that could limit future competitiveness.`;
  else if (opsScore < 60 && techScore >= 60) insights += `, with technology adoption outpacing operational standardization — a common but correctable imbalance.`;
  else insights += `, with operational and technology foundations that position the organization well relative to industry peers.`;

  insights += `\n\nAI & Technology Opportunities for ${industryProfile.label}: ${industryProfile.aiOpportunities}.`;
  insights += `\n\nBenchmark Context: Compared to ${industryProfile.benchmarkContext}, `;
  if (frs >= 75)      insights += `${name} is performing above average and should focus on maintaining momentum while pursuing advanced optimization.`;
  else if (frs >= 60) insights += `${name} is positioned at the median range. Targeted improvements in the weakest domains could move the organization into the top quartile within 90 days.`;
  else                insights += `${name} has significant room for improvement. The roadmap prioritizes foundational fixes that will create the most immediate impact.`;

  return insights;
}

function generateAIReadiness(data) {
  const { domainScores, industryProfile, client } = data;
  const techScore = domainScores.TechAI;
  const tier = getTier(techScore);
  const name = client.displayName;

  let summary = `AI Readiness Score: ${techScore}/100 (${tier.label})\n\n`;

  if (techScore >= 75) {
    summary += `${name} demonstrates strong technology foundations with active AI awareness. The organization is well-positioned to accelerate AI integration as a strategic differentiator.\n\n`;
    summary += `Recommended Next Steps:\n• Formalize an AI integration roadmap with quarterly milestones and ROI targets\n• Identify the top 3 processes where AI could deliver 20%+ efficiency gains\n• Designate an internal AI champion to lead evaluation and adoption efforts`;
  } else if (techScore >= 60) {
    summary += `${name} has a developing technology foundation with emerging AI awareness. The organization understands the potential but has not yet moved to active implementation.\n\n`;
    summary += `Recommended Next Steps:\n• Conduct a team AI literacy workshop focused on practical, industry-specific use cases\n• Pilot one AI tool in a low-risk area (scheduling, email drafting, or data analysis)\n• Audit current tech utilization — many organizations use less than 40% of their existing tool capabilities`;
  } else if (techScore >= 40) {
    summary += `${name} shows limited technology adoption with minimal AI readiness. The organization relies heavily on manual processes and risks falling behind more tech-forward competitors.\n\n`;
    summary += `Recommended Next Steps:\n• Complete a full technology audit: list every tool, its cost, adoption rate, and business impact\n• Identify 3 manual tasks that consume the most staff hours — these are your automation priorities\n• Schedule one introductory AI session for leadership to demystify the technology`;
  } else {
    summary += `${name} has critical gaps in technology adoption with no meaningful AI readiness. The organization operates primarily through manual processes.\n\n`;
    summary += `Recommended Next Steps:\n• Prioritize basic technology infrastructure before AI — email systems, cloud storage, and a central communication tool\n• Automate one high-frequency task this week using a free tool (Google Workspace, Trello, or Zapier free tier)\n• Build technology comfort gradually — small wins create momentum for larger adoption`;
  }

  summary += `\n\nIndustry AI Landscape: In the ${industryProfile.label} sector, leading organizations are leveraging ${industryProfile.aiOpportunities}.`;
  return summary;
}

function generateRoadmap(data) {
  const { bottlenecks, domainScores } = data;

  const b1 = DOMAINS.find(d => d.key === bottlenecks[0].key);
  const b1Score = domainScores[b1.key];
  const b1Actions = b1.actions[b1Score < 40 ? 'critical' : (b1Score < 60 ? 'moderate' : 'growth')];
  let day1_3 = `PRIORITY: ${b1.label} (${b1Score}/100)\nObjective: Stabilize the most critical domain with immediate, high-impact actions.\n\n`;
  b1Actions.forEach((a, i) => { day1_3 += `Action ${i+1}: ${a}\n`; });
  day1_3 += `\nExpected Outcome: Establish a clear baseline and initiate measurable improvement in ${b1.label.toLowerCase()}.`;

  const b2 = DOMAINS.find(d => d.key === bottlenecks[1].key);
  const b2Score = domainScores[b2.key];
  const b2Actions = b2.actions[b2Score < 40 ? 'critical' : (b2Score < 60 ? 'moderate' : 'growth')];
  let day4_5 = `PRIORITY: ${b2.label} (${b2Score}/100)\nObjective: Address the second-priority domain with targeted process improvements.\n\n`;
  b2Actions.forEach((a, i) => { day4_5 += `Action ${i+1}: ${a}\n`; });
  day4_5 += `\nExpected Outcome: Create structural improvements that reduce risk and build operational capacity.`;

  let day6_7 = `PRIORITY: Measurement & Forward Planning\nObjective: Assess initial progress, capture quick wins, and establish accountability for sustained improvement.\n\n`;
  day6_7 += `Action 1: Review progress on Days 1-5 actions — document what was completed, what's in progress, and what needs adjustment.\n`;
  day6_7 += `Action 2: Identify and celebrate 2-3 quick wins from the week — communicate these to the full team to build momentum.\n`;
  day6_7 += `Action 3: Assign owners and deadlines for any incomplete items — carry them into the 30-Day Strategic Roadmap.\n`;
  if (bottlenecks[2] && domainScores[bottlenecks[2].key] < 60) {
    const b3 = DOMAINS.find(d => d.key === bottlenecks[2].key);
    day6_7 += `Action 4: Begin preliminary assessment of ${b3.label} (${domainScores[b3.key]}/100) — the next priority domain for the 30-Day Roadmap.\n`;
  }
  day6_7 += `\nExpected Outcome: A clear picture of initial progress, team alignment, and a defined path into the 30-Day Strategic Roadmap.`;

  return { day1_3, day4_5, day6_7 };
}

function generate30DayPlan(data) {
  const { bottlenecks, strengths, domainScores, client, frs, industryProfile } = data;
  const name = client.displayName;

  let plan = `30-DAY STRATEGIC ROADMAP FOR ${name.toUpperCase()}\n`;
  plan += `Starting Future-Ready Score: ${frs}/100 | Target: ${Math.min(100, frs + 15)}/100\n\n`;
  plan += `WEEK 1 — STABILIZATION & QUICK WINS\nContinue executing the 7-Day Fix-First Roadmap. Focus on completing all assigned actions from Days 1-7. Key deliverables: documented process maps for critical workflows, initial KPI tracking established, and team communication on priorities completed.\n\n`;
  plan += `WEEK 2 — STRUCTURAL IMPROVEMENTS\n• Deepen ${bottlenecks[0].label} improvements: move from emergency fixes to systematic change.\n• Begin ${bottlenecks[1].label} transformation.\n• Conduct a mid-month check: are the actions producing measurable results?\n\n`;
  plan += `WEEK 3 — EXPANSION & INTEGRATION\n• Leverage strength in ${strengths[0].label} (${strengths[0].score}/100): use your strongest domain as a platform to elevate weaker areas.\n• Technology integration check: identify one workflow that can be digitized or automated this week.\n• Explore industry-specific opportunities: ${industryProfile.aiOpportunities}.\n\n`;
  plan += `WEEK 4 — MEASUREMENT & FORWARD PLANNING\n• Conduct a mini re-assessment: score each domain qualitatively.\n• Document all changes made during the 30-day period — create an internal change log.\n• Schedule a full Future-Ready Re-Assessment for the 90-day mark.\n• Prioritize 2-3 strategic initiatives for the next quarter.\n\n`;
  plan += `TARGET OUTCOME: Move from ${getTier(frs).label} to ${getTier(Math.min(100, frs + 15)).label} tier within 90 days through consistent execution of these priorities.`;

  return plan;
}

function generateMomentumCommentary(data) {
  const { domainScores, strengths, bottlenecks, frs, iss, industryProfile, client } = data;
  const name = client.displayName;
  const momentumScore = domainScores.Momentum;
  const leadershipScore = domainScores.Leadership;

  let commentary = `FACILITATOR MOMENTUM ANALYSIS — ${name}\n\n`;

  if      (frs >= 75) commentary += `Trajectory: POSITIVE. ${name} has the foundation for sustained growth. The facilitator's role is optimization and acceleration.\n\n`;
  else if (frs >= 60) commentary += `Trajectory: CAUTIOUSLY POSITIVE. ${name} has building blocks in place but lacks consistency. The facilitator's role is to create connective tissue between stronger and weaker domains.\n\n`;
  else if (frs >= 40) commentary += `Trajectory: AT RISK. ${name} requires sustained intervention. Focus on stabilization first, then incremental improvement.\n\n`;
  else                commentary += `Trajectory: CRITICAL. ${name} needs intensive support. Operate in triage mode — focus exclusively on the highest-impact, lowest-complexity actions.\n\n`;

  commentary += `Key Dynamic: `;
  if      (leadershipScore >= 70 && momentumScore < 50)  commentary += `Strong leadership with weak momentum suggests strategic clarity exists but is not translating into consistent execution.\n\n`;
  else if (leadershipScore < 50  && momentumScore >= 70) commentary += `Momentum without strong leadership alignment is unsustainable. Prioritize leadership clarity before the advantage erodes.\n\n`;
  else if (leadershipScore >= 70 && momentumScore >= 70) commentary += `The leadership-to-momentum pipeline is functioning well. Focus facilitation on operational and technological infrastructure.\n\n`;
  else                                                    commentary += `Both leadership and momentum need attention. Start with leadership clarity — without it, all other improvements lack direction.\n\n`;

  const scores = Object.values(domainScores);
  const spread = Math.max(...scores) - Math.min(...scores);
  commentary += `Domain Spread: ${spread} points. `;
  if      (spread > 40) commentary += `This wide spread indicates a "spiky" organization — address the valleys before amplifying the peaks.\n\n`;
  else if (spread > 20) commentary += `Moderate spread with room for harmonization. Transfer discipline from stronger domains into weaker ones.\n\n`;
  else                  commentary += `Tight spread suggests consistent organizational development. Focus on lifting all domains together.\n\n`;

  commentary += `Industry Note: ${industryProfile.label} organizations at the ${getTier(frs).label} level typically need 2-3 quarters of focused effort to move up one tier. Key accelerators include ${industryProfile.aiOpportunities}.`;

  return commentary;
}

function buildStrengthNarrative(domainInfo, score) {
  const domain = DOMAINS.find(d => d.key === domainInfo.key);
  return `${domain.label} (${score}/100): ${domain.descriptors[getTierKey(score)]}`;
}

function buildBottleneckNarrative(domainInfo, score) {
  const domain = DOMAINS.find(d => d.key === domainInfo.key);
  let narrative = `${domain.label} (${score}/100): ${domain.descriptors[getTierKey(score)]}`;
  if (score < 50) narrative += ` This domain is flagged as a critical bottleneck requiring immediate attention in the 7-Day Fix-First Roadmap.`;
  return narrative;
}


// ═════════════════════════════════════════════════════════════════
// API HANDLER — v1.1.0 (with x-api-key auth)
// ═════════════════════════════════════════════════════════════════

module.exports = async (req, res) => {
  // ── CORS headers ─────────────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.', AnalysisCompleted: 'No' });
  }

  // ── Bug #6 FIX: API key authentication ───────────────────────────
  // Only enforce if FRTS_API_KEY env var is set (safe for gradual rollout)
  const envKey = process.env.FRTS_API_KEY;
  if (envKey) {
    const providedKey = req.headers['x-api-key'];
    if (!providedKey || providedKey !== envKey) {
      return res.status(401).json({
        error: 'Unauthorized. Provide a valid x-api-key header.',
        AnalysisCompleted: 'No'
      });
    }
  }

  try {
    const { client, questions, warnings } = parseInput(req.body || {});
    const industryProfile = matchIndustry(client.industry);

    const domainScores = calculateDomainScores(questions);
    const frs = calculateFRS(domainScores);
    const iss = calculateISS(domainScores, frs);
    const { strengths, bottlenecks } = identifyStrengthsAndBottlenecks(domainScores);

    const analysisData = { client, domainScores, frs, iss, strengths, bottlenecks, industryProfile };

    const executiveSummary   = generateExecutiveSummary(analysisData);
    const domainBreakdown    = generateDomainBreakdown(analysisData);
    const industryInsights   = generateIndustryInsights(analysisData);
    const aiReadiness        = generateAIReadiness(analysisData);
    const roadmap            = generateRoadmap(analysisData);
    const plan30             = generate30DayPlan(analysisData);
    const momentumCommentary = generateMomentumCommentary(analysisData);

    const response = {
      // Status
      AnalysisCompleted: 'Yes',
      ApiVersion: '1.1.0',

      // Bug #5 FIX: validation warnings surface to caller
      ValidationWarnings: warnings.length > 0 ? warnings.join(' | ') : 'None',

      // Composite scores
      Tier:                   getTier(frs).label,
      FutureReadyScore:       frs,
      IndustryStabilityScore: iss,

      // Domain scores
      Domain_Leadership:           domainScores.Leadership,
      Domain_OperationalStability: domainScores.OperationalStability,
      Domain_CognitiveDiversity:   domainScores.CognitiveDiversity,
      Domain_TechAI:               domainScores.TechAI,
      Domain_Momentum:             domainScores.Momentum,

      // Module scores (mirrors for Zapier Tables compatibility)
      M1: domainScores.Leadership,
      M2: domainScores.OperationalStability,
      M3: domainScores.CognitiveDiversity,
      M4: domainScores.TechAI,
      M5: domainScores.Momentum,

      // Strengths
      Strength1: buildStrengthNarrative(strengths[0], strengths[0].score),
      Strength2: buildStrengthNarrative(strengths[1], strengths[1].score),
      Strength3: buildStrengthNarrative(strengths[2], strengths[2].score),

      // Bottlenecks
      Bottleneck1: buildBottleneckNarrative(bottlenecks[0], bottlenecks[0].score),
      Bottleneck2: buildBottleneckNarrative(bottlenecks[1], bottlenecks[1].score),
      Bottleneck3: buildBottleneckNarrative(bottlenecks[2], bottlenecks[2].score),

      // Narratives
      Narrative_ExecutiveSummary: executiveSummary,
      Narrative_DomainBreakdown:  domainBreakdown,
      IndustryInsights:           industryInsights,
      AIReadinessSummary:         aiReadiness,

      // 7-Day Roadmap
      Roadmap_Day1_3: roadmap.day1_3,
      Roadmap_Day4_5: roadmap.day4_5,
      Roadmap_Day6_7: roadmap.day6_7,

      // Facilitator Package
      Facilitator_30DayPlan:          plan30,
      Facilitator_MomentumCommentary: momentumCommentary,

      // Client metadata (for PDF generator consumption)
      Client_Name:        client.name,
      Client_Email:       client.email,
      Client_Company:     client.company,
      Client_Title:       client.title,
      Client_Phone:       client.phone,
      Client_Industry:    client.industry,
      Client_DisplayName: client.displayName,
      Client_Debrief:     client.debrief
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error('Analysis engine error:', error);
    return res.status(500).json({
      error: 'Analysis engine encountered an error. Please retry.',
      AnalysisCompleted: 'No',
      details: error.message
    });
  }
};
