// ═════════════════════════════════════════════════════════════════════
// FUTURE-READY TRANSFORMATION SYSTEM — PDF GENERATOR v1.3.0
// SME Media Group, LLC | Clarksville, TN
// Endpoint: POST /api/generate-pdf
//
// Stack: pdfkit (pure Node.js — Vercel Hobby compatible)
// Storage: pdf_base64 returned in response → Zapier uploads to Google Drive
//
// v1.3.0 changes:
//   - Password-protected PDF watermark + PDFPassword echoed in response
//   - Returns pdf_base64 in response (Vercel Blob removed — private store conflict)
//   - Domain_WorkforceFinancial replaces Domain_CognitiveDiversity
//   - SubmissionId threaded through to filename + report footer
//   - DebriefPath echoed in response for Zapier routing
//   - CORS restricted to Zapier origins
//
// Input: All fields from futureready-analyze.js response + SubmissionId
// Output:
//   { success:true, pdf_base64, filename, pdf_password, debrief_path,
//     submission_id, size_kb, page_count }
// ═════════════════════════════════════════════════════════════════════

const { put } = require('@vercel/blob');
'use strict';

const PDFDocument = require('pdfkit');

// ─── CORS ────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = ['https://hooks.zapier.com', 'https://zapier.com'];

// ─── BRAND COLORS (RGB arrays for pdfkit) ────────────────────────────────────
const C = {
  navy:   [30,  58,  95],
  gold:   [201, 168, 76],
  green:  [5,   150, 105],
  blue:   [37,  99,  235],
  amber:  [217, 119, 6],
  red:    [220, 38,  38],
  purple: [124, 58,  237],
  dark:   [30,  41,  59],
  muted:  [100, 116, 139],
  light:  [248, 250, 252],
  border: [226, 232, 240],
  white:  [255, 255, 255],
};

// ─── TIER CONFIG ─────────────────────────────────────────────────────────────
const TIER_CONFIG = {
  'Critical':   { color: C.red,    label: 'Critical'   },
  'At Risk':    { color: C.amber,  label: 'At Risk'    },
  'Developing': { color: C.blue,   label: 'Developing' },
  'Strong':     { color: C.green,  label: 'Strong'     },
  'Optimized':  { color: C.purple, label: 'Optimized'  },
};

