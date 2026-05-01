// ═════════════════════════════════════════════════════════════════════
// FUTURE-READY TRANSFORMATION ANALYSIS ENGINE — v1.0
// SME Media Group, LLC | Clarksville, TN
// Endpoint: POST /api/futureready-analyze
//
// Receives client assessment data from Zapier webhook, calculates
// domain scores, generates narrative insights, builds roadmaps,
// and returns structured JSON for the full FRTA deliverable.
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
    label: 'Customer & Market Positioning',
    questions: [17, 18, 19, 20],
    weight: 0.15,
    descriptors: {
      critical:  'Market positioning is unclear — the organization lacks differentiation and customer retention is volatile.',
      atRisk:    'Some market awareness exists but competitive positioning is reactive and customer feedback loops are weak.',
      developing:'The organization understands its market position with emerging differentiation, but proactive market expansion is limited.',
      strong:    'Strong market positioning with clear differentiation, solid customer retention, and active pursuit of growth opportunities.',
      optimized: 'Market leadership with deep customer insight, strong brand differentiation, proactive expansion, and high retention rates.'
    },
    actions: {
      critical:  ['Survey your top 10 customers this week — ask what they value most and what nearly made them leave',
                   'Write a one-paragraph competitive differentiator and test it with 5 prospects'],
      moderate:  ['Map your customer journey from first contact to repeat purchase — identify the 3 biggest friction points',
                   'Analyze your top 3 competitors: pricing, positioning, and service gaps you can exploit'],
      growth:    ['Develop a formal customer retention program with measurable NPS targets',
                   'Create a market expansion playbook targeting one adjacent segment or geography']
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
  'default': {
    label: 'General Business',
    challenges: 'market competition, operational efficiency, and talent retention',
    aiOpportunities: 'workflow automation, customer analytics, and predictive scheduling',
    benchmarkContext: 'organizations in similar stages of growth'
  },
  'hvac': {
    label: 'HVAC / Plumbing / Electrical',
    challenges: 'seasonal demand fluctuations, skilled labor shortages, and customer acquisition costs',
    aiOpportunities: 'predictive maintenance scheduling, automated dispatch routing, smart inventory management, and AI-powered customer communication',
    benchmarkContext: 'trades and field service organizations'
  },
  'healthcare': {
    label: 'Healthcare',
    challenges: 'regulatory compliance, staff burnout, patient experience expectations, and technology integration',
    aiOpportunities: 'patient intake automation, appointment scheduling optimization, clinical documentation assistance, and predictive staffing models',
    benchmarkContext: 'healthcare and wellness organizations'
  },
  'retail': {
    label: 'Retail / E-Commerce',
    challenges: 'inventory management, omnichannel customer experience, competitive pricing pressure, and supply chain volatility',
    aiOpportunities: 'demand forecasting, personalized marketing automation, dynamic pricing, and chatbot customer service',
    benchmarkContext: 'retail and e-commerce businesses'
  },
  'professional': {
    label: 'Professional Services',
    challenges: 'client retention, project scope management, utilization rates, and knowledge management',
    aiOpportunities: 'proposal automation, time tracking optimization, client sentiment analysis, and knowledge base management',
    benchmarkContext: 'professional services firms'
  },
  'construction': {
    label: 'Construction',
    challenges: 'project cost overruns, safety compliance, subcontractor coordination, and material cost volatility',
    aiOpportunities: 'project scheduling optimization, safety monitoring, cost estimation automation, and drone-based site inspection',
    benchmarkContext: 'construction and trades businesses'
  },
  'manufacturing': {
    label: 'Manufacturing',
    challenges: 'supply chain disruption, quality control consistency, equipment downtime, and workforce training',
    aiOpportunities: 'predictive maintenance, quality inspection automation, supply chain optimization, and production scheduling',
    benchmarkContext: 'manufacturing and production companies'
  },
  'food': {
    label: 'Food & Beverage',
    challenges: 'food safety compliance, labor costs, inventory waste, and customer taste trends',
    aiOpportunities: 'inventory optimization, demand forecasting, automated ordering, and customer preference analytics',
    benchmarkContext: 'food and beverage industry peers'
  },
  'technology': {
    label: 'Technology',
    challenges: 'rapid market evolution, talent competition, product-market fit, and scaling operations',
    aiOpportunities: 'automated testing, user behavior analytics, intelligent feature prioritization, and AI-augmented development',
    benchmarkContext: 'technology companies at similar scale'
  },
  'nonprofit': {
    label: 'Nonprofit / Volunteer Organization',
    challenges: 'funding sustainability, volunteer retention, impact measurement, and operational efficiency with limited resources',
    aiOpportunities: 'donor analytics and segmentation, grant writing assistance, volunteer scheduling optimization, and impact reporting automation',
    benchmarkContext: 'nonprofit and mission-driven organizations'
  },
  'education': {
    label: 'Education',
    challenges: 'student engagement, curriculum relevance, administrative burden, and technology integration',
    aiOpportunities: 'adaptive learning platforms, automated grading, enrollment prediction, and personalized student communication',
    benchmarkContext: 'educational institutions and training organizations'
  }
};

