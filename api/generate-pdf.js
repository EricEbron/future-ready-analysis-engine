// ═════════════════════════════════════════════════════════════════════
// FUTURE-READY TRANSFORMATION SYSTEM — PDF GENERATOR v1.0.0
// SME Media Group, LLC | Clarksville, TN
// Endpoint: POST /api/generate-pdf
//
// Dependencies: @sparticuz/chromium, puppeteer-core, handlebars
// Memory: 1024MB | maxDuration: 30s (see vercel.json)
//
// Request body fields (from scoring engine response + Code by Zapier):
//   Client: name, email, company, title, phone, industry
//   Scores: FutureReadyScore, IndustryStabilityScore,
//           Domain_Leadership, Domain_OperationalStability,
//           Domain_WorkforceFinancial, Domain_TechAI, Domain_Momentum
//   Narratives: Narrative_ExecutiveSummary, Narrative_DomainBreakdown,
//               IndustryInsights, AIReadinessSummary
//   Roadmap: Roadmap_Day1_3, Roadmap_Day4_5, Roadmap_Day6_7
//   Plan: Facilitator_30DayPlan
//   Tier: Tier (string: Critical / At Risk / Developing / Strong / Optimized)
//   Strengths: Strength1, Strength2, Strength3
//   Bottlenecks: Bottleneck1, Bottleneck2, Bottleneck3
//   White-label: branding_logo_url, branding_accent_color,
//                branding_company_name, branding_footer_text
//
// Response:
//   { success: true, pdf_base64: "...", filename: "...", page_count: 6 }
// ═════════════════════════════════════════════════════════════════════

const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const Handlebars = require('handlebars');

// ─── CORS HEADERS ─────────────────────────────────────────────────────────
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://hooks.zapier.com',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
  'Access-Control-Max-Age': '86400'
};

// ─── TIER COLORS ──────────────────────────────────────────────────────────
const TIER_CONFIG = {
  'Critical':   { color: '#DC2626', bg: '#FEE2E2', icon: '⚠️' },
  'At Risk':    { color: '#D97706', bg: '#FEF3C7', icon: '🔶' },
  'Developing': { color: '#2563EB', bg: '#DBEAFE', icon: '📈' },
  'Strong':     { color: '#059669', bg: '#D1FAE5', icon: '✅' },
  'Optimized':  { color: '#7C3AED', bg: '#EDE9FE', icon: '🏆' }
};

// ─── HELPERS ─────────────────────────────────────────────────────────────
Handlebars.registerHelper('domainBar', function(score) {
  const pct = Math.min(100, Math.max(0, Number(score) || 0));
  let color;
  if (pct >= 75)      color = '#059669';
  else if (pct >= 60) color = '#2563EB';
  else if (pct >= 40) color = '#D97706';
  else                color = '#DC2626';
  return new Handlebars.SafeString(
    `<div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${color};"></div></div>`
  );
});

Handlebars.registerHelper('tierBadge', function(tier) {
  const cfg = TIER_CONFIG[tier] || TIER_CONFIG['Developing'];
  return new Handlebars.SafeString(
    `<span class="tier-badge" style="background:${cfg.bg};color:${cfg.color};border:2px solid ${cfg.color};">
      ${cfg.icon} ${tier}
    </span>`
  );
});

Handlebars.registerHelper('scoreCircle', function(score, accentColor) {
  const frs = Number(score) || 0;
  const accent = accentColor || '#1E3A5F';
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (frs / 100) * circumference;
  return new Handlebars.SafeString(`
    <svg width="140" height="140" viewBox="0 0 140 140">
      <circle cx="70" cy="70" r="54" fill="none" stroke="#E5E7EB" stroke-width="12"/>
      <circle cx="70" cy="70" r="54" fill="none" stroke="${accent}" stroke-width="12"
        stroke-dasharray="${circumference.toFixed(1)}"
        stroke-dashoffset="${offset.toFixed(1)}"
        stroke-linecap="round"
        transform="rotate(-90 70 70)"/>
      <text x="70" y="64" text-anchor="middle" font-size="32" font-weight="700" fill="${accent}">${frs}</text>
      <text x="70" y="82" text-anchor="middle" font-size="11" fill="#6B7280">out of 100</text>
    </svg>
  `);
});

