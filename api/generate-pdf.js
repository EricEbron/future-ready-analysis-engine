// ═════════════════════════════════════════════════════════════════════
// FUTURE-READY TRANSFORMATION SYSTEM — PDF GENERATOR v1.1.1
// SME Media Group, LLC | Clarksville, TN
// Endpoint: POST /api/generate-pdf
//
// Stack: pdfkit (pure Node.js — no Chromium, Vercel Hobby compatible)
// Memory: <50MB | Cold start: ~300ms
//
// Input fields (from futureready-analyze.js response via Zapier):
//   name, email, company, title, phone, industry
//   FutureReadyScore, IndustryStabilityScore, Tier
//   Domain_Leadership, Domain_OperationalStability,
//   Domain_CognitiveDiversity, Domain_TechAI, Domain_Momentum
//   Strength1, Strength2, Strength3
//   Bottleneck1, Bottleneck2, Bottleneck3
//   Narrative_ExecutiveSummary, Narrative_DomainBreakdown
//   IndustryInsights, AIReadinessSummary
//   Roadmap_Day1_3, Roadmap_Day4_5, Roadmap_Day6_7
//   Facilitator_30DayPlan
//   MomentumCommentary (optional)
//
// Output:
//   { success: true, pdf_base64: "...", filename: "...", size_kb: N }
// ═════════════════════════════════════════════════════════════════════

'use strict';

const PDFDocument = require('pdfkit');

// ─── BRAND COLORS ────────────────────────────────────────────────────────────
const C = {
  navy:    [30,  58,  95],   // #1E3A5F
  gold:    [201, 168, 76],   // #C9A84C
  green:   [5,   150, 105],  // #059669
  blue:    [37,  99,  235],  // #2563EB
  amber:   [217, 119, 6],    // #D97706
  red:     [220, 38,  38],   // #DC2626
  purple:  [124, 58,  237],  // #7C3AED
  dark:    [30,  41,  59],   // #1E293B
  muted:   [100, 116, 139],  // #64748B
  light:   [248, 250, 252],  // #F8FAFC
  border:  [226, 232, 240],  // #E2E8F0
  white:   [255, 255, 255],
};

// ─── TIER CONFIG ──────────────────────────────────────────────────────────────
const TIER_CONFIG = {
  'Critical':   { color: C.red,    label: 'Critical'   },
  'At Risk':    { color: C.amber,  label: 'At Risk'    },
  'Developing': { color: C.blue,   label: 'Developing' },
  'Strong':     { color: C.green,  label: 'Strong'     },
  'Optimized':  { color: C.purple, label: 'Optimized'  },
};