function matchIndustry(input) {
  if (!input) return INDUSTRY_PROFILES['default'];
  const lower = input.toLowerCase();
  if (lower.includes('hvac') || lower.includes('plumb') || lower.includes('electri')) return INDUSTRY_PROFILES['hvac'];
  if (lower.includes('health') || lower.includes('medical') || lower.includes('clinic')) return INDUSTRY_PROFILES['healthcare'];
  if (lower.includes('retail') || lower.includes('ecommerce') || lower.includes('e-commerce') || lower.includes('shop')) return INDUSTRY_PROFILES['retail'];
  if (lower.includes('professional') || lower.includes('consult') || lower.includes('legal') || lower.includes('accounting')) return INDUSTRY_PROFILES['professional'];
  if (lower.includes('construct') || lower.includes('build') || lower.includes('contracting')) return INDUSTRY_PROFILES['construction'];
  if (lower.includes('manufactur') || lower.includes('production') || lower.includes('factory')) return INDUSTRY_PROFILES['manufacturing'];
  if (lower.includes('food') || lower.includes('beverage') || lower.includes('restaurant') || lower.includes('catering')) return INDUSTRY_PROFILES['food'];
  if (lower.includes('tech') || lower.includes('software') || lower.includes('saas') || lower.includes('digital')) return INDUSTRY_PROFILES['technology'];
  if (lower.includes('nonprofit') || lower.includes('non-profit') || lower.includes('volunteer') || lower.includes('charity') || lower.includes('foundation')) return INDUSTRY_PROFILES['nonprofit'];
  if (lower.includes('education') || lower.includes('school') || lower.includes('training') || lower.includes('university')) return INDUSTRY_PROFILES['education'];
  return INDUSTRY_PROFILES['default'];
}


// ═════════════════════════════════════════════════════════════════
// INPUT PARSER — Normalizes Zapier webhook data into clean format
// ═════════════════════════════════════════════════════════════════

function parseInput(body) {
  // Extract client info — support both clean names and Zapier positional keys
  const client = {
    name:     body.name     || body['']    || body.data_name    || 'Organization',
    email:    body.email    || body['_1']  || body.data_email   || '',
    company:  body.company  || body['_2']  || body.data_company || '',
    title:    body.title    || body['_3']  || body.data_title   || '',
    phone:    body.phone    || body['_4']  || body.data_phone   || '',
    industry: body.industry || body.IndustrySelection || body.industrySelection || body['_30'] || body.data_industry || '',
    debrief:  body.debrief  || body.DebriefSelection  || body.debriefSelection  || body['_31'] || ''
  };

  // Use company name if available, else fall back to client name
  client.displayName = client.company || client.name || 'the organization';

  // Extract question scores Q1-Q20
  // Support: q1/Q1, _5 through _24 (Zapier positional), or data_q1
  const questions = {};
  for (let i = 1; i <= 20; i++) {
    let val = body[`q${i}`] || body[`Q${i}`] || body[`data_q${i}`];
    // Zapier positional: questions start at _5 (after name/email/company/title/phone)
    if (val === undefined || val === null || val === '') {
      val = body[`_${i + 4}`];
    }
    // Parse and clamp to 1-5
    let num = parseInt(val, 10);
    if (isNaN(num) || num < 1) num = 1;
    if (num > 5) num = 5;
    questions[i] = num;
  }

  return { client, questions };
}


// ═════════════════════════════════════════════════════════════════
// SCORING ENGINE — Deterministic score calculation
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