Handlebars.registerHelper('nl2br', function(text) {
  if (!text) return '';
  return new Handlebars.SafeString(
    String(text).replace(/\n/g, '<br>')
  );
});

Handlebars.registerHelper('formatDate', function() {
  const now = new Date();
  return now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
});

Handlebars.registerHelper('currentYear', function() {
  return new Date().getFullYear();
});

// ─── HTML TEMPLATE ────────────────────────────────────────────────────────
const HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Future-Ready Assessment — {{clientName}}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --accent:  {{accentColor}};
    --gold:    #C9A84C;
    --navy:    #1E3A5F;
    --light:   #F8FAFC;
    --border:  #E2E8F0;
    --text:    #1E293B;
    --muted:   #64748B;
    --white:   #FFFFFF;
    --page-w:  794px;
    --page-h:  1123px;
  }

  body {
    font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
    font-size: 11px;
    line-height: 1.6;
    color: var(--text);
    background: #CCCCCC;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* PAGE STRUCTURE */
  .page {
    width: var(--page-w);
    min-height: var(--page-h);
    background: var(--white);
    margin: 0 auto 24px;
    position: relative;
    overflow: hidden;
    page-break-after: always;
    display: flex;
    flex-direction: column;
  }

  .page-inner {
    padding: 48px 52px 40px;
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  /* ── COVER PAGE ───────────────────────────────────────────────── */
  .cover {
    background: linear-gradient(160deg, var(--accent) 0%, #0F2647 100%);
    color: white;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: var(--page-h);
  }

  .cover-header {
    padding: 44px 52px 0;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .cover-logo-area { display: flex; flex-direction: column; gap: 6px; }
  .cover-brand-name { font-size: 14px; font-weight: 700; color: var(--gold); letter-spacing: 1px; text-transform: uppercase; }
  .cover-tagline { font-size: 10px; color: rgba(255,255,255,0.7); letter-spacing: 0.5px; }

  .cover-logo-img { height: 48px; object-fit: contain; }

  .cover-main {
    padding: 0 52px;
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    gap: 28px;
  }

  .cover-eyebrow { font-size: 10px; letter-spacing: 3px; text-transform: uppercase; color: var(--gold); font-weight: 600; }
  .cover-title { font-size: 38px; font-weight: 800; line-height: 1.1; color: white; max-width: 560px; }
  .cover-subtitle { font-size: 15px; color: rgba(255,255,255,0.85); font-weight: 400; }

  .cover-score-block {
    display: flex;
    align-items: center;
    gap: 36px;
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 16px;
    padding: 24px 32px;
    backdrop-filter: blur(4px);
  }

  .cover-score-label { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: rgba(255,255,255,0.7); margin-bottom: 4px; }
  .cover-score-num { font-size: 64px; font-weight: 800; color: white; line-height: 1; }
  .cover-score-denom { font-size: 20px; color: rgba(255,255,255,0.6); }

  .cover-tier-box {
    padding: 10px 20px;
    border-radius: 30px;
    font-size: 14px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    border: 2px solid;
  }

  .cover-domains {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  .cover-domain-chip {
    background: rgba(255,255,255,0.12);
    border: 1px solid rgba(255,255,255,0.25);
    border-radius: 6px;
    padding: 6px 14px;
    font-size: 10px;
    color: rgba(255,255,255,0.9);
    white-space: nowrap;
  }

  .cover-domain-chip strong { color: var(--gold); }

  .cover-footer {
    padding: 24px 52px;
    border-top: 1px solid rgba(255,255,255,0.15);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .cover-footer-left { font-size: 10px; color: rgba(255,255,255,0.6); }
  .cover-footer-left strong { color: rgba(255,255,255,0.9); }
  .cover-confidential {
    font-size: 9px;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.5);
    border: 1px solid rgba(255,255,255,0.2);
    padding: 4px 10px;
    border-radius: 4px;
  }

  /* ── SECTION PAGES ────────────────────────────────────────────── */
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 16px;
    border-bottom: 3px solid var(--accent);
    margin-bottom: 28px;
  }

  .page-header-left { display: flex; flex-direction: column; gap: 2px; }
  .section-label { font-size: 9px; letter-spacing: 2.5px; text-transform: uppercase; color: var(--muted); font-weight: 600; }
  .section-title { font-size: 22px; font-weight: 800; color: var(--accent); }
  .client-pill {
    font-size: 10px;
    color: var(--muted);
    background: var(--light);
    padding: 5px 12px;
    border-radius: 20px;
    border: 1px solid var(--border);
    font-weight: 500;
    white-space: nowrap;
  }

  .page-footer {
    margin-top: auto;
    padding-top: 16px;
    border-top: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 9px;
    color: var(--muted);
  }

  /* ── SCORE WIDGETS ────────────────────────────────────────────── */
  .score-row {
    display: flex;
    gap: 20px;
    margin-bottom: 28px;
    align-items: flex-start;
  }

  .score-widget {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    background: var(--light);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 20px 28px;
    min-width: 160px;
  }

  .score-widget-label { font-size: 9px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--muted); font-weight: 600; }

  .tier-badge {
    display: inline-block;
    padding: 5px 14px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.5px;
  }

  /* ── DOMAIN BARS ──────────────────────────────────────────────── */
  .domain-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 14px;
  }

  .domain-label {
    width: 220px;
    font-size: 10.5px;
    font-weight: 600;
    color: var(--text);
    flex-shrink: 0;
  }

  .bar-track {
    flex: 1;
    height: 14px;
    background: #E2E8F0;
    border-radius: 7px;
    overflow: hidden;
  }

  .bar-fill {
    height: 100%;
    border-radius: 7px;
    transition: width 0s;
  }

  .domain-score {
    width: 36px;
    text-align: right;
    font-size: 11px;
    font-weight: 700;
    color: var(--text);
    flex-shrink: 0;
  }

  /* ── NARRATIVE TEXT ───────────────────────────────────────────── */
  .narrative {
    font-size: 10.5px;
    line-height: 1.75;
    color: var(--text);
    margin-bottom: 18px;
  }

  .narrative p { margin-bottom: 10px; }

  /* ── INFO BOXES ───────────────────────────────────────────────── */
  .info-box {
    background: var(--light);
    border-left: 4px solid var(--accent);
    border-radius: 0 8px 8px 0;
    padding: 14px 18px;
    margin-bottom: 16px;
    font-size: 10.5px;
    line-height: 1.65;
  }

  .info-box-title {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--accent);
    margin-bottom: 8px;
  }

  /* ── STRENGTH / BOTTLENECK TAGS ───────────────────────────────── */
  .tag-row { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
  .tag {
    padding: 5px 14px;
    border-radius: 20px;
    font-size: 10px;
    font-weight: 600;
    border: 1.5px solid;
  }

  .tag-green { background: #D1FAE5; color: #065F46; border-color: #6EE7B7; }
  .tag-red   { background: #FEE2E2; color: #991B1B; border-color: #FCA5A5; }

  /* ── ROADMAP CARDS ────────────────────────────────────────────── */
  .roadmap-grid { display: flex; gap: 16px; margin-bottom: 20px; }
  .roadmap-card {
    flex: 1;
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
  }

  .roadmap-card-header {
    background: var(--accent);
    color: white;
    padding: 10px 14px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .roadmap-card-body {
    padding: 14px;
    font-size: 10px;
    line-height: 1.7;
    color: var(--text);
    background: var(--light);
  }

  /* ── 30-DAY PLAN ──────────────────────────────────────────────── */
  .plan-week {
    margin-bottom: 14px;
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
  }

  .plan-week-header {
    background: var(--accent);
    color: white;
    padding: 8px 14px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .plan-week-body {
    padding: 12px 14px;
    font-size: 10.5px;
    line-height: 1.65;
    background: var(--light);
  }

  /* ── CTA BLOCK ────────────────────────────────────────────────── */
  .cta-block {
    background: linear-gradient(135deg, var(--accent), #0F2647);
    border-radius: 12px;
    padding: 28px 36px;
    color: white;
    text-align: center;
    margin-top: 20px;
  }

  .cta-block h3 { font-size: 18px; font-weight: 800; margin-bottom: 8px; }
  .cta-block p { font-size: 11px; color: rgba(255,255,255,0.85); margin-bottom: 16px; line-height: 1.6; }
  .cta-steps { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-bottom: 16px; }
  .cta-step {
    background: rgba(255,255,255,0.15);
    border: 1px solid rgba(255,255,255,0.25);
    border-radius: 8px;
    padding: 10px 18px;
    font-size: 10px;
    font-weight: 600;
    text-align: center;
    min-width: 140px;
  }
  .cta-step-num { font-size: 20px; font-weight: 800; color: var(--gold); display: block; margin-bottom: 4px; }
  .cta-contact { font-size: 12px; font-weight: 700; color: var(--gold); }

  /* ── UTILITY ──────────────────────────────────────────────────── */
  .two-col { display: flex; gap: 24px; }
  .two-col > * { flex: 1; }
  .mb-8 { margin-bottom: 8px; }
  .mb-16 { margin-bottom: 16px; }
  .mb-24 { margin-bottom: 24px; }
  .text-muted { color: var(--muted); }
  .text-accent { color: var(--accent); }
  .font-bold { font-weight: 700; }
  .gold-line { height: 3px; background: var(--gold); width: 48px; border-radius: 2px; margin: 8px 0 16px; }

  @media print {
    body { background: white; }
    .page { margin: 0; page-break-after: always; }
  }
</style>
</head>
<body>

<!-- ═══════════════════════════════════════════════════════════════ -->
<!-- PAGE 1: COVER                                                  -->
<!-- ═══════════════════════════════════════════════════════════════ -->
<div class="page cover">
  <div class="cover-header">
    <div class="cover-logo-area">
      {{#if logoUrl}}
        <img src="{{logoUrl}}" class="cover-logo-img" alt="Logo">
      {{else}}
        <div class="cover-brand-name">{{brandCompany}}</div>
        <div class="cover-tagline">Future-Ready Transformation System</div>
      {{/if}}
    </div>
    <div class="cover-confidential">Confidential Assessment</div>
  </div>

  <div class="cover-main">
    <div>
      <div class="cover-eyebrow">Future-Ready Workplace Assessment</div>
      <h1 class="cover-title">{{clientName}}</h1>
      <div class="cover-subtitle">{{clientCompany}} &nbsp;·&nbsp; {{clientTitle}}</div>
    </div>

    <div class="cover-score-block">
      <div>
        <div class="cover-score-label">Future-Ready Score</div>
        <div>
          <span class="cover-score-num">{{frs}}</span>
          <span class="cover-score-denom">/100</span>
        </div>
      </div>
      <div style="border-left:1px solid rgba(255,255,255,0.25);padding-left:36px;">
        <div class="cover-score-label">Performance Tier</div>
        <div class="cover-tier-box" style="color:{{tierColor}};border-color:{{tierColor}};background:rgba(255,255,255,0.12);">
          {{tier}}
        </div>
      </div>
      <div style="border-left:1px solid rgba(255,255,255,0.25);padding-left:36px;">
        <div class="cover-score-label">Stability Score</div>
        <div style="font-size:36px;font-weight:800;color:white;line-height:1;">{{iss}}</div>
      </div>
    </div>

    <div class="cover-domains">
      <div class="cover-domain-chip">Leadership <strong>{{domLeadership}}</strong></div>
      <div class="cover-domain-chip">Operations <strong>{{domOperations}}</strong></div>
      <div class="cover-domain-chip">Workforce <strong>{{domWorkforce}}</strong></div>
      <div class="cover-domain-chip">Technology <strong>{{domTech}}</strong></div>
      <div class="cover-domain-chip">Momentum <strong>{{domMomentum}}</strong></div>
    </div>
  </div>

  <div class="cover-footer">
    <div class="cover-footer-left">
      <strong>Industry:</strong> {{industry}} &nbsp;·&nbsp;
      <strong>Prepared:</strong> {{formatDate}} &nbsp;·&nbsp;
      <strong>Report ID:</strong> FRTS-{{submissionId}}
    </div>
    <div class="cover-footer-left" style="text-align:right;">
      Prepared by {{brandCompany}}<br>
      {{brandFooter}}
    </div>
  </div>
</div>


<!-- ═══════════════════════════════════════════════════════════════ -->
<!-- PAGE 2: EXECUTIVE SUMMARY                                      -->
<!-- ═══════════════════════════════════════════════════════════════ -->
<div class="page">
  <div class="page-inner">
    <div class="page-header">
      <div class="page-header-left">
        <div class="section-label">Section 01</div>
        <div class="section-title">Executive Summary</div>
      </div>
      <div class="client-pill">{{clientName}} · {{clientCompany}}</div>
    </div>

    <!-- Score widgets row -->
    <div class="score-row">
      <div class="score-widget">
        <div class="score-widget-label">Future-Ready Score</div>
        {{{scoreCircle frs accentColor}}}
        {{{tierBadge tier}}}
      </div>

      <div style="flex:1;display:flex;flex-direction:column;gap:12px;">
        <!-- Domain summary bars -->
        <div style="background:var(--light);border:1px solid var(--border);border-radius:12px;padding:18px 20px;">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin-bottom:14px;">Domain Scores at a Glance</div>
          <div class="domain-row">
            <div class="domain-label">Leadership Clarity</div>
            {{{domainBar domLeadership}}}
            <div class="domain-score">{{domLeadership}}</div>
          </div>
          <div class="domain-row">
            <div class="domain-label">Operational Stability</div>
            {{{domainBar domOperations}}}
            <div class="domain-score">{{domOperations}}</div>
          </div>
          <div class="domain-row">
            <div class="domain-label">Workforce & Financial Health</div>
            {{{domainBar domWorkforce}}}
            <div class="domain-score">{{domWorkforce}}</div>
          </div>
          <div class="domain-row">
            <div class="domain-label">Technology & AI Integration</div>
            {{{domainBar domTech}}}
            <div class="domain-score">{{domTech}}</div>
          </div>
          <div class="domain-row" style="margin-bottom:0;">
            <div class="domain-label">Leadership Momentum</div>
            {{{domainBar domMomentum}}}
            <div class="domain-score">{{domMomentum}}</div>
          </div>
        </div>

        <!-- ISS widget -->
        <div style="background:var(--light);border:1px solid var(--border);border-radius:12px;padding:14px 20px;display:flex;align-items:center;gap:16px;">
          <div style="font-size:34px;font-weight:800;color:var(--accent);">{{iss}}</div>
          <div>
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--muted);">Industry Stability Score</div>
            <div style="font-size:10px;color:var(--muted);">Measures domain consistency · 100 = perfectly balanced organization</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Strengths & Bottlenecks -->
    <div style="margin-bottom:18px;">
      <div style="font-size:11px;font-weight:700;margin-bottom:8px;color:var(--text);">Top Strengths</div>
      <div class="tag-row">
        <span class="tag tag-green">✓ {{strength1}}</span>
        {{#if strength2}}<span class="tag tag-green">✓ {{strength2}}</span>{{/if}}
        {{#if strength3}}<span class="tag tag-green">✓ {{strength3}}</span>{{/if}}
      </div>
      <div style="font-size:11px;font-weight:700;margin-bottom:8px;color:var(--text);">Priority Bottlenecks</div>
      <div class="tag-row">
        <span class="tag tag-red">⚠ {{bottleneck1}}</span>
        {{#if bottleneck2}}<span class="tag tag-red">⚠ {{bottleneck2}}</span>{{/if}}
        {{#if bottleneck3}}<span class="tag tag-red">⚠ {{bottleneck3}}</span>{{/if}}
      </div>
    </div>

    <!-- Executive narrative -->
    <div class="info-box">
      <div class="info-box-title">Executive Assessment</div>
      <div style="font-size:10.5px;line-height:1.75;">{{{nl2br executiveSummary}}}</div>
    </div>

    <div class="page-footer">
      <span>Future-Ready Transformation System · {{brandCompany}}</span>
      <span>Page 2 of 6 · {{formatDate}}</span>
      <span>{{clientName}} · FRTS-{{submissionId}}</span>
    </div>
  </div>
</div>


<!-- ═══════════════════════════════════════════════════════════════ -->
<!-- PAGE 3: DOMAIN DEEP DIVE                                       -->
<!-- ═══════════════════════════════════════════════════════════════ -->
<div class="page">
  <div class="page-inner">
    <div class="page-header">
      <div class="page-header-left">
        <div class="section-label">Section 02</div>
        <div class="section-title">Domain Analysis</div>
      </div>
      <div class="client-pill">{{clientName}} · {{clientCompany}}</div>
    </div>

    <div class="info-box" style="margin-bottom:24px;">
      <div class="info-box-title">How to Read This Section</div>
      Each of the five domains reflects 4 assessment questions. Domain scores are weighted in the Final Future-Ready Score:
      Leadership (25%) · Operations (25%) · Workforce & Financial (20%) · Technology & AI (15%) · Leadership Momentum (15%).
      A score under 60 requires targeted intervention. A score under 40 requires immediate action.
    </div>

    <div style="font-size:10.5px;line-height:1.75;">{{{nl2br domainBreakdown}}}</div>

    <div class="page-footer">
      <span>Future-Ready Transformation System · {{brandCompany}}</span>
      <span>Page 3 of 6 · {{formatDate}}</span>
      <span>{{clientName}} · FRTS-{{submissionId}}</span>
    </div>
  </div>
</div>


<!-- ═══════════════════════════════════════════════════════════════ -->
<!-- PAGE 4: INDUSTRY INSIGHTS + AI READINESS                      -->
<!-- ═══════════════════════════════════════════════════════════════ -->
<div class="page">
  <div class="page-inner">
    <div class="page-header">
      <div class="page-header-left">
        <div class="section-label">Section 03</div>
        <div class="section-title">Industry & AI Readiness</div>
      </div>
      <div class="client-pill">{{clientName}} · {{clientCompany}}</div>
    </div>

    <div class="two-col" style="margin-bottom:20px;">
      <div>
        <div style="font-size:13px;font-weight:800;color:var(--accent);margin-bottom:6px;">Industry Context</div>
        <div class="gold-line"></div>
        <div style="font-size:10.5px;line-height:1.75;">{{{nl2br industryInsights}}}</div>
      </div>
      <div>
        <div style="font-size:13px;font-weight:800;color:var(--accent);margin-bottom:6px;">AI Readiness Profile</div>
        <div class="gold-line"></div>
        <div style="font-size:10.5px;line-height:1.75;">{{{nl2br aiReadiness}}}</div>
      </div>
    </div>

    <div class="page-footer">
      <span>Future-Ready Transformation System · {{brandCompany}}</span>
      <span>Page 4 of 6 · {{formatDate}}</span>
      <span>{{clientName}} · FRTS-{{submissionId}}</span>
    </div>
  </div>
</div>


<!-- ═══════════════════════════════════════════════════════════════ -->
<!-- PAGE 5: 7-DAY FIX-FIRST ROADMAP                               -->
<!-- ═══════════════════════════════════════════════════════════════ -->
<div class="page">
  <div class="page-inner">
    <div class="page-header">
      <div class="page-header-left">
        <div class="section-label">Section 04</div>
        <div class="section-title">7-Day Fix-First Roadmap</div>
      </div>
      <div class="client-pill">{{clientName}} · {{clientCompany}}</div>
    </div>

    <div class="info-box" style="margin-bottom:20px;">
      <div class="info-box-title">How to Use This Roadmap</div>
      These actions are sequenced by impact and urgency. Days 1-3 address the most critical domain.
      Days 4-5 tackle the second priority. Days 6-7 lock in progress and set up your 30-Day Strategic Roadmap.
      Assign an owner to each action <em>today</em>.
    </div>

    <div class="roadmap-grid">
      <div class="roadmap-card">
        <div class="roadmap-card-header">📍 Days 1–3 · Critical Priority</div>
        <div class="roadmap-card-body">{{{nl2br roadmapDay1_3}}}</div>
      </div>
      <div class="roadmap-card">
        <div class="roadmap-card-header">📋 Days 4–5 · Structural Improvement</div>
        <div class="roadmap-card-body">{{{nl2br roadmapDay4_5}}}</div>
      </div>
    </div>

    <div class="roadmap-card" style="margin-bottom:0;">
      <div class="roadmap-card-header">🔒 Days 6–7 · Measure, Lock In & Plan Forward</div>
      <div class="roadmap-card-body">{{{nl2br roadmapDay6_7}}}</div>
    </div>

    <div class="page-footer">
      <span>Future-Ready Transformation System · {{brandCompany}}</span>
      <span>Page 5 of 6 · {{formatDate}}</span>
      <span>{{clientName}} · FRTS-{{submissionId}}</span>
    </div>
  </div>
</div>


<!-- ═══════════════════════════════════════════════════════════════ -->
<!-- PAGE 6: 30-DAY PLAN + NEXT STEPS                              -->
<!-- ═══════════════════════════════════════════════════════════════ -->
<div class="page">
  <div class="page-inner">
    <div class="page-header">
      <div class="page-header-left">
        <div class="section-label">Section 05</div>
        <div class="section-title">30-Day Strategic Roadmap & Next Steps</div>
      </div>
      <div class="client-pill">{{clientName}} · {{clientCompany}}</div>
    </div>

    <div style="margin-bottom:20px;">
      <div style="font-size:10.5px;line-height:1.75;margin-bottom:16px;">{{{nl2br thirtyDayPlan}}}</div>
    </div>

    <div class="cta-block">
      <h3>Your Transformation Starts Now</h3>
      <p>
        You've taken the first step by completing this assessment. The data is clear — here's what happens next.
        Each step below is designed to accelerate your progress from insight to measurable results.
      </p>
      <div class="cta-steps">
        <div class="cta-step">
          <span class="cta-step-num">1</span>
          Book Your Strategy Debrief
        </div>
        <div class="cta-step">
          <span class="cta-step-num">2</span>
          Execute Your 7-Day Roadmap
        </div>
        <div class="cta-step">
          <span class="cta-step-num">3</span>
          Launch the 30-Day Plan
        </div>
        <div class="cta-step">
          <span class="cta-step-num">4</span>
          90-Day Re-Assessment
        </div>
      </div>
      <div class="cta-contact">{{brandCompany}} · {{brandFooter}}</div>
    </div>

    <div class="page-footer">
      <span>Future-Ready Transformation System · {{brandCompany}}</span>
      <span>Page 6 of 6 · {{formatDate}}</span>
      <span>Confidential · {{clientName}} · FRTS-{{submissionId}}</span>
    </div>
  </div>
</div>

</body>
</html>`;

// Compile template once at module load
const compiledTemplate = Handlebars.compile(HTML_TEMPLATE);

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).set(CORS_HEADERS).end();
  }
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  // Method check
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed. Use POST.' });
  }

  // Auth check
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.FRTS_API_KEY) {
    return res.status(401).json({ success: false, error: 'Unauthorized: missing or invalid x-api-key header.' });
  }

  // Parse body
  let body = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  } catch (e) {
    return res.status(400).json({ success: false, error: 'Invalid JSON body.' });
  }

  // ── Extract & sanitize template data ────────────────────────────────────
  const frs = Number(body.FutureReadyScore) || 0;
  const iss = Number(body.IndustryStabilityScore) || 0;
  const tier = body.Tier || getTierLabel(frs);
  const tierCfg = TIER_CONFIG[tier] || TIER_CONFIG['Developing'];

  // White-label / branding overrides
  const accentColor  = body.branding_accent_color  || '#1E3A5F';
  const logoUrl      = body.branding_logo_url       || '';
  const brandCompany = body.branding_company_name   || 'SME Media Group, LLC';
  const brandFooter  = body.branding_footer_text    || 'Clarksville, TN · smemediagroup.com';

  // Submission ID — use provided or generate short one
  const submissionId = (body.submission_id || body.SubmissionId || generateShortId()).toUpperCase().slice(0, 8);

  // Client info
  const clientName    = clean(body.name    || body.Name    || 'Assessment Participant');
  const clientCompany = clean(body.company || body.Company || '');
  const clientTitle   = clean(body.title   || body.Title   || '');
  const industry      = clean(body.industry || body.Industry || 'General Business');

  // Domain scores
  const domLeadership = Number(body.Domain_Leadership          || body.M1) || 0;
  const domOperations = Number(body.Domain_OperationalStability || body.M2) || 0;
  const domWorkforce  = Number(body.Domain_WorkforceFinancial   || body.M3) || 0;  // Bug #14 FIX: renamed from Domain_CognitiveDiversity
  const domTech       = Number(body.Domain_TechAI               || body.M4) || 0;
  const domMomentum   = Number(body.Domain_Momentum             || body.M5) || 0;

  // Strengths / bottlenecks
  const strength1   = clean(body.Strength1   || '');
  const strength2   = clean(body.Strength2   || '');
  const strength3   = clean(body.Strength3   || '');
  const bottleneck1 = clean(body.Bottleneck1 || '');
  const bottleneck2 = clean(body.Bottleneck2 || '');
  const bottleneck3 = clean(body.Bottleneck3 || '');

  // Narratives
  const executiveSummary = clean(body.Narrative_ExecutiveSummary || 'Assessment complete. See domain scores above.');
  const domainBreakdown  = clean(body.Narrative_DomainBreakdown  || '');
  const industryInsights = clean(body.IndustryInsights           || '');
  const aiReadiness      = clean(body.AIReadinessSummary         || '');

  // Roadmap
  const roadmapDay1_3 = clean(body.Roadmap_Day1_3 || '');
  const roadmapDay4_5 = clean(body.Roadmap_Day4_5 || '');
  const roadmapDay6_7 = clean(body.Roadmap_Day6_7 || '');
  const thirtyDayPlan = clean(body.Facilitator_30DayPlan || '');

  // ── Build HTML ───────────────────────────────────────────────────────────
  let html;
  try {
    html = compiledTemplate({
      // Client
      clientName, clientCompany, clientTitle, industry,
      // Scores
      frs, iss, tier, tierColor: tierCfg.color,
      // Domains
      domLeadership, domOperations, domWorkforce, domTech, domMomentum,
      // Tags
      strength1, strength2, strength3,
      bottleneck1, bottleneck2, bottleneck3,
      // Narratives
      executiveSummary, domainBreakdown, industryInsights, aiReadiness,
      // Roadmap
      roadmapDay1_3, roadmapDay4_5, roadmapDay6_7, thirtyDayPlan,
      // Branding
      accentColor, logoUrl, brandCompany, brandFooter,
      // Meta
      submissionId
    });
  } catch (templateErr) {
    console.error('[FRTS PDF] Template error:', templateErr);
    return res.status(500).json({ success: false, error: 'Template render failed.', details: templateErr.message });
  }

  // ── Launch Puppeteer ─────────────────────────────────────────────────────
  let browser;
  const startTime = Date.now();

  try {
    browser = await puppeteer.launch({
      args:            chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath:  await chromium.executablePath(),
      headless:        chromium.headless,
      ignoreHTTPSErrors: true
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 15000 });

    const pdfBuffer = await page.pdf({
      format:            'A4',
      printBackground:   true,
      margin:            { top: '0', right: '0', bottom: '0', left: '0' },
      preferCSSPageSize: false
    });

    await browser.close();
    browser = null;

    const durationMs  = Date.now() - startTime;
    const pdf_base64  = pdfBuffer.toString('base64');
    const sizeKb      = Math.round(pdfBuffer.length / 1024);
    const safeCompany = (clientCompany || clientName).replace(/[^a-zA-Z0-9\-_]/g, '-').substring(0, 40);
    const filename    = `FRTS-${safeCompany}-Score${frs}-${submissionId}.pdf`;

    console.log(`[FRTS PDF] Generated ${filename} — ${sizeKb}KB in ${durationMs}ms`);

    return res.status(200).json({
      success:    true,
      pdf_base64,
      filename,
      size_kb:    sizeKb,
      page_count: 6,
      duration_ms: durationMs,
      client: { name: clientName, company: clientCompany, email: body.email || '' },
      score:  { frs, iss, tier }
    });

  } catch (puppeteerErr) {
    console.error('[FRTS PDF] Puppeteer error:', puppeteerErr);
    if (browser) { try { await browser.close(); } catch (_) {} }
    return res.status(500).json({
      success: false,
      error:   'PDF generation failed.',
      details: puppeteerErr.message
    });
  }
};

// ─── UTILITIES ────────────────────────────────────────────────────────────
function getTierLabel(score) {
  if (score >= 90) return 'Optimized';
  if (score >= 75) return 'Strong';
  if (score >= 60) return 'Developing';
  if (score >= 40) return 'At Risk';
  return 'Critical';
}

function clean(str) {
  if (!str) return '';
  return String(str).trim();
}

function generateShortId() {
  return Math.random().toString(36).substr(2, 8).toUpperCase();
}