// ─── DOMAIN CONFIG ────────────────────────────────────────────────────────────
const DOMAINS = [
  { key: 'Domain_Leadership',             label: 'Leadership Clarity & Alignment',  weight: '25%' },
  { key: 'Domain_OperationalStability',   label: 'Operational Stability & Workflow', weight: '25%' },
  { key: 'Domain_CognitiveDiversity',     label: 'Workforce & Financial Health',     weight: '20%' },
  { key: 'Domain_TechAI',                 label: 'Technology & AI Integration',      weight: '15%' },
  { key: 'Domain_Momentum',               label: 'Leadership Momentum & Adaptability',weight: '15%' },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function clean(val, fallback = '') {
  if (val === null || val === undefined) return fallback;
  return String(val).trim();
}

function num(val, fallback = 0) {
  const n = parseFloat(val);
  return isNaN(n) ? fallback : n;
}

function domainColor(score) {
  if (score >= 75) return C.green;
  if (score >= 60) return C.blue;
  if (score >= 40) return C.amber;
  return C.red;
}

function tierFromScore(frs) {
  if (frs >= 90) return 'Optimized';
  if (frs >= 75) return 'Strong';
  if (frs >= 60) return 'Developing';
  if (frs >= 40) return 'At Risk';
  return 'Critical';
}

// ─── PDF BUILDER HELPERS ──────────────────────────────────────────────────────
function setFill(doc, rgb) { doc.fillColor(rgb); }
function setStroke(doc, rgb) { doc.strokeColor(rgb); }

function drawRect(doc, x, y, w, h, rgb, radius = 0) {
  doc.roundedRect(x, y, w, h, radius).fill(rgb);
}

function drawText(doc, text, x, y, opts = {}) {
  const { font = 'Helvetica', size = 10, color = C.dark, width, align = 'left', lineBreak = true } = opts;
  doc.font(font).fontSize(size).fillColor(color);
  if (width) {
    doc.text(text, x, y, { width, align, lineBreak });
  } else {
    doc.text(text, x, y, { align, lineBreak });
  }
}

function drawHR(doc, y, x1, x2, color = C.border, thickness = 0.5) {
  doc.moveTo(x1, y).lineTo(x2, y).lineWidth(thickness).strokeColor(color).stroke();
}

// Wraps long text, returns new y position after block
function drawWrapped(doc, text, x, y, width, opts = {}) {
  const { font = 'Helvetica', size = 9.5, color = C.dark, maxLines } = opts;
  if (!text) return y;
  doc.font(font).fontSize(size).fillColor(color);
  const lines = text.split('\n');
  let rendered = 0;
  for (const line of lines) {
    if (maxLines && rendered >= maxLines) { doc.text('…', x, y, { lineBreak: false }); break; }
    const h = doc.heightOfString(line || ' ', { width });
    doc.text(line || ' ', x, y, { width, lineBreak: false });
    y += h + 2;
    rendered++;
  }
  return y + 4;
}

// Section header banner
function sectionBanner(doc, x, y, w, label, title, pageNum) {
  drawRect(doc, x, y, w, 38, C.navy, 4);
  // Gold accent left bar
  drawRect(doc, x, y, 4, 38, C.gold, 2);
  doc.font('Helvetica').fontSize(7.5).fillColor(C.gold)
     .text(label.toUpperCase(), x + 12, y + 7, { lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(14).fillColor(C.white)
     .text(title, x + 12, y + 17, { lineBreak: false });
  doc.font('Helvetica').fontSize(8).fillColor([180, 200, 220])
     .text(`Page ${pageNum} of 5`, x + w - 60, y + 15, { lineBreak: false });
  return y + 52;
}

// Domain progress bar row
function domainBar(doc, x, y, label, score, weight, barWidth) {
  const pct = Math.min(Math.max(num(score), 0), 100) / 100;
  const color = domainColor(num(score));
  const BAR_H = 10;
  const LABEL_W = 195;
  const SCORE_W = 36;

  // Label
  doc.font('Helvetica-Bold').fontSize(9).fillColor(C.dark)
     .text(label, x, y, { width: LABEL_W, lineBreak: false });
  // Weight
  doc.font('Helvetica').fontSize(8).fillColor(C.muted)
     .text(`(${weight})`, x + LABEL_W, y, { lineBreak: false });
  y += 14;

  // Track
  doc.roundedRect(x, y, barWidth, BAR_H, 3).fill(C.border);
  // Fill
  if (pct > 0) {
    doc.roundedRect(x, y, barWidth * pct, BAR_H, 3).fill(color);
  }
  // Score label
  doc.font('Helvetica-Bold').fontSize(9).fillColor(color)
     .text(`${num(score)}`, x + barWidth + 6, y + 1, { lineBreak: false });

  return y + BAR_H + 14;
}

// Score circle (SVG-style using pdfkit primitives)
function scoreCircle(doc, cx, cy, score, radius = 48) {
  const frs = num(score);
  const tier = tierFromScore(frs);
  const cfg = TIER_CONFIG[tier] || TIER_CONFIG['Developing'];

  // Outer ring
  doc.circle(cx, cy, radius).lineWidth(8).strokeColor(C.border).stroke();
  // Filled arc approximation — pdfkit doesn't do arcs natively, use colored circle with smaller white circle
  const pct = frs / 100;
  doc.circle(cx, cy, radius).lineWidth(8).strokeColor(cfg.color).stroke();
  // Score number
  doc.font('Helvetica-Bold').fontSize(28).fillColor(cfg.color)
     .text(String(frs), cx - radius, cy - 18, { width: radius * 2, align: 'center', lineBreak: false });
  doc.font('Helvetica').fontSize(9).fillColor(C.muted)
     .text('out of 100', cx - radius, cy + 12, { width: radius * 2, align: 'center', lineBreak: false });
}

// Colored tag/pill
function pill(doc, text, x, y, color, textColor = C.white) {
  const w = doc.font('Helvetica-Bold').fontSize(9).widthOfString(text) + 20;
  doc.roundedRect(x, y, w, 18, 9).fill(color);
  doc.fillColor(textColor).text(text, x + 10, y + 4, { lineBreak: false });
  return x + w + 8;
}

// Bullet point
function bullet(doc, text, x, y, width, color = C.navy) {
  doc.circle(x + 3, y + 5, 2.5).fill(color);
  doc.font('Helvetica').fontSize(9.5).fillColor(C.dark)
     .text(text, x + 12, y, { width: width - 12, lineBreak: true });
  return y + doc.heightOfString(text, { width: width - 12 }) + 6;
}

// ─── MAIN HANDLER ────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  // OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
    return res.status(200).end();
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed. Use POST.' });
  }

  // ── Auth ─────────────────────────────────────────────────────────────────
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.FRTS_API_KEY) {
    return res.status(401).json({ success: false, error: 'Unauthorized: missing or invalid x-api-key.' });
  }

  // ── Parse body ───────────────────────────────────────────────────────────
  let body = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  } catch (e) {
    return res.status(400).json({ success: false, error: 'Invalid JSON body.' });
  }

  // ── Extract all fields ───────────────────────────────────────────────────
  const clientName    = clean(body.name    || body.Name    || body.respondent_name, 'Assessment Participant');
  const clientCompany = clean(body.company || body.Company || body.company_name,    'Your Organization');
  const clientTitle   = clean(body.title   || body.Title,   '');
  const clientEmail   = clean(body.email   || body.Email,   '');
  const clientPhone   = clean(body.phone   || body.Phone,   '');
  const industry      = clean(body.industry|| body.Industry,'General Business');

  const frs  = num(body.FutureReadyScore          || body.total_score, 0);
  const iss  = num(body.IndustryStabilityScore,     0);
  const tier = clean(body.Tier || tierFromScore(frs));
  const tierCfg = TIER_CONFIG[tier] || TIER_CONFIG['Developing'];

  const domScores = {
    Domain_Leadership:           num(body.Domain_Leadership,           0),
    Domain_OperationalStability: num(body.Domain_OperationalStability, 0),
    Domain_CognitiveDiversity:   num(body.Domain_CognitiveDiversity,   0),
    Domain_TechAI:               num(body.Domain_TechAI,               0),
    Domain_Momentum:             num(body.Domain_Momentum,             0),
  };

  const strength1   = clean(body.Strength1,   '');
  const strength2   = clean(body.Strength2,   '');
  const strength3   = clean(body.Strength3,   '');
  const bottleneck1 = clean(body.Bottleneck1, '');
  const bottleneck2 = clean(body.Bottleneck2, '');
  const bottleneck3 = clean(body.Bottleneck3, '');

  const execSummary   = clean(body.Narrative_ExecutiveSummary, 'Executive summary not available.');
  const domainBreak   = clean(body.Narrative_DomainBreakdown,  '');
  const industryText  = clean(body.IndustryInsights,           '');
  const aiText        = clean(body.AIReadinessSummary,         '');
  const roadmap1      = clean(body.Roadmap_Day1_3,             '');
  const roadmap2      = clean(body.Roadmap_Day4_5,             '');
  const roadmap3      = clean(body.Roadmap_Day6_7,             '');
  const plan30        = clean(body.Facilitator_30DayPlan,       '');

  const reportDate = new Date().toLocaleDateString('en-US',
    { year: 'numeric', month: 'long', day: 'numeric' });
  const shortId = Math.random().toString(36).slice(2, 10).toUpperCase();

  // ── Build PDF ────────────────────────────────────────────────────────────
  const PAGE_W = 612;
  const PAGE_H = 792;
  const MAR    = 52;
  const INNER  = PAGE_W - MAR * 2;  // 508

  const doc = new PDFDocument({
    size:    [PAGE_W, PAGE_H],
    margins: { top: MAR, bottom: MAR, left: MAR, right: MAR },
    info: {
      Title:   `Future-Ready Assessment — ${clientCompany}`,
      Author:  'SME Media Group, LLC',
      Subject: 'Future-Ready Transformation Score Report',
      Creator: 'FRTS v1.1.1',
    },
    autoFirstPage: false,
  });

  const chunks = [];
  doc.on('data', c => chunks.push(c));

  await new Promise((resolve, reject) => {
    doc.on('end',   resolve);
    doc.on('error', reject);

    // ══════════════════════════════════════════════════════════════════════
    // PAGE 1 — COVER
    // ══════════════════════════════════════════════════════════════════════
    doc.addPage();
    let y = 0;

    // Full navy header block
    drawRect(doc, 0, 0, PAGE_W, 200, C.navy);
    // Gold top bar
    drawRect(doc, 0, 0, PAGE_W, 5, C.gold);

    // Brand name
    doc.font('Helvetica-Bold').fontSize(11).fillColor(C.gold)
       .text('SME MEDIA GROUP, LLC', MAR, 22, { characterSpacing: 2, lineBreak: false });
    doc.font('Helvetica').fontSize(9).fillColor([160, 180, 200])
       .text('Future-Ready Transformation System', MAR, 38, { lineBreak: false });

    // Confidential badge
    doc.roundedRect(PAGE_W - MAR - 120, 22, 120, 22, 4).fill([50, 70, 100]);
    doc.font('Helvetica-Bold').fontSize(8).fillColor([180, 200, 220])
       .text('CONFIDENTIAL', PAGE_W - MAR - 110, 28, { lineBreak: false });

    // Main title
    doc.font('Helvetica-Bold').fontSize(32).fillColor(C.white)
       .text('Future-Ready', MAR, 68, { lineBreak: false });
    doc.font('Helvetica').fontSize(32).fillColor(C.gold)
       .text('  Assessment', MAR + doc.widthOfString('Future-Ready', { fontSize: 32 }) + 2, 68, { lineBreak: false });

    doc.font('Helvetica').fontSize(13).fillColor([180, 200, 220])
       .text('Workplace Transformation Score Report', MAR, 108, { lineBreak: false });

    // Gold divider
    drawRect(doc, MAR, 130, INNER, 2, C.gold);

    // Client info in header
    doc.font('Helvetica-Bold').fontSize(18).fillColor(C.white)
       .text(clientCompany, MAR, 142, { width: INNER - 110, lineBreak: false });
    if (clientTitle) {
      doc.font('Helvetica').fontSize(10).fillColor([160, 180, 200])
         .text(`${clientName}  ·  ${clientTitle}`, MAR, 167, { lineBreak: false });
    } else {
      doc.font('Helvetica').fontSize(10).fillColor([160, 180, 200])
         .text(clientName, MAR, 167, { lineBreak: false });
    }

    y = 215;

    // Score + Tier block
    // Left: score circle area
    const CIRCLE_X = MAR + 50;
    const CIRCLE_Y = y + 50;
    scoreCircle(doc, CIRCLE_X, CIRCLE_Y, frs, 46);

    // Tier badge next to circle
    drawRect(doc, MAR + 120, y + 30, 180, 40, tierCfg.color, 6);
    doc.font('Helvetica-Bold').fontSize(20).fillColor(C.white)
       .text(tier, MAR + 120, y + 40, { width: 180, align: 'center', lineBreak: false });

    // ISS block
    doc.font('Helvetica').fontSize(9).fillColor(C.muted)
       .text('STABILITY SCORE', MAR + 320, y + 28, { lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(28).fillColor(C.navy)
       .text(String(num(iss)), MAR + 320, y + 40, { lineBreak: false });
    doc.font('Helvetica').fontSize(8).fillColor(C.muted)
       .text('/ 100', MAR + 320 + doc.widthOfString(String(num(iss)), { fontSize: 28 }) + 3, y + 52, { lineBreak: false });

    y += 115;
    drawHR(doc, y, MAR, PAGE_W - MAR, C.border);
    y += 14;

    // ── Domain mini-bars on cover ──────────────────────────────────────────
    doc.font('Helvetica-Bold').fontSize(11).fillColor(C.navy)
       .text('Domain Overview', MAR, y);
    y += 18;

    const MINI_BAR_W = INNER - 50;
    for (const d of DOMAINS) {
      const score = domScores[d.key];
      const color = domainColor(score);
      const pct   = Math.min(Math.max(score, 0), 100) / 100;

      doc.font('Helvetica').fontSize(9).fillColor(C.dark)
         .text(d.label, MAR, y, { width: 185, lineBreak: false });
      doc.roundedRect(MAR + 190, y + 1, MINI_BAR_W - 140, 8, 2).fill(C.border);
      if (pct > 0) doc.roundedRect(MAR + 190, y + 1, (MINI_BAR_W - 140) * pct, 8, 2).fill(color);
      doc.font('Helvetica-Bold').fontSize(9).fillColor(color)
         .text(`${score}`, PAGE_W - MAR - 30, y, { lineBreak: false });
      y += 18;
    }

    y += 10;
    drawHR(doc, y, MAR, PAGE_W - MAR, C.border);
    y += 14;

    // Strengths & bottlenecks on cover
    if (strength1 || bottleneck1) {
      const col2x = MAR + INNER / 2 + 10;
      const colW  = INNER / 2 - 16;

      if (strength1) {
        doc.font('Helvetica-Bold').fontSize(10).fillColor(C.green)
           .text('▲ TOP STRENGTHS', MAR, y);
        let sy = y + 14;
        [strength1, strength2, strength3].filter(Boolean).forEach(s => {
          sy = bullet(doc, s, MAR, sy, colW, C.green);
        });
      }

      if (bottleneck1) {
        doc.font('Helvetica-Bold').fontSize(10).fillColor(C.red)
           .text('▼ PRIORITY GAPS', col2x, y);
        let by = y + 14;
        [bottleneck1, bottleneck2, bottleneck3].filter(Boolean).forEach(b => {
          by = bullet(doc, b, col2x, by, colW, C.red);
        });
      }
    }

    // Cover footer
    drawRect(doc, 0, PAGE_H - 38, PAGE_W, 38, C.navy);
    doc.font('Helvetica').fontSize(8).fillColor([160, 180, 200])
       .text(
         `Prepared by SME Media Group, LLC  ·  ${reportDate}  ·  Report ID: FRTS-${shortId}`,
         MAR, PAGE_H - 24, { width: INNER, align: 'center', lineBreak: false }
       );


    // ══════════════════════════════════════════════════════════════════════
    // PAGE 2 — EXECUTIVE SUMMARY
    // ══════════════════════════════════════════════════════════════════════
    doc.addPage();
    y = sectionBanner(doc, MAR, MAR, INNER, 'Section 01', 'Executive Summary', 2);

    // Score widget row
    const W3 = (INNER - 20) / 3;
    // Box 1: FRS
    drawRect(doc, MAR, y, W3, 68, C.light, 6);
    doc.roundedRect(MAR, y, W3, 68, 6).lineWidth(1).strokeColor(C.border).stroke();
    doc.font('Helvetica').fontSize(8).fillColor(C.muted)
       .text('FUTURE-READY SCORE', MAR + 8, y + 10, { lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(32).fillColor(tierCfg.color)
       .text(String(frs), MAR + 8, y + 24, { lineBreak: false });
    doc.font('Helvetica').fontSize(9).fillColor(C.muted).text('/ 100', MAR + 8 + doc.widthOfString(String(frs), {fontSize:32}) + 3, y + 38, { lineBreak: false });

    // Box 2: Tier
    const B2X = MAR + W3 + 10;
    drawRect(doc, B2X, y, W3, 68, tierCfg.color, 6);
    doc.font('Helvetica').fontSize(8).fillColor(C.white)
       .text('PERFORMANCE TIER', B2X + 8, y + 10, { lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(22).fillColor(C.white)
       .text(tier, B2X + 8, y + 26, { lineBreak: false });

    // Box 3: ISS
    const B3X = MAR + (W3 + 10) * 2;
    drawRect(doc, B3X, y, W3, 68, C.light, 6);
    doc.roundedRect(B3X, y, W3, 68, 6).lineWidth(1).strokeColor(C.border).stroke();
    doc.font('Helvetica').fontSize(8).fillColor(C.muted)
       .text('STABILITY SCORE', B3X + 8, y + 10, { lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(32).fillColor(C.navy)
       .text(String(num(iss)), B3X + 8, y + 24, { lineBreak: false });
    doc.font('Helvetica').fontSize(9).fillColor(C.muted).text('/ 100', B3X + 8 + doc.widthOfString(String(num(iss)), {fontSize:32}) + 3, y + 38, { lineBreak: false });

    y += 82;

    // Executive summary narrative
    doc.roundedRect(MAR, y, INNER, 8).fill(C.navy); // section title bar
    doc.font('Helvetica-Bold').fontSize(10).fillColor(C.white)
       .text('  Executive Assessment', MAR, y + 1, { lineBreak: false });
    y += 20;

    // Render narrative in paragraphs
    const execParas = execSummary.split(/\n\n+/);
    for (const para of execParas) {
      if (!para.trim()) continue;
      const paraText = para.replace(/\n/g, ' ').trim();
      doc.font('Helvetica').fontSize(9.5).fillColor(C.dark)
         .text(paraText, MAR, y, { width: INNER, lineBreak: true, align: 'justify' });
      y = doc.y + 8;
      if (y > PAGE_H - 80) break;
    }

    // Page footer
    drawHR(doc, PAGE_H - 46, MAR, PAGE_W - MAR, C.border);
    doc.font('Helvetica').fontSize(8).fillColor(C.muted)
       .text('Future-Ready Transformation System  ·  SME Media Group, LLC', MAR, PAGE_H - 36, { lineBreak: false })
       .text(`${clientName}  ·  ${clientCompany}  ·  FRTS-${shortId}`, PAGE_W - MAR - 220, PAGE_H - 36, { lineBreak: false });


    // ══════════════════════════════════════════════════════════════════════
    // PAGE 3 — DOMAIN BREAKDOWN + SPIKY PROFILE
    // ══════════════════════════════════════════════════════════════════════
    doc.addPage();
    y = sectionBanner(doc, MAR, MAR, INNER, 'Section 02', 'Domain Analysis & Spiky Profile', 3);

    // Domain bars
    doc.font('Helvetica-Bold').fontSize(10).fillColor(C.navy)
       .text('Performance by Domain', MAR, y);
    y += 14;

    const BAR_W = INNER - 50;
    for (const d of DOMAINS) {
      y = domainBar(doc, MAR, y, d.label, domScores[d.key], d.weight, BAR_W);
    }

    y += 8;
    drawHR(doc, y, MAR, PAGE_W - MAR, C.border);
    y += 14;

    // Domain breakdown narrative
    doc.font('Helvetica-Bold').fontSize(10).fillColor(C.navy)
       .text('Domain Detail', MAR, y);
    y += 14;

    const domainLines = domainBreak ? domainBreak.split('\n') : [];
    for (const line of domainLines) {
      if (y > PAGE_H - 80) break;
      if (line.startsWith('■')) {
        // Domain header line
        doc.font('Helvetica-Bold').fontSize(9.5).fillColor(C.navy)
           .text(line, MAR, y, { width: INNER, lineBreak: false });
        y += 14;
      } else if (line.trim()) {
        doc.font('Helvetica').fontSize(9).fillColor(C.dark)
           .text(line, MAR, y, { width: INNER, lineBreak: true });
        y = doc.y + 8;
      }
    }

    // Page footer
    drawHR(doc, PAGE_H - 46, MAR, PAGE_W - MAR, C.border);
    doc.font('Helvetica').fontSize(8).fillColor(C.muted)
       .text('Future-Ready Transformation System  ·  SME Media Group, LLC', MAR, PAGE_H - 36, { lineBreak: false })
       .text(`${clientName}  ·  ${clientCompany}  ·  FRTS-${shortId}`, PAGE_W - MAR - 220, PAGE_H - 36, { lineBreak: false });


    // ══════════════════════════════════════════════════════════════════════
    // PAGE 4 — INDUSTRY INSIGHTS + AI READINESS + 7-DAY ROADMAP
    // ══════════════════════════════════════════════════════════════════════
    doc.addPage();
    y = sectionBanner(doc, MAR, MAR, INNER, 'Section 03', 'Industry Insights, AI Readiness & 7-Day Roadmap', 4);

    // Two-column: Industry | AI Readiness
    const HALF = (INNER - 16) / 2;

    // Industry insights
    drawRect(doc, MAR, y, HALF, 14, C.navy, 3);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(C.white)
       .text('  Industry Context', MAR, y + 3, { lineBreak: false });
    y += 18;
    const industryLines = industryText.split('\n');
    let yLeft = y;
    for (const line of industryLines.slice(0, 18)) {
      if (yLeft > y + 180) break;
      doc.font('Helvetica').fontSize(8.5).fillColor(C.dark)
         .text(line || ' ', MAR, yLeft, { width: HALF - 4, lineBreak: false });
      yLeft += doc.heightOfString(line || ' ', { width: HALF - 4 }) + 3;
    }

    // AI readiness
    const AI_X = MAR + HALF + 16;
    drawRect(doc, AI_X, y - 18, HALF, 14, C.blue, 3);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(C.white)
       .text('  AI Readiness', AI_X, y - 15, { lineBreak: false });
    let yRight = y;
    const aiLines = aiText.split('\n');
    for (const line of aiLines.slice(0, 18)) {
      if (yRight > y + 180) break;
      doc.font('Helvetica').fontSize(8.5).fillColor(C.dark)
         .text(line || ' ', AI_X, yRight, { width: HALF - 4, lineBreak: false });
      yRight += doc.heightOfString(line || ' ', { width: HALF - 4 }) + 3;
    }

    y = Math.max(yLeft, yRight) + 16;
    drawHR(doc, y, MAR, PAGE_W - MAR, C.border);
    y += 14;

    // 7-Day Roadmap
    doc.font('Helvetica-Bold').fontSize(11).fillColor(C.navy)
       .text('7-Day Fix-First Roadmap', MAR, y);
    y += 16;

    const CARD_W = (INNER - 16) / 3;
    const CARDS = [
      { label: 'DAYS 1–3', title: 'Critical Priority', text: roadmap1, color: C.red },
      { label: 'DAYS 4–5', title: 'Structural Fix',    text: roadmap2, color: C.amber },
      { label: 'DAYS 6–7', title: 'Lock & Plan',       text: roadmap3, color: C.green },
    ];

    const CARD_TOP = y;
    CARDS.forEach((card, i) => {
      const cx2 = MAR + i * (CARD_W + 8);
      drawRect(doc, cx2, CARD_TOP, CARD_W, 16, card.color, 4);
      doc.font('Helvetica-Bold').fontSize(8).fillColor(C.white)
         .text(`${card.label} · ${card.title}`, cx2 + 6, CARD_TOP + 4, { lineBreak: false });

      drawRect(doc, cx2, CARD_TOP + 16, CARD_W, 130, C.light, 0);
      doc.roundedRect(cx2, CARD_TOP, CARD_W, 146, 4).lineWidth(0.5).strokeColor(C.border).stroke();

      const cardLines = (card.text || '').split('\n');
      let cy3 = CARD_TOP + 22;
      for (const line of cardLines.slice(0, 10)) {
        if (cy3 > CARD_TOP + 140) break;
        doc.font('Helvetica').fontSize(8).fillColor(C.dark)
           .text(line || ' ', cx2 + 6, cy3, { width: CARD_W - 12, lineBreak: false });
        cy3 += doc.heightOfString(line || ' ', { width: CARD_W - 12 }) + 3;
      }
    });

    // Page footer
    drawHR(doc, PAGE_H - 46, MAR, PAGE_W - MAR, C.border);
    doc.font('Helvetica').fontSize(8).fillColor(C.muted)
       .text('Future-Ready Transformation System  ·  SME Media Group, LLC', MAR, PAGE_H - 36, { lineBreak: false })
       .text(`${clientName}  ·  ${clientCompany}  ·  FRTS-${shortId}`, PAGE_W - MAR - 220, PAGE_H - 36, { lineBreak: false });


    // ══════════════════════════════════════════════════════════════════════
    // PAGE 5 — 30-DAY PLAN + NEXT STEPS CTA
    // ══════════════════════════════════════════════════════════════════════
    doc.addPage();
    y = sectionBanner(doc, MAR, MAR, INNER, 'Section 04', '30-Day Strategic Roadmap & Next Steps', 5);

    // 30-day plan
    const planParas = plan30 ? plan30.split(/\n\n+/) : [];
    for (const para of planParas) {
      if (y > PAGE_H - 200) break;
      const text = para.trim();
      if (!text) continue;

      if (text.startsWith('WEEK') || text.startsWith('30-DAY')) {
        doc.font('Helvetica-Bold').fontSize(9.5).fillColor(C.navy)
           .text(text.split('\n')[0], MAR, y, { lineBreak: false });
        y += 13;
        const rest = text.split('\n').slice(1).join('\n').trim();
        if (rest) {
          doc.font('Helvetica').fontSize(9).fillColor(C.dark)
             .text(rest, MAR, y, { width: INNER, lineBreak: true });
          y = doc.y + 8;
        }
      } else {
        doc.font('Helvetica').fontSize(9).fillColor(C.dark)
           .text(text, MAR, y, { width: INNER, lineBreak: true });
        y = doc.y + 8;
      }
    }

    y += 10;

    // CTA block
    const CTA_H = PAGE_H - y - 52;
    drawRect(doc, MAR, y, INNER, Math.max(CTA_H, 100), C.navy, 8);
    // Gold accent
    drawRect(doc, MAR, y, INNER, 4, C.gold, 4);

    doc.font('Helvetica-Bold').fontSize(17).fillColor(C.white)
       .text('Your Transformation Starts Now', MAR + 20, y + 18, { width: INNER - 40, align: 'center', lineBreak: false });
    doc.font('Helvetica').fontSize(9.5).fillColor([160, 180, 210])
       .text('You\'ve completed the assessment. Here\'s what happens next.', MAR + 20, y + 40, { width: INNER - 40, align: 'center', lineBreak: false });

    const STEPS_Y = y + 58;
    const STEPS = ['Book Strategy Debrief', 'Execute 7-Day Roadmap', 'Launch 30-Day Plan', '90-Day Re-Assessment'];
    const SW = (INNER - 60) / 4;
    STEPS.forEach((step, i) => {
      const sx = MAR + 30 + i * (SW + 10);
      drawRect(doc, sx, STEPS_Y, SW, 48, [50, 75, 115], 6);
      doc.font('Helvetica-Bold').fontSize(18).fillColor(C.gold)
         .text(String(i + 1), sx, STEPS_Y + 4, { width: SW, align: 'center', lineBreak: false });
      doc.font('Helvetica').fontSize(7.5).fillColor(C.white)
         .text(step, sx + 4, STEPS_Y + 28, { width: SW - 8, align: 'center', lineBreak: false });
    });

    doc.font('Helvetica-Bold').fontSize(10).fillColor(C.gold)
       .text('SME Media Group, LLC  ·  smemediagroup.com',
             MAR + 20, STEPS_Y + 58, { width: INNER - 40, align: 'center', lineBreak: false });

    // Final footer
    drawRect(doc, 0, PAGE_H - 38, PAGE_W, 38, C.navy);
    doc.font('Helvetica').fontSize(7.5).fillColor([120, 140, 160])
       .text(
         `© ${new Date().getFullYear()} SME Media Group, LLC  ·  Future-Ready Transformation System™  ·  Confidential  ·  Report FRTS-${shortId}`,
         MAR, PAGE_H - 24, { width: INNER, align: 'center', lineBreak: false }
       );

    doc.end();
  });

  // ── Build response ───────────────────────────────────────────────────────
  const pdfBuffer = Buffer.concat(chunks);
  const pdf_base64 = pdfBuffer.toString('base64');
  const safeName   = clientCompany.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-');
  const filename   = `FRTS-Report-${safeName}-${shortId}.pdf`;

  return res.status(200).json({
    success:    true,
    pdf_base64,
    filename,
    mime_type:  'application/pdf',
    size_kb:    Math.round(pdfBuffer.length / 1024),
    page_count: 5,
    report_id:  shortId,
  });
};