function calculateISS(domainScores, industry) {
  // ISS combines domain consistency (low variance = high stability)
  // with a baseline industry resilience factor
  const scores = Object.values(domainScores);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance);

  // Consistency score: lower std dev = higher consistency (max 100)
  const consistencyScore = Math.max(0, Math.round(100 - (stdDev * 2)));

  // Blend: 60% overall performance (mean) + 40% consistency
  const iss = Math.round(mean * 0.6 + consistencyScore * 0.4);
  return Math.min(100, Math.max(0, iss));
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
// NARRATIVE ENGINE — Template-based consulting-grade content
// ═════════════════════════════════════════════════════════════════

function generateExecutiveSummary(data) {
  const { client, domainScores, frs, iss, strengths, bottlenecks, industryProfile } = data;
  const tier = getTier(frs);
  const name = client.displayName;

  let opening, middle, closing;

  // Opening — score context
  if (frs >= 90) {
    opening = `${name} achieved a Future-Ready Score of ${frs}/100, placing the organization in the Optimized tier. This is an exceptional result, indicating mature systems, clear leadership, and strategic positioning across all domains.`;
  } else if (frs >= 75) {
    opening = `${name} achieved a Future-Ready Score of ${frs}/100, placing the organization in the Strong tier. The organization demonstrates well-developed capabilities with targeted areas for continued growth and refinement.`;
  } else if (frs >= 60) {
    opening = `${name} achieved a Future-Ready Score of ${frs}/100, placing the organization in the Developing tier. A foundation is present across key areas, but inconsistencies between domains are limiting overall performance and growth potential.`;
  } else if (frs >= 40) {
    opening = `${name} achieved a Future-Ready Score of ${frs}/100, placing the organization in the At Risk tier. Significant gaps exist across multiple domains that require focused attention to prevent further deterioration and unlock growth.`;
  } else {
    opening = `${name} achieved a Future-Ready Score of ${frs}/100, placing the organization in the Critical tier. The organization requires immediate, concentrated intervention across foundational areas to stabilize operations and establish a path forward.`;
  }

  // Middle — strengths and bottlenecks
  const s1 = strengths[0], b1 = bottlenecks[0];
  const spread = s1.score - bottlenecks[bottlenecks.length - 1].score;

  middle = `\n\nThe organization's primary strength lies in ${s1.label} (${s1.score}/100)`;
  if (strengths[1]) middle += `, supported by ${strengths[1].label} (${strengths[1].score}/100)`;
  middle += `. These areas provide a competitive foundation to build upon.`;

  middle += `\n\nHowever, ${b1.label} (${b1.score}/100) represents the most pressing concern`;
  if (bottlenecks[1] && bottlenecks[1].score < 60) {
    middle += `, closely followed by ${bottlenecks[1].label} (${bottlenecks[1].score}/100)`;
  }
  middle += `. Without targeted intervention in these areas, the organization faces increasing vulnerability.`;

  if (spread > 40) {
    middle += ` The ${spread}-point gap between the highest and lowest domain scores reveals significant organizational imbalance that must be addressed.`;
  }

  // Industry context
  middle += `\n\nIndustry Context: As a ${industryProfile.label} organization, common challenges include ${industryProfile.challenges}. The scores observed align with patterns typical of ${industryProfile.benchmarkContext}.`;

  // Closing
  const issNote = iss >= 70
    ? `The Industry Stability Score of ${iss}/100 reflects reasonable organizational consistency.`
    : `The Industry Stability Score of ${iss}/100 indicates notable variance between domains, suggesting uneven development that should be addressed systematically.`;

  closing = `\n\n${issNote} The 7-Day Fix-First Roadmap attached to this report provides immediate, actionable steps designed to address the most critical gaps — high impact actions that can be executed this week without outside help.`;

  return opening + middle + closing;
}

function generateDomainBreakdown(data) {
  const { domainScores } = data;
  let output = '';

  for (const domain of DOMAINS) {
    const score = domainScores[domain.key];
    const tier = getTier(score);
    const tierKey = getTierKey(score);
    const descriptor = domain.descriptors[tierKey];

    output += `■ ${domain.label}: ${score}/100 (${tier.label})\n`;
    output += `${descriptor}\n\n`;
  }

  return output.trim();
}