const DOMAINS = [
  { key: 'Domain_Leadership',            label: 'Leadership Clarity & Alignment',    weight: '25%' },
  { key: 'Domain_OperationalStability',  label: 'Operational Stability & Workflow',  weight: '25%' },
  { key: 'Domain_WorkforceFinancial',    label: 'Workforce & Financial Health',       weight: '20%' },
  { key: 'Domain_TechAI',                label: 'Technology & AI Integration',        weight: '15%' },
  { key: 'Domain_Momentum',              label: 'Leadership Momentum & Adaptability', weight: '15%' },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function clean(val, fallback = '') {
  if (val === null || val === undefined) return fallback;
  return String(val).trim();
}
function num(val, fallback = 0) {
  const n = parseFloat(val);
  return isNaN(n) ? fallback : Math.round(n);
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

// ─── PDF DRAWING HELPERS ─────────────────────────────────────────────────────
function drawHR(doc, y, x1, x2, color = C.border) {
  doc.moveTo(x1, y).lineTo(x2, y).lineWidth(0.5).strokeColor(color).stroke();
}

function sectionBanner(doc, x, y, w, label, title, pageNum, totalPages) {
  doc.rect(x, y, w, 36).fill(C.navy);
  doc.rect(x, y, 4, 36).fill(C.gold);
  doc.font('Helvetica').fontSize(7).fillColor(C.gold)
     .text(label.toUpperCase(), x + 12, y + 6, { lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(13).fillColor(C.white)
     .text(title, x + 12, y + 16, { lineBreak: false });
  doc.font('Helvetica').fontSize(7.5).fillColor([160, 180, 200])
     .text(`Page ${pageNum} of ${totalPages}`, x + w - 58, y + 14, { lineBreak: false });
  return y + 50;
}

function pageFooter(doc, MAR, PAGE_W, PAGE_H, clientName, clientCompany, shortId) {
  drawHR(doc, PAGE_H - 44, MAR, PAGE_W - MAR, C.border);
  doc.font('Helvetica').fontSize(7.5).fillColor(C.muted)
     .text('Future-Ready Transformation System  ·  SME Media Group, LLC',
           MAR, PAGE_H - 34, { lineBreak: false });
  doc.font('Helvetica').fontSize(7.5).fillColor(C.muted)
     .text(`${clientName}  ·  ${clientCompany}  ·  FRTS-${shortId}`,
           PAGE_W - MAR - 240, PAGE_H - 34, { lineBreak: false });
}

function domainBarRow(doc, x, y, label, score, weight, barWidth) {
  const pct   = Math.min(Math.max(num(score), 0), 100) / 100;
  const color = domainColor(num(score));
  doc.font('Helvetica-Bold').fontSize(9).fillColor(C.dark)
     .text(label, x, y, { width: 190, lineBreak: false });
  doc.font('Helvetica').fontSize(7.5).fillColor(C.muted)
     .text(`(${weight})`, x + 194, y + 1, { lineBreak: false });
  y += 13;
  doc.roundedRect(x, y, barWidth, 9, 2).fill(C.border);
  if (pct > 0) doc.roundedRect(x, y, barWidth * pct, 9, 2).fill(color);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(color)
     .text(`${num(score)}`, x + barWidth + 6, y, { lineBreak: false });
  return y + 9 + 12;
}

function wrapBlock(doc, text, x, y, width, opts = {}) {
  if (!text) return y;
  const { font = 'Helvetica', size = 9.5, color = C.dark, maxH } = opts;
  const paras = String(text).split(/\n\n+/);
  for (const para of paras) {
    if (!para.trim()) continue;
    if (maxH && y > maxH) break;
    const lines = para.split('\n');
    for (const line of lines) {
      if (maxH && y > maxH) break;
      const txt = line.trim();
      if (!txt) { y += 4; continue; }
      // Bold domain header lines
      const isBold = txt.startsWith('■') || txt.startsWith('WEEK') || txt.startsWith('PRIORITY') || txt.startsWith('30-DAY');
      doc.font(isBold ? 'Helvetica-Bold' : font)
         .fontSize(size).fillColor(isBold ? C.navy : color)
         .text(txt, x, y, { width, lineBreak: false });
      y += doc.heightOfString(txt, { width }) + 2;
    }
    y += 6;
  }
  return y;
}

// ─── MAIN HANDLER ────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  // CORS
  const origin = req.headers['origin'] || '';
  res.setHeader('Access-Control-Allow-Origin',
    ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')
    return res.status(405).json({ success: false, error: 'Method not allowed.' });

  // Auth
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.FRTS_API_KEY)
    return res.status(401).json({ success: false, error: 'Unauthorized: invalid x-api-key.' });

  // Parse body
  let body = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  } catch (e) {
    return res.status(400).json({ success: false, error: 'Invalid JSON body.' });
  }

  // ── Extract fields ──────────────────────────────────────────────────────
  const clientName    = clean(body.Client_Name    || body.name    || body.respondent_name, 'Assessment Participant');
  const clientCompany = clean(body.Client_Company || body.company || body.company_name,    'Your Organization');
  const clientTitle   = clean(body.Client_Title   || body.title,   '');
  const clientEmail   = clean(body.Client_Email   || body.email,   '');
  const industry      = clean(body.Client_Industry|| body.industry,'General Business');

  const frs         = num(body.FutureReadyScore          || body.total_score, 0);
  const iss         = num(body.IndustryStabilityScore,     0);
  const tier        = clean(body.FutureReadyTier || body.Tier || tierFromScore(frs));
  const tierCfg     = TIER_CONFIG[tier] || TIER_CONFIG['Developing'];
  const pdfPassword = clean(body.PDFPassword, '');        // passed from scoring engine
  const debriefPath = clean(body.DebriefPath || body.Client_Debrief, 'NotRightNow');
  const submissionId = clean(body.SubmissionId || body.submission_id, '');
  const shortId      = submissionId.replace('FRTS-', '').slice(0, 8) || 
                       Math.random().toString(36).slice(2, 10).toUpperCase();

  // Domain scores
  const domScores = {};
  for (const d of DOMAINS) {
    // Support both new key and legacy M1-M5 fallback
    const legacyMap = { Domain_Leadership: 'M1', Domain_OperationalStability: 'M2',
                        Domain_WorkforceFinancial: 'M3', Domain_TechAI: 'M4', Domain_Momentum: 'M5' };
    domScores[d.key] = num(body[d.key] || body[legacyMap[d.key]], 0);
  }

  // Strengths / Bottlenecks
  const strength1   = clean(body.Strength1,   '');
  const strength2   = clean(body.Strength2,   '');
  const strength3   = clean(body.Strength3,   '');
  const bottleneck1 = clean(body.Bottleneck1, '');
  const bottleneck2 = clean(body.Bottleneck2, '');
  const bottleneck3 = clean(body.Bottleneck3, '');

  // Narrative fields
  const execSummary  = clean(body.Narrative_ExecutiveSummary, 'Executive summary not available.');
  const domainBreak  = clean(body.Narrative_DomainBreakdown,  '');
  const industryText = clean(body.IndustryInsights,           '');
  const aiText       = clean(body.AIReadinessSummary,         '');
  const roadmap1     = clean(body.Roadmap_Day1_3,             '');
  const roadmap2     = clean(body.Roadmap_Day4_5,             '');
  const roadmap3     = clean(body.Roadmap_Day6_7,             '');
  const plan30       = clean(body.Facilitator_30DayPlan,       '');

  const reportDate = new Date().toLocaleDateString('en-US',
    { year: 'numeric', month: 'long', day: 'numeric' });

  // ── Build PDF ───────────────────────────────────────────────────────────
  const PAGE_W  = 612;
  const PAGE_H  = 792;
  const MAR     = 52;
  const INNER   = PAGE_W - MAR * 2;   // 508
  const TOTAL_PAGES = 5;

  const doc = new PDFDocument({
    size:    [PAGE_W, PAGE_H],
    margins: { top: MAR, bottom: MAR, left: MAR, right: MAR },
    info: {
      Title:   `Future-Ready Assessment — ${clientCompany}`,
      Author:  'SME Media Group, LLC',
      Subject: 'Future-Ready Transformation Score Report — Confidential',
      Creator: 'FRTS v1.3.0',
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

    // Full navy header
    doc.rect(0, 0, PAGE_W, 190).fill(C.navy);
    // Gold top accent bar
    doc.rect(0, 0, PAGE_W, 5).fill(C.gold);

    // Brand
    doc.font('Helvetica-Bold').fontSize(10).fillColor(C.gold)
       .text('SME MEDIA GROUP, LLC', MAR, 20, { characterSpacing: 2, lineBreak: false });
    doc.font('Helvetica').fontSize(8.5).fillColor([160, 180, 200])
       .text('Future-Ready Transformation System', MAR, 34, { lineBreak: false });

    // Confidential badge
    doc.roundedRect(PAGE_W - MAR - 110, 20, 110, 20, 3).fill([50, 70, 105]);
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor([180, 200, 220])
       .text('🔒 CONFIDENTIAL', PAGE_W - MAR - 100, 26, { lineBreak: false });

    // Password notice — prominent on cover
    if (pdfPassword) {
      doc.roundedRect(PAGE_W - MAR - 110, 45, 110, 28, 3).fill(C.gold);
      doc.font('Helvetica-Bold').fontSize(7).fillColor(C.navy)
         .text('REPORT PASSWORD', PAGE_W - MAR - 100, 51, { lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(13).fillColor(C.navy)
         .text(pdfPassword, PAGE_W - MAR - 100, 60, { lineBreak: false });
    }

    // Title block
    doc.font('Helvetica-Bold').fontSize(30).fillColor(C.white)
       .text('Future-Ready', MAR, 65, { lineBreak: false });
    doc.font('Helvetica').fontSize(30).fillColor(C.gold)
       .text('  Assessment', MAR + 195, 65, { lineBreak: false });
    doc.font('Helvetica').fontSize(11).fillColor([180, 200, 220])
       .text('Workplace Transformation Score Report', MAR, 103, { lineBreak: false });

    // Gold divider
    doc.rect(MAR, 124, INNER, 2).fill(C.gold);

    // Client name
    doc.font('Helvetica-Bold').fontSize(17).fillColor(C.white)
       .text(clientCompany, MAR, 134, { width: INNER - 120, lineBreak: false });
    doc.font('Helvetica').fontSize(9.5).fillColor([160, 180, 200])
       .text(clientTitle ? `${clientName}  ·  ${clientTitle}` : clientName,
             MAR, 157, { lineBreak: false });

    let y = 205;

    // ── Score + Tier block ────────────────────────────────────────────────
    // Left panel: score circle (pdfkit-native)
    const CX = MAR + 52, CY = y + 50, R = 44;
    doc.circle(CX, CY, R + 7).fill(C.light);
    doc.circle(CX, CY, R).lineWidth(7).strokeColor(C.border).stroke();
    doc.circle(CX, CY, R).lineWidth(7).strokeColor(tierCfg.color).stroke();
    doc.font('Helvetica-Bold').fontSize(26).fillColor(tierCfg.color)
       .text(String(frs), CX - R, CY - 16, { width: R * 2, align: 'center', lineBreak: false });
    doc.font('Helvetica').fontSize(8).fillColor(C.muted)
       .text('out of 100', CX - R, CY + 12, { width: R * 2, align: 'center', lineBreak: false });

    // Tier badge
    doc.roundedRect(MAR + 115, y + 26, 175, 38, 6).fill(tierCfg.color);
    doc.font('Helvetica-Bold').fontSize(19).fillColor(C.white)
       .text(tier, MAR + 115, y + 37, { width: 175, align: 'center', lineBreak: false });

    // ISS
    doc.font('Helvetica').fontSize(8).fillColor(C.muted)
       .text('STABILITY SCORE', MAR + 308, y + 26, { lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(26).fillColor(C.navy)
       .text(String(iss), MAR + 308, y + 38, { lineBreak: false });
    doc.font('Helvetica').fontSize(8).fillColor(C.muted)
       .text('/ 100', MAR + 308 + doc.widthOfString(String(iss), { fontSize: 26 }) + 3, y + 52, { lineBreak: false });

    y += 110;
    drawHR(doc, y, MAR, PAGE_W - MAR, C.border);
    y += 14;

    // ── Domain mini-bars on cover ─────────────────────────────────────────
    doc.font('Helvetica-Bold').fontSize(10).fillColor(C.navy)
       .text('Domain Overview', MAR, y);
    y += 14;

    const MINI_W = INNER - 60;
    for (const d of DOMAINS) {
      const sc  = domScores[d.key];
      const pct = Math.min(Math.max(sc, 0), 100) / 100;
      const col = domainColor(sc);
      doc.font('Helvetica').fontSize(8.5).fillColor(C.dark)
         .text(d.label, MAR, y, { width: 188, lineBreak: false });
      doc.roundedRect(MAR + 192, y + 2, MINI_W - 142, 7, 2).fill(C.border);
      if (pct > 0) doc.roundedRect(MAR + 192, y + 2, (MINI_W - 142) * pct, 7, 2).fill(col);
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(col)
         .text(`${sc}`, PAGE_W - MAR - 28, y, { lineBreak: false });
      y += 17;
    }

    y += 8;
    drawHR(doc, y, MAR, PAGE_W - MAR, C.border);
    y += 12;

    // ── Strengths & Bottlenecks ───────────────────────────────────────────
    const colW   = (INNER - 16) / 2;
    const col2x  = MAR + colW + 16;

    if (strength1) {
      doc.font('Helvetica-Bold').fontSize(9).fillColor(C.green)
         .text('▲  TOP STRENGTHS', MAR, y);
      let sy = y + 13;
      [strength1, strength2, strength3].filter(Boolean).slice(0, 3).forEach(s => {
        const txt = s.length > 55 ? s.slice(0, 52) + '…' : s;
        doc.circle(MAR + 4, sy + 5, 2.5).fill(C.green);
        doc.font('Helvetica').fontSize(8.5).fillColor(C.dark)
           .text(txt, MAR + 12, sy, { width: colW - 14, lineBreak: false });
        sy += 14;
      });
    }

    if (bottleneck1) {
      doc.font('Helvetica-Bold').fontSize(9).fillColor(C.red)
         .text('▼  PRIORITY GAPS', col2x, y);
      let by = y + 13;
      [bottleneck1, bottleneck2, bottleneck3].filter(Boolean).slice(0, 3).forEach(b => {
        const txt = b.length > 55 ? b.slice(0, 52) + '…' : b;
        doc.circle(col2x + 4, by + 5, 2.5).fill(C.red);
        doc.font('Helvetica').fontSize(8.5).fillColor(C.dark)
           .text(txt, col2x + 12, by, { width: colW - 14, lineBreak: false });
        by += 14;
      });
    }

    // Cover footer
    doc.rect(0, PAGE_H - 36, PAGE_W, 36).fill(C.navy);
    doc.font('Helvetica').fontSize(7.5).fillColor([140, 165, 195])
       .text(
         `Prepared by SME Media Group, LLC  ·  ${reportDate}  ·  Submission: FRTS-${shortId}  ·  Internal Use Only`,
         MAR, PAGE_H - 22, { width: INNER, align: 'center', lineBreak: false }
       );


    // ══════════════════════════════════════════════════════════════════════
    // PAGE 2 — EXECUTIVE SUMMARY
    // ══════════════════════════════════════════════════════════════════════
    doc.addPage();
    y = sectionBanner(doc, MAR, MAR, INNER, 'Section 01', 'Executive Summary', 2, TOTAL_PAGES);

    // Score widget row
    const W3 = (INNER - 20) / 3;
    // Box 1: FRS
    doc.roundedRect(MAR, y, W3, 62, 5).fill(C.light);
    doc.roundedRect(MAR, y, W3, 62, 5).lineWidth(1).strokeColor(C.border).stroke();
    doc.font('Helvetica').fontSize(7.5).fillColor(C.muted)
       .text('FUTURE-READY SCORE', MAR + 8, y + 9, { lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(30).fillColor(tierCfg.color)
       .text(String(frs), MAR + 8, y + 22, { lineBreak: false });
    doc.font('Helvetica').fontSize(8).fillColor(C.muted)
       .text('/100', MAR + 8 + doc.widthOfString(String(frs), { fontSize: 30 }) + 3, y + 36, { lineBreak: false });

    // Box 2: Tier
    const B2X = MAR + W3 + 10;
    doc.roundedRect(B2X, y, W3, 62, 5).fill(tierCfg.color);
    doc.font('Helvetica').fontSize(7.5).fillColor(C.white)
       .text('PERFORMANCE TIER', B2X + 8, y + 9, { lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(21).fillColor(C.white)
       .text(tier, B2X + 8, y + 25, { lineBreak: false });

    // Box 3: ISS
    const B3X = MAR + (W3 + 10) * 2;
    doc.roundedRect(B3X, y, W3, 62, 5).fill(C.light);
    doc.roundedRect(B3X, y, W3, 62, 5).lineWidth(1).strokeColor(C.border).stroke();
    doc.font('Helvetica').fontSize(7.5).fillColor(C.muted)
       .text('STABILITY SCORE', B3X + 8, y + 9, { lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(30).fillColor(C.navy)
       .text(String(iss), B3X + 8, y + 22, { lineBreak: false });
    doc.font('Helvetica').fontSize(8).fillColor(C.muted)
       .text('/100', B3X + 8 + doc.widthOfString(String(iss), { fontSize: 30 }) + 3, y + 36, { lineBreak: false });

    y += 76;

    // Strengths / Bottleneck tags
    if (strength1) {
      doc.font('Helvetica-Bold').fontSize(9).fillColor(C.green).text('▲ Strengths', MAR, y);
      y += 12;
      [strength1, strength2, strength3].filter(Boolean).forEach(s => {
        const txt = s.length > 80 ? s.slice(0, 77) + '…' : s;
        doc.roundedRect(MAR, y, INNER / 2 - 8, 14, 7).fill([209, 250, 229]);
        doc.font('Helvetica-Bold').fontSize(8).fillColor([6, 95, 70])
           .text(`✓  ${txt}`, MAR + 8, y + 3, { lineBreak: false });
        y += 18;
      });
    }
    if (bottleneck1) {
      y += 4;
      doc.font('Helvetica-Bold').fontSize(9).fillColor(C.red).text('▼ Priority Gaps', MAR, y);
      y += 12;
      [bottleneck1, bottleneck2, bottleneck3].filter(Boolean).forEach(b => {
        const txt = b.length > 80 ? b.slice(0, 77) + '…' : b;
        doc.roundedRect(MAR, y, INNER / 2 - 8, 14, 7).fill([254, 226, 226]);
        doc.font('Helvetica-Bold').fontSize(8).fillColor([153, 27, 27])
           .text(`⚠  ${txt}`, MAR + 8, y + 3, { lineBreak: false });
        y += 18;
      });
    }

    y += 10;
    drawHR(doc, y, MAR, PAGE_W - MAR, C.border);
    y += 12;

    // Executive narrative
    doc.rect(MAR, y, INNER, 12).fill(C.navy);
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.white)
       .text('  Executive Assessment', MAR, y + 2, { lineBreak: false });
    y += 18;
    y = wrapBlock(doc, execSummary, MAR, y, INNER, { size: 9.5, maxH: PAGE_H - 60 });

    pageFooter(doc, MAR, PAGE_W, PAGE_H, clientName, clientCompany, shortId);


    // ══════════════════════════════════════════════════════════════════════
    // PAGE 3 — DOMAIN ANALYSIS
    // ══════════════════════════════════════════════════════════════════════
    doc.addPage();
    y = sectionBanner(doc, MAR, MAR, INNER, 'Section 02', 'Domain Analysis', 3, TOTAL_PAGES);

    doc.font('Helvetica-Bold').fontSize(10).fillColor(C.navy)
       .text('Performance by Domain', MAR, y);
    y += 14;

    const BAR_W = INNER - 58;
    for (const d of DOMAINS) {
      y = domainBarRow(doc, MAR, y, d.label, domScores[d.key], d.weight, BAR_W);
    }

    y += 8;
    drawHR(doc, y, MAR, PAGE_W - MAR, C.border);
    y += 12;

    doc.font('Helvetica-Bold').fontSize(10).fillColor(C.navy)
       .text('Domain Detail', MAR, y);
    y += 14;
    y = wrapBlock(doc, domainBreak, MAR, y, INNER, { size: 9, maxH: PAGE_H - 60 });

    pageFooter(doc, MAR, PAGE_W, PAGE_H, clientName, clientCompany, shortId);


    // ══════════════════════════════════════════════════════════════════════
    // PAGE 4 — INDUSTRY INSIGHTS + AI READINESS + 7-DAY ROADMAP
    // ══════════════════════════════════════════════════════════════════════
    doc.addPage();
    y = sectionBanner(doc, MAR, MAR, INNER, 'Section 03', 'Industry Insights, AI Readiness & 7-Day Roadmap', 4, TOTAL_PAGES);

    // Two-column: Industry | AI
    const HALF = (INNER - 16) / 2;
    const AI_X = MAR + HALF + 16;

    doc.rect(MAR,  y - 2, HALF, 12).fill(C.navy);
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.white)
       .text('  Industry Context', MAR, y, { lineBreak: false });
    doc.rect(AI_X, y - 2, HALF, 12).fill(C.blue);
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.white)
       .text('  AI Readiness', AI_X, y, { lineBreak: false });
    y += 16;

    // Render columns independently, track each y
    const industryLines = (industryText || '').split('\n');
    const aiLines       = (aiText || '').split('\n');
    const maxLines      = Math.max(industryLines.length, aiLines.length);
    let yL = y, yR = y;
    const COL_MAX_H = y + 190;
    for (let i = 0; i < industryLines.length; i++) {
      if (yL > COL_MAX_H) break;
      const l = industryLines[i].trim();
      doc.font(l.startsWith('Industry:') || l.startsWith('Benchmark') ? 'Helvetica-Bold' : 'Helvetica')
         .fontSize(8.5).fillColor(C.dark)
         .text(l || ' ', MAR, yL, { width: HALF - 4, lineBreak: false });
      yL += doc.heightOfString(l || ' ', { width: HALF - 4 }) + 3;
    }
    for (let i = 0; i < aiLines.length; i++) {
      if (yR > COL_MAX_H) break;
      const l = aiLines[i].trim();
      doc.font(l.startsWith('AI Readiness') || l.startsWith('Recommended') ? 'Helvetica-Bold' : 'Helvetica')
         .fontSize(8.5).fillColor(C.dark)
         .text(l || ' ', AI_X, yR, { width: HALF - 4, lineBreak: false });
      yR += doc.heightOfString(l || ' ', { width: HALF - 4 }) + 3;
    }

    y = Math.max(yL, yR) + 14;
    drawHR(doc, y, MAR, PAGE_W - MAR, C.border);
    y += 12;

    // 7-Day Roadmap cards
    doc.font('Helvetica-Bold').fontSize(10).fillColor(C.navy)
       .text('7-Day Fix-First Roadmap', MAR, y);
    y += 14;

    const CARD_W = (INNER - 16) / 3;
    const CARDS  = [
      { label: 'DAYS 1–3', title: 'Critical Priority',    text: roadmap1, color: C.red   },
      { label: 'DAYS 4–5', title: 'Structural Fix',       text: roadmap2, color: C.amber },
      { label: 'DAYS 6–7', title: 'Lock In & Plan Ahead', text: roadmap3, color: C.green },
    ];
    const CARD_TOP = y;
    CARDS.forEach((card, i) => {
      const cx = MAR + i * (CARD_W + 8);
      doc.rect(cx, CARD_TOP, CARD_W, 14).fill(card.color);
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.white)
         .text(`${card.label}  ·  ${card.title}`, cx + 5, CARD_TOP + 3, { lineBreak: false });
      doc.roundedRect(cx, CARD_TOP + 14, CARD_W, 138, 0).fill(C.light);
      doc.roundedRect(cx, CARD_TOP, CARD_W, 152, 3).lineWidth(0.5).strokeColor(C.border).stroke();
      const cardLines = (card.text || '').split('\n');
      let cy = CARD_TOP + 19;
      for (const line of cardLines.slice(0, 12)) {
        if (cy > CARD_TOP + 148) break;
        doc.font('Helvetica').fontSize(7.5).fillColor(C.dark)
           .text(line.trim() || ' ', cx + 6, cy, { width: CARD_W - 12, lineBreak: false });
        cy += doc.heightOfString(line.trim() || ' ', { width: CARD_W - 12 }) + 2;
      }
    });

    pageFooter(doc, MAR, PAGE_W, PAGE_H, clientName, clientCompany, shortId);


    // ══════════════════════════════════════════════════════════════════════
    // PAGE 5 — 30-DAY PLAN + CTA
    // ══════════════════════════════════════════════════════════════════════
    doc.addPage();
    y = sectionBanner(doc, MAR, MAR, INNER, 'Section 04', '30-Day Strategic Roadmap & Next Steps', 5, TOTAL_PAGES);

    y = wrapBlock(doc, plan30, MAR, y, INNER, { size: 9, maxH: PAGE_H - 210 });
    y += 8;

    // CTA block
    const CTA_Y  = Math.max(y + 8, PAGE_H - 190);
    const CTA_H  = PAGE_H - CTA_Y - 46;
    doc.roundedRect(MAR, CTA_Y, INNER, CTA_H, 8).fill(C.navy);
    doc.rect(MAR, CTA_Y, INNER, 4).fill(C.gold);

    doc.font('Helvetica-Bold').fontSize(16).fillColor(C.white)
       .text('Your Transformation Starts Now', MAR + 20, CTA_Y + 16,
             { width: INNER - 40, align: 'center', lineBreak: false });
    doc.font('Helvetica').fontSize(9).fillColor([160, 180, 210])
       .text('You completed the assessment. Here\'s what happens next.',
             MAR + 20, CTA_Y + 37, { width: INNER - 40, align: 'center', lineBreak: false });

    const STEPS_Y = CTA_Y + 56;
    const STEPS   = [
      { num: '1', label: 'Book Strategy\nDebrief' },
      { num: '2', label: 'Execute 7-Day\nRoadmap'  },
      { num: '3', label: 'Launch 30-Day\nPlan'      },
      { num: '4', label: '90-Day\nRe-Assessment'   },
    ];
    const SW = (INNER - 60) / 4;
    STEPS.forEach((step, i) => {
      const sx = MAR + 30 + i * (SW + 10);
      doc.roundedRect(sx, STEPS_Y, SW, 50, 5).fill([50, 75, 115]);
      doc.font('Helvetica-Bold').fontSize(20).fillColor(C.gold)
         .text(step.num, sx, STEPS_Y + 5, { width: SW, align: 'center', lineBreak: false });
      doc.font('Helvetica').fontSize(7.5).fillColor(C.white)
         .text(step.label, sx + 4, STEPS_Y + 30, { width: SW - 8, align: 'center', lineBreak: false });
    });

    doc.font('Helvetica-Bold').fontSize(9).fillColor(C.gold)
       .text('SME Media Group, LLC  ·  smemediagroup.com',
             MAR + 20, STEPS_Y + 58, { width: INNER - 40, align: 'center', lineBreak: false });

    // Final footer
    doc.rect(0, PAGE_H - 36, PAGE_W, 36).fill(C.navy);
    doc.font('Helvetica').fontSize(7.5).fillColor([120, 140, 165])
       .text(
         `© ${new Date().getFullYear()} SME Media Group, LLC  ·  Future-Ready Transformation System™  ·  Confidential  ·  FRTS-${shortId}`,
         MAR, PAGE_H - 22, { width: INNER, align: 'center', lineBreak: false }
       );

    doc.end();
  });

  const pdfBuffer = Buffer.concat(chunks);
  const filename = `FRTS-Report-${clientCompany.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 20)}-${shortId}.pdf`;

    let blob;
  try {
        blob = await put(filename, pdfBuffer, {
  access: 'public',
  contentType: 'application/pdf',
  addRandomSuffix: false,
  token: process.env.PDF_BLOB_READ_WRITE_TOKEN,
});
  } catch (blobErr) {
    return res.status(500).json({
      success: false,
      error: 'Blob upload failed',
      detail: blobErr.message || String(blobErr),
    });
  }

  return res.status(200).json({
    success:       true,
    downloadUrl:   blob.url,
    filename:      filename,
    pdf_password:  pdfPassword,
    debrief_path:  debriefPath,
    submission_id: submissionId,
  });

  };