function generateIndustryInsights(data) {
  const { client, domainScores, frs, industryProfile } = data;
  const techScore = domainScores.TechAI;
  const opsScore = domainScores.OperationalStability;
  const name = client.displayName;

  let insights = `Industry: ${industryProfile.label}\n\n`;

  insights += `For ${industryProfile.label} organizations, the key challenges typically center on ${industryProfile.challenges}. `;
  insights += `${name}'s current profile reflects these dynamics`;

  // Industry-specific scoring commentary
  if (opsScore < 60 && techScore < 60) {
    insights += `, with both operational and technology scores suggesting the organization has not yet built the infrastructure needed to scale sustainably.`;
  } else if (opsScore >= 60 && techScore < 60) {
    insights += `, with solid operational foundations in place but a significant technology gap that could limit future competitiveness.`;
  } else if (opsScore < 60 && techScore >= 60) {
    insights += `, with technology adoption outpacing operational standardization — a common but correctable imbalance.`;
  } else {
    insights += `, with operational and technology foundations that position the organization well relative to industry peers.`;
  }

  insights += `\n\nAI & Technology Opportunities for ${industryProfile.label}: ${industryProfile.aiOpportunities}.`;

  insights += `\n\nBenchmark Context: Compared to ${industryProfile.benchmarkContext}, `;
  if (frs >= 75) {
    insights += `${name} is performing above average and should focus on maintaining momentum while pursuing advanced optimization.`;
  } else if (frs >= 60) {
    insights += `${name} is positioned at the median range. Targeted improvements in the weakest domains could move the organization into the top quartile within 90 days.`;
  } else {
    insights += `${name} has significant room for improvement. The roadmap prioritizes foundational fixes that will create the most immediate impact.`;
  }

  return insights;
}

function generateAIReadiness(data) {
  const { domainScores, industryProfile, client } = data;
  const techScore = domainScores.TechAI;
  const tier = getTier(techScore);
  const tierKey = getTierKey(techScore);
  const name = client.displayName;

  let summary = `AI Readiness Score: ${techScore}/100 (${tier.label})\n\n`;

  if (techScore >= 75) {
    summary += `${name} demonstrates strong technology foundations with active AI awareness. The organization is well-positioned to accelerate AI integration as a strategic differentiator.\n\n`;
    summary += `Current Status: Technology is integrated across core workflows with measurable impact. The team has identified AI use cases and may have initial implementations underway.\n\n`;
    summary += `Recommended Next Steps:\n`;
    summary += `• Formalize an AI integration roadmap with quarterly milestones and ROI targets\n`;
    summary += `• Identify the top 3 processes where AI could deliver 20%+ efficiency gains\n`;
    summary += `• Designate an internal AI champion to lead evaluation and adoption efforts`;
  } else if (techScore >= 60) {
    summary += `${name} has a developing technology foundation with emerging AI awareness. The organization understands the potential but has not yet moved to active implementation.\n\n`;
    summary += `Current Status: Basic technology tools are in place and moderately utilized. AI is recognized as relevant but lacks a clear adoption strategy.\n\n`;
    summary += `Recommended Next Steps:\n`;
    summary += `• Conduct a team AI literacy workshop focused on practical, industry-specific use cases\n`;
    summary += `• Pilot one AI tool in a low-risk area (scheduling, email drafting, or data analysis)\n`;
    summary += `• Audit current tech utilization — many organizations use less than 40% of their existing tool capabilities`;
  } else if (techScore >= 40) {
    summary += `${name} shows limited technology adoption with minimal AI readiness. The organization relies heavily on manual processes and risks falling behind more tech-forward competitors.\n\n`;
    summary += `Current Status: Technology tools exist but are underutilized or fragmented. AI is either unknown or perceived as irrelevant to the business.\n\n`;
    summary += `Recommended Next Steps:\n`;
    summary += `• Complete a full technology audit: list every tool, its cost, adoption rate, and business impact\n`;
    summary += `• Identify 3 manual tasks that consume the most staff hours — these are your automation priorities\n`;
    summary += `• Schedule one introductory AI session for leadership to demystify the technology and explore practical applications`;
  } else {
    summary += `${name} has critical gaps in technology adoption with no meaningful AI readiness. The organization operates primarily through manual processes, creating significant inefficiency and competitive risk.\n\n`;
    summary += `Current Status: Technology infrastructure is minimal or absent. Daily operations depend on manual effort, paper processes, or disconnected tools.\n\n`;
    summary += `Recommended Next Steps:\n`;
    summary += `• Prioritize basic technology infrastructure before AI — email systems, cloud storage, and a central communication tool\n`;
    summary += `• Automate one high-frequency task this week using a free tool (Google Workspace, Trello, or Zapier free tier)\n`;
    summary += `• Build technology comfort gradually — small wins create momentum for larger adoption`;
  }

  summary += `\n\nIndustry AI Landscape: In the ${industryProfile.label} sector, leading organizations are leveraging ${industryProfile.aiOpportunities}.`;

  return summary;
}


// ═════════════════════════════════════════════════════════════════
// ROADMAP GENERATOR — 7-Day Fix-First + 30-Day Strategic
// ═════════════════════════════════════════════════════════════════

function generateRoadmap(data) {
  const { bottlenecks, domainScores, client } = data;
  const name = client.displayName;

  // Days 1-3: Target the #1 bottleneck with immediate stabilization
  const b1 = DOMAINS.find(d => d.key === bottlenecks[0].key);
  const b1Score = domainScores[b1.key];
  const b1ActionKey = b1Score < 40 ? 'critical' : (b1Score < 60 ? 'moderate' : 'growth');
  const b1Actions = b1.actions[b1ActionKey];

  let day1_3 = `PRIORITY: ${b1.label} (${b1Score}/100)\n`;
  day1_3 += `Objective: Stabilize the most critical domain with immediate, high-impact actions.\n\n`;
  b1Actions.forEach((action, i) => {
    day1_3 += `Action ${i + 1}: ${action}\n`;
  });
  day1_3 += `\nExpected Outcome: Establish a clear baseline and initiate measurable improvement in ${b1.label.toLowerCase()}.`;

  // Days 4-5: Target the #2 bottleneck with process improvements
  const b2 = DOMAINS.find(d => d.key === bottlenecks[1].key);
  const b2Score = domainScores[b2.key];
  const b2ActionKey = b2Score < 40 ? 'critical' : (b2Score < 60 ? 'moderate' : 'growth');
  const b2Actions = b2.actions[b2ActionKey];

  let day4_5 = `PRIORITY: ${b2.label} (${b2Score}/100)\n`;
  day4_5 += `Objective: Address the second-priority domain with targeted process improvements.\n\n`;
  b2Actions.forEach((action, i) => {
    day4_5 += `Action ${i + 1}: ${action}\n`;
  });
  day4_5 += `\nExpected Outcome: Create structural improvements that reduce risk and build operational capacity.`;

  // Days 6-7: Measurement, planning, and momentum
  let day6_7 = `PRIORITY: Measurement & Forward Planning\n`;
  day6_7 += `Objective: Assess initial progress, capture quick wins, and establish accountability for sustained improvement.\n\n`;
  day6_7 += `Action 1: Review progress on Days 1-5 actions — document what was completed, what's in progress, and what needs adjustment.\n`;
  day6_7 += `Action 2: Identify and celebrate 2-3 quick wins from the week — communicate these to the full team to build momentum.\n`;
  day6_7 += `Action 3: Assign owners and deadlines for any incomplete items — carry them into the 30-Day Strategic Roadmap.\n`;

  // Add domain-specific Day 6-7 action for the third bottleneck if applicable
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

  // Week 1: Quick wins (extends 7-Day Roadmap)
  plan += `WEEK 1 — STABILIZATION & QUICK WINS\n`;
  plan += `Continue executing the 7-Day Fix-First Roadmap. Focus on completing all assigned actions from Days 1-7. `;
  plan += `Key deliverables: documented process maps for critical workflows, initial KPI tracking established, `;
  plan += `and team communication on priorities completed.\n\n`;

  // Week 2: Structural changes
  const b1 = bottlenecks[0], b2 = bottlenecks[1];
  plan += `WEEK 2 — STRUCTURAL IMPROVEMENTS\n`;
  plan += `• Deepen ${b1.label} improvements: move from emergency fixes to systematic change. `;
  plan += `Document the root causes identified in Week 1 and implement structural solutions.\n`;
  plan += `• Begin ${b2.label} transformation: apply the learnings from the first bottleneck to accelerate improvement in the second priority area.\n`;
  plan += `• Conduct a mid-month check: are the actions producing measurable results? Adjust approach if not.\n\n`;

  // Week 3: Expansion and integration
  plan += `WEEK 3 — EXPANSION & INTEGRATION\n`;
  plan += `• Leverage strength in ${strengths[0].label} (${strengths[0].score}/100): use your strongest domain as a platform to elevate weaker areas.\n`;
  plan += `• Technology integration check: identify one workflow that can be digitized or automated this week.\n`;
  plan += `• Explore industry-specific opportunities: ${industryProfile.aiOpportunities}.\n\n`;

  // Week 4: Measurement and next steps
  plan += `WEEK 4 — MEASUREMENT & FORWARD PLANNING\n`;
  plan += `• Conduct a mini re-assessment: score each domain qualitatively — has it improved, stayed flat, or declined?\n`;
  plan += `• Document all changes made during the 30-day period — create an internal change log.\n`;
  plan += `• Schedule a full Future-Ready Re-Assessment for the 90-day mark to measure quantitative progress.\n`;
  plan += `• Prioritize 2-3 strategic initiatives for the next quarter based on what you've learned.\n\n`;

  plan += `TARGET OUTCOME: Move from ${getTier(frs).label} to ${getTier(Math.min(100, frs + 15)).label} tier within 90 days through consistent execution of these priorities.`;

  return plan;
}

function generateMomentumCommentary(data) {
  const { domainScores, strengths, bottlenecks, frs, iss, industryProfile, client } = data;
  const name = client.displayName;
  const momentumScore = domainScores.Momentum;
  const leadershipScore = domainScores.Leadership;

  let commentary = `FACILITATOR MOMENTUM ANALYSIS — ${name}\n\n`;

  // Overall trajectory assessment
  if (frs >= 75) {
    commentary += `Trajectory: POSITIVE. ${name} has the foundation for sustained growth. The facilitator's role is optimization and acceleration — helping the organization capitalize on existing strengths while addressing remaining gaps.\n\n`;
  } else if (frs >= 60) {
    commentary += `Trajectory: CAUTIOUSLY POSITIVE. ${name} has building blocks in place but lacks consistency. The facilitator's role is to create connective tissue between stronger and weaker domains, building systematic improvement habits.\n\n`;
  } else if (frs >= 40) {
    commentary += `Trajectory: AT RISK. ${name} requires sustained intervention to prevent further deterioration. The facilitator should focus on stabilization first, then incremental improvement. Avoid overwhelming the organization with too many changes simultaneously.\n\n`;
  } else {
    commentary += `Trajectory: CRITICAL. ${name} needs intensive support. The facilitator should operate in triage mode — focus exclusively on the highest-impact, lowest-complexity actions. Build confidence through small wins before attempting structural changes.\n\n`;
  }

  // Cross-domain dynamics
  commentary += `Key Dynamic: `;
  if (leadershipScore >= 70 && momentumScore < 50) {
    commentary += `Strong leadership with weak market positioning suggests strategic clarity exists but is not translating into external results. Focus the conversation on connecting internal vision to customer-facing execution.\n\n`;
  } else if (leadershipScore < 50 && momentumScore >= 70) {
    commentary += `Market success without strong leadership alignment is unsustainable. The organization is likely running on momentum from past decisions or market conditions. Prioritize leadership clarity before the market advantage erodes.\n\n`;
  } else if (leadershipScore >= 70 && momentumScore >= 70) {
    commentary += `The leadership-to-market pipeline is functioning well. Focus facilitation on the operational and technological infrastructure needed to sustain and scale this advantage.\n\n`;
  } else {
    commentary += `Both leadership and market positioning need attention. Start with leadership clarity — without it, all other improvements lack direction and accountability.\n\n`;
  }

  // Consistency analysis
  const scores = Object.values(domainScores);
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);
  const spread = maxScore - minScore;

  commentary += `Domain Spread: ${spread} points (${minScore} to ${maxScore}). `;
  if (spread > 40) {
    commentary += `This wide spread indicates a "spiky" organization — very strong in some areas but dangerously weak in others. Address the valleys before amplifying the peaks.\n\n`;
  } else if (spread > 20) {
    commentary += `Moderate spread with room for harmonization. The organization would benefit from transferring the discipline from stronger domains into weaker ones.\n\n`;
  } else {
    commentary += `Tight spread suggests consistent organizational development. Focus on lifting all domains together rather than isolating individual areas.\n\n`;
  }

  // Industry context for facilitator
  commentary += `Industry Note: ${industryProfile.label} organizations at the ${getTier(frs).label} level typically need 2-3 quarters of focused effort to move up one tier. Key accelerators for this sector include ${industryProfile.aiOpportunities}.`;

  return commentary;
}


// ═════════════════════════════════════════════════════════════════
// STRENGTH & BOTTLENECK NARRATIVE BUILDERS
// ═════════════════════════════════════════════════════════════════

function buildStrengthNarrative(domainInfo, score) {
  const domain = DOMAINS.find(d => d.key === domainInfo.key);
  const tierKey = getTierKey(score);
  return `${domain.label} (${score}/100): ${domain.descriptors[tierKey]}`;
}

function buildBottleneckNarrative(domainInfo, score) {
  const domain = DOMAINS.find(d => d.key === domainInfo.key);
  const tierKey = getTierKey(score);
  let narrative = `${domain.label} (${score}/100): ${domain.descriptors[tierKey]}`;
  if (score < 50) {
    narrative += ` This domain is flagged as a critical bottleneck requiring immediate attention in the 7-Day Fix-First Roadmap.`;
  }
  return narrative;
}


// ═════════════════════════════════════════════════════════════════
// API HANDLER — Main serverless function entry point
// ═════════════════════════════════════════════════════════════════

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed. Use POST.',
      AnalysisCompleted: 'No'
    });
  }

  try {
    // Parse input
    const { client, questions } = parseInput(req.body || {});
    const industryProfile = matchIndustry(client.industry);

    // Calculate scores
    const domainScores = calculateDomainScores(questions);
    const frs = calculateFRS(domainScores);
    const iss = calculateISS(domainScores, client.industry);
    const { strengths, bottlenecks } = identifyStrengthsAndBottlenecks(domainScores);

    // Build shared data object for generators
    const analysisData = {
      client,
      domainScores,
      frs,
      iss,
      strengths,
      bottlenecks,
      industryProfile
    };

    // Generate narratives
    const executiveSummary     = generateExecutiveSummary(analysisData);
    const domainBreakdown      = generateDomainBreakdown(analysisData);
    const industryInsights     = generateIndustryInsights(analysisData);
    const aiReadiness          = generateAIReadiness(analysisData);

    // Generate roadmaps
    const roadmap = generateRoadmap(analysisData);
    const plan30  = generate30DayPlan(analysisData);
    const momentumCommentary = generateMomentumCommentary(analysisData);

    // Build response matching Zapier Table field names exactly
    const response = {
      // Status
      AnalysisCompleted: 'Yes',

      // Composite scores
      FutureReadyScore:       frs,
      IndustryStabilityScore: iss,

      // Domain scores
      Domain_Leadership:            domainScores.Leadership,
      Domain_OperationalStability:  domainScores.OperationalStability,
      Domain_CognitiveDiversity:    domainScores.CognitiveDiversity,
      Domain_TechAI:                domainScores.TechAI,
      Domain_Momentum:              domainScores.Momentum,

      // Module scores (mirrors domain scores for compatibility)
      M1: domainScores.Leadership,
      M2: domainScores.OperationalStability,
      M3: domainScores.CognitiveDiversity,
      M4: domainScores.TechAI,
      M5: domainScores.Momentum,

      // Top 3 Strengths (narrative)
      Strength1: buildStrengthNarrative(strengths[0], strengths[0].score),
      Strength2: buildStrengthNarrative(strengths[1], strengths[1].score),
      Strength3: buildStrengthNarrative(strengths[2], strengths[2].score),

      // Top 3 Bottlenecks (narrative)
      Bottleneck1: buildBottleneckNarrative(bottlenecks[0], bottlenecks[0].score),
      Bottleneck2: buildBottleneckNarrative(bottlenecks[1], bottlenecks[1].score),
      Bottleneck3: buildBottleneckNarrative(bottlenecks[2], bottlenecks[2].score),

      // Narrative sections
      Narrative_ExecutiveSummary:  executiveSummary,
      Narrative_DomainBreakdown:  domainBreakdown,
      IndustryInsights:           industryInsights,
      AIReadinessSummary:         aiReadiness,

      // 7-Day Roadmap (3 phases)
      Roadmap_Day1_3: roadmap.day1_3,
      Roadmap_Day4_5: roadmap.day4_5,
      Roadmap_Day6_7: roadmap.day6_7,

      // Facilitator Package
      Facilitator_30DayPlan:            plan30,
      Facilitator_MomentumCommentary:   momentumCommentary
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
