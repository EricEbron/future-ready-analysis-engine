// ═════════════════════════════════════════════════════════════════════
// FUTURE-READY TRANSFORMATION SYSTEM — PDF GENERATOR v1.3.0
// SME Media Group, LLC | Clarksville, TN
// Endpoint: POST /api/generate-pdf
//
// Stack: pdfkit (pure Node.js — Vercel Hobby compatible)
// Storage: Vercel Blob (public URL returned, no base64 in response)
//
// v1.3.0 changes:
//   - Password watermark printed on PDF cover page
//   - Returns blob_url (Vercel Blob) — no pdf_base64 in response
//   - Domain_WorkforceFinancial replaces Domain_CognitiveDiversity
//   - SubmissionId threaded through to filename + report footer
//   - DebriefPath echoed in response for Zapier routing
//   - CORS restricted to Zapier origins
//
// Input: All fields from futureready-analyze.js response
// Output:
//   { success:true, blob_url, filename, pdf_password, debrief_path,
//     submission_id, size_kb, page_count }
// ═════════════════════════════════════════════════════════════════════

'use strict';

const PDFDocument = require('pdfkit');
const { put }     = require('@vercel/blob');

// ─── CORS ─────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = ['https://hooks.zapier.com', 'https://zapier.com'];

// ─── BRAND COLORS ─────────────────────────────────────────────────────────
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

// ─── TIER CONFIG ──────────────────────────────────────────────────────────
const TIER_CONFIG = {
  'Critical':   { color: C.red    },
  'At Risk':    { color: C.amber  },
  'Developing': { color: C.blue   },
  'Strong':     { color: C.green  },
  'Optimized':  { color: C.purple },
};

// ─── DOMAIN CONFIG ────────────────────────────────────────────────────────
const DOMAINS = [
  { key: 'Domain_Leadership',            label: 'Leadership Clarity & Alignment',    weight: '25%' },
  { key: 'Domain_OperationalStability',  label: 'Operational Stability & Workflow',  weight: '25%' },
  { key: 'Domain_WorkforceFinancial',    label: 'Workforce & Financial Health',       weight: '20%' },
  { key: 'Domain_TechAI',                label: 'Technology & AI Integration',        weight: '15%' },
  { key: 'Domain_Momentum',              label: 'Leadership Momentum & Adaptability', weight: '15%' },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────
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

// ─── PDF DRAW HELPERS ─────────────────────────────────────────────────────
function drawHR(doc, y, x1, x2) {
  doc.moveTo(x1, y).lineTo(x2, y).lineWidth(0.5).strokeColor(C.border).stroke();
}

function sectionBanner(doc, x, y, w, label, title, pageNum, total) {
  doc.rect(x, y, w, 36).fill(C.navy);
  doc.rect(x, y, 4, 36).fill(C.gold);
  doc.font('Helvetica').fontSize(7).fillColor(C.gold)
     .text(label.toUpperCase(), x + 12, y + 6, { lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(13).fillColor(C.white)
     .text(title, x + 12, y + 17, { lineBreak: false });
  doc.font('Helvetica').fontSize(7.5).fillColor([160, 180, 200])
     .text(`Page ${pageNum} of ${total}`, x + w - 58, y + 14, { lineBreak: false });
  return y + 50;
}

function pageFooter(doc, MAR, PW, PH, name, company, shortId) {
  drawHR(doc, PH - 44, MAR, PW - MAR);
  doc.font('Helvetica').fontSize(7.5).fillColor(C.muted)
     .text('Future-Ready Transformation System  ·  SME Media Group, LLC',
           MAR, PH - 34, { lineBreak: false });
  doc.font('Helvetica').fontSize(7.5).fillColor(C.muted)
     .text(`${name}  ·  ${company}  ·  FRTS-${shortId}`,
           PW - MAR - 240, PH - 34, { lineBreak: false });
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
  return y + 22;
}

function wrapBlock(doc, text, x, y, width, maxH) {
  if (!text) return y;
  const lines = String(text).split('\n');
  for (const line of lines) {
    if (maxH && y > maxH) break;
    const txt  = line.trim();
    const bold = txt.startsWith('■') || txt.startsWith('WEEK') ||
                 txt.startsWith('PRIORITY') || txt.startsWith('30-DAY') ||
                 txt.startsWith('DAY');
    if (!txt) { y += 5; continue; }
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica')
       .fontSize(9).fillColor(bold ? C.navy : C.dark)
       .text(txt, x, y, { width, lineBreak: false });
    y += doc.heightOfString(txt, { width }) + 3;
  }
  return y + 4;
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  const origin = req.headers['origin'] || '';
  res.setHeader('Access-Control-Allow-Origin',
    ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')
    return res.status(405).json({ success: false, error: 'Method not allowed.' });

  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.FRTS_API_KEY)
    return res.status(401).json({ success: false, error: 'Unauthorized.' });

  let body = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  } catch (e) {
    return res.status(400).json({ success: false, error: 'Invalid JSON.' });
  }

  // ── Extract fields ────────────────────────────────────────────────────
  const clientName    = clean(body.Client_Name    || body.name    || body.respondent_name, 'Participant');
  const clientCompany = clean(body.Client_Company || body.company || body.company_name,    'Your Organization');
  const clientTitle   = clean(body.Client_Title   || body.title,   '');
  const industry      = clean(body.Client_Industry|| body.industry,'General Business');

  const frs         = num(body.FutureReadyScore       || body.total_score, 0);
  const iss         = num(body.IndustryStabilityScore, 0);
  const tier        = clean(body.FutureReadyTier || body.Tier || tierFromScore(frs));
  const tierCfg     = TIER_CONFIG[tier] || TIER_CONFIG['Developing'];
  const pdfPassword = clean(body.PDFPassword, '');
  const debriefPath = clean(body.DebriefPath || body.Client_Debrief, 'NotRightNow');
  const submissionId = clean(body.SubmissionId || body.submission_id, '');
  const shortId      = submissionId.replace('FRTS-', '').slice(0, 8) ||
                       Math.random().toString(36).slice(2, 10).toUpperCase();

  // Domain scores with M1-M5 fallback
  const domScores = {};
  const fallbacks  = { Domain_Leadership: 'M1', Domain_OperationalStability: 'M2',
                       Domain_WorkforceFinancial: 'M3', Domain_TechAI: 'M4', Domain_Momentum: 'M5' };
  for (const d of DOMAINS) {
    domScores[d.key] = num(body[d.key] || body[fallbacks[d.key]], 0);
  }

  const strength1   = clean(body.Strength1,   '');
  const strength2   = clean(body.Strength2,   '');
  const strength3   = clean(body.Strength3,   '');
  const bottleneck1 = clean(body.Bottleneck1, '');
  const bottleneck2 = clean(body.Bottleneck2, '');
  const bottleneck3 = clean(body.Bottleneck3, '');

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

  // ── Build PDF ─────────────────────────────────────────────────────────
  const PW = 612, PH = 792, MAR = 52, INNER = PW - MAR * 2, PAGES = 5;

  const doc = new PDFDocument({
    size: [PW, PH],
    margins: { top: MAR, bottom: MAR, left: MAR, right: MAR },
    info: {
      Title:   `Future-Ready Assessment — ${clientCompany}`,
      Author:  'SME Media Group, LLC',
      Subject: 'Future-Ready Transformation Score Report',
      Creator: 'FRTS v1.3.0',
    },
    autoFirstPage: false,
  });

  const chunks = [];
  doc.on('data', c => chunks.push(c));

  await new Promise((resolve, reject) => {
    doc.on('end', resolve);
    doc.on('error', reject);

    // ════════════════════════════════════════════════════════════════════
    // PAGE 1 — COVER
    // ════════════════════════════════════════════════════════════════════
    doc.addPage();

    doc.rect(0, 0, PW, 190).fill(C.navy);
    doc.rect(0, 0, PW, 5).fill(C.gold);

    doc.font('Helvetica-Bold').fontSize(10).fillColor(C.gold)
       .text('SME MEDIA GROUP, LLC', MAR, 20, { characterSpacing: 2, lineBreak: false });
    doc.font('Helvetica').fontSize(8.5).fillColor([160, 180, 200])
       .text('Future-Ready Transformation System', MAR, 34, { lineBreak: false });

    // Confidential badge
    doc.roundedRect(PW - MAR - 110, 20, 110, 20, 3).fill([50, 70, 105]);
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor([180, 200, 220])
       .text('CONFIDENTIAL', PW - MAR - 98, 26, { lineBreak: false });

    // Password box (gold, top right — prominent)
    if (pdfPassword) {
      doc.roundedRect(PW - MAR - 130, 46, 130, 34, 4).fill(C.gold);
      doc.font('Helvetica-Bold').fontSize(7).fillColor(C.navy)
         .text('REPORT PASSWORD', PW - MAR - 122, 53, { lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(15).fillColor(C.navy)
         .text(pdfPassword, PW - MAR - 122, 63, { lineBreak: false });
    }

    // Main title
    doc.font('Helvetica-Bold').fontSize(30).fillColor(C.white)
       .text('Future-Ready', MAR, 66, { lineBreak: false });
    doc.font('Helvetica').fontSize(30).fillColor(C.gold)
       .text('  Assessment', MAR + 200, 66, { lineBreak: false });
    doc.font('Helvetica').fontSize(11).fillColor([180, 200, 220])
       .text('Workplace Transformation Score Report', MAR, 104, { lineBreak: false });
    doc.rect(MAR, 124, INNER, 2).fill(C.gold);

    doc.font('Helvetica-Bold').fontSize(17).fillColor(C.white)
       .text(clientCompany, MAR, 134, { width: INNER - 130, lineBreak: false });
    doc.font('Helvetica').fontSize(9.5).fillColor([160, 180, 200])
       .text(clientTitle ? `${clientName}  ·  ${clientTitle}` : clientName,
             MAR, 157, { lineBreak: false });

    let y = 206;

    // Score circle
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

    y += 112;
    drawHR(doc, y, MAR, PW - MAR);
    y += 14;

    // Mini domain bars
    doc.font('Helvetica-Bold').fontSize(10).fillColor(C.navy).text('Domain Overview', MAR, y);
    y += 14;
    const MIBAR = INNER - 58;
    for (const d of DOMAINS) {
      const sc  = domScores[d.key];
      const pct = Math.min(Math.max(sc, 0), 100) / 100;
      doc.font('Helvetica').fontSize(8.5).fillColor(C.dark)
         .text(d.label, MAR, y, { width: 186, lineBreak: false });
      doc.roundedRect(MAR + 190, y + 2, MIBAR - 140, 7, 2).fill(C.border);
      if (pct > 0) doc.roundedRect(MAR + 190, y + 2, (MIBAR - 140) * pct, 7, 2).fill(domainColor(sc));
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(domainColor(sc))
         .text(`${sc}`, PW - MAR - 28, y, { lineBreak: false });
      y += 17;
    }

    y += 8; drawHR(doc, y, MAR, PW - MAR); y += 12;

    // Strengths & Bottlenecks
    const cW = (INNER - 14) / 2, c2x = MAR + cW + 14;
    if (strength1) {
      doc.font('Helvetica-Bold').fontSize(9).fillColor(C.green).text('▲  TOP STRENGTHS', MAR, y);
      let sy = y + 13;
      [strength1, strength2, strength3].filter(Boolean).forEach(s => {
        doc.circle(MAR + 4, sy + 5, 2.5).fill(C.green);
        doc.font('Helvetica').fontSize(8.5).fillColor(C.dark)
           .text(s.length > 58 ? s.slice(0, 55) + '…' : s, MAR + 12, sy, { width: cW - 14, lineBreak: false });
        sy += 14;
      });
    }
    if (bottleneck1) {
      doc.font('Helvetica-Bold').fontSize(9).fillColor(C.red).text('▼  PRIORITY GAPS', c2x, y);
      let by = y + 13;
      [bottleneck1, bottleneck2, bottleneck3].filter(Boolean).forEach(b => {
        doc.circle(c2x + 4, by + 5, 2.5).fill(C.red);
        doc.font('Helvetica').fontSize(8.5).fillColor(C.dark)
           .text(b.length > 58 ? b.slice(0, 55) + '…' : b, c2x + 12, by, { width: cW - 14, lineBreak: false });
        by += 14;
      });
    }

    // Cover footer
    doc.rect(0, PH - 36, PW, 36).fill(C.navy);
    doc.font('Helvetica').fontSize(7.5).fillColor([140, 165, 195])
       .text(`Prepared by SME Media Group, LLC  ·  ${reportDate}  ·  FRTS-${shortId}  ·  Internal Use Only`,
             MAR, PH - 22, { width: INNER, align: 'center', lineBreak: false });


    // ════════════════════════════════════════════════════════════════════
    // PAGE 2 — EXECUTIVE SUMMARY
    // ════════════════════════════════════════════════════════════════════
    doc.addPage();
    y = sectionBanner(doc, MAR, MAR, INNER, 'Section 01', 'Executive Summary', 2, PAGES);

    const W3 = (INNER - 20) / 3;
    // Box 1: FRS
    doc.roundedRect(MAR, y, W3, 62, 5).fill(C.light);
    doc.roundedRect(MAR, y, W3, 62, 5).lineWidth(1).strokeColor(C.border).stroke();
    doc.font('Helvetica').fontSize(7.5).fillColor(C.muted).text('FUTURE-READY SCORE', MAR + 8, y + 9, { lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(30).fillColor(tierCfg.color).text(String(frs), MAR + 8, y + 22, { lineBreak: false });

    // Box 2: Tier
    const B2X = MAR + W3 + 10;
    doc.roundedRect(B2X, y, W3, 62, 5).fill(tierCfg.color);
    doc.font('Helvetica').fontSize(7.5).fillColor(C.white).text('PERFORMANCE TIER', B2X + 8, y + 9, { lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(20).fillColor(C.white).text(tier, B2X + 8, y + 25, { lineBreak: false });

    // Box 3: ISS
    const B3X = MAR + (W3 + 10) * 2;
    doc.roundedRect(B3X, y, W3, 62, 5).fill(C.light);
    doc.roundedRect(B3X, y, W3, 62, 5).lineWidth(1).strokeColor(C.border).stroke();
    doc.font('Helvetica').fontSize(7.5).fillColor(C.muted).text('STABILITY SCORE', B3X + 8, y + 9, { lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(30).fillColor(C.navy).text(String(iss), B3X + 8, y + 22, { lineBreak: false });

    y += 76;

    if (strength1) {
      doc.font('Helvetica-Bold').fontSize(9).fillColor(C.green).text('▲ Strengths', MAR, y);
      y += 12;
      [strength1, strength2, strength3].filter(Boolean).forEach(s => {
        doc.roundedRect(MAR, y, INNER / 2 - 8, 14, 7).fill([209, 250, 229]);
        doc.font('Helvetica-Bold').fontSize(8).fillColor([6, 95, 70])
           .text(`✓  ${s.length > 80 ? s.slice(0, 77) + '…' : s}`, MAR + 8, y + 3, { lineBreak: false });
        y += 18;
      });
    }
    if (bottleneck1) {
      y += 4;
      doc.font('Helvetica-Bold').fontSize(9).fillColor(C.red).text('▼ Priority Gaps', MAR, y);
      y += 12;
      [bottleneck1, bottleneck2, bottleneck3].filter(Boolean).forEach(b => {
        doc.roundedRect(MAR, y, INNER / 2 - 8, 14, 7).fill([254, 226, 226]);
        doc.font('Helvetica-Bold').fontSize(8).fillColor([153, 27, 27])
           .text(`⚠  ${b.length > 80 ? b.slice(0, 77) + '…' : b}`, MAR + 8, y + 3, { lineBreak: false });
        y += 18;
      });
    }

    y += 10; drawHR(doc, y, MAR, PW - MAR); y += 12;
    doc.rect(MAR, y, INNER, 12).fill(C.navy);
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.white)
       .text('  Executive Assessment', MAR, y + 2, { lineBreak: false });
    y += 18;
    y = wrapBlock(doc, execSummary, MAR, y, INNER, PH - 60);
    pageFooter(doc, MAR, PW, PH, clientName, clientCompany, shortId);


    // ════════════════════════════════════════════════════════════════════
    // PAGE 3 — DOMAIN ANALYSIS
    // ════════════════════════════════════════════════════════════════════
    doc.addPage();
    y = sectionBanner(doc, MAR, MAR, INNER, 'Section 02', 'Domain Analysis', 3, PAGES);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(C.navy).text('Performance by Domain', MAR, y);
    y += 14;
    const BAR_W = INNER - 58;
    for (const d of DOMAINS) {
      y = domainBarRow(doc, MAR, y, d.label, domScores[d.key], d.weight, BAR_W);
    }
    y += 8; drawHR(doc, y, MAR, PW - MAR); y += 12;
    doc.font('Helvetica-Bold').fontSize(10).fillColor(C.navy).text('Domain Detail', MAR, y);
    y += 14;
    y = wrapBlock(doc, domainBreak, MAR, y, INNER, PH - 60);
    pageFooter(doc, MAR, PW, PH, clientName, clientCompany, shortId);


    // ════════════════════════════════════════════════════════════════════
    // PAGE 4 — INDUSTRY INSIGHTS + AI + 7-DAY ROADMAP
    // ════════════════════════════════════════════════════════════════════
    doc.addPage();
    y = sectionBanner(doc, MAR, MAR, INNER, 'Section 03', 'Industry Insights, AI Readiness & 7-Day Roadmap', 4, PAGES);

    const HALF = (INNER - 16) / 2, AIX = MAR + HALF + 16;
    doc.rect(MAR, y - 2, HALF, 12).fill(C.navy);
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.white).text('  Industry Context', MAR, y, { lineBreak: false });
    doc.rect(AIX, y - 2, HALF, 12).fill(C.blue);
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.white).text('  AI Readiness', AIX, y, { lineBreak: false });
    y += 16;

    const iLines = (industryText || '').split('\n');
    const aLines = (aiText || '').split('\n');
    let yL = y, yR = y;
    const colMax = y + 185;
    iLines.forEach(l => { if (yL > colMax) return; doc.font('Helvetica').fontSize(8.5).fillColor(C.dark).text(l.trim() || ' ', MAR, yL, { width: HALF - 4, lineBreak: false }); yL += doc.heightOfString(l.trim() || ' ', { width: HALF - 4 }) + 3; });
    aLines.forEach(l => { if (yR > colMax) return; doc.font('Helvetica').fontSize(8.5).fillColor(C.dark).text(l.trim() || ' ', AIX, yR, { width: HALF - 4, lineBreak: false }); yR += doc.heightOfString(l.trim() || ' ', { width: HALF - 4 }) + 3; });
    y = Math.max(yL, yR) + 14;
    drawHR(doc, y, MAR, PW - MAR); y += 12;

    // 7-Day roadmap cards
    doc.font('Helvetica-Bold').fontSize(10).fillColor(C.navy).text('7-Day Fix-First Roadmap', MAR, y);
    y += 14;
    const CW3 = (INNER - 16) / 3;
    const RMAP = [
      { label: 'DAYS 1–3', title: 'Critical Priority', text: roadmap1, color: C.red   },
      { label: 'DAYS 4–5', title: 'Structural Fix',    text: roadmap2, color: C.amber },
      { label: 'DAYS 6–7', title: 'Lock & Plan Ahead', text: roadmap3, color: C.green },
    ];
    const CT = y;
    RMAP.forEach((card, i) => {
      const cx = MAR + i * (CW3 + 8);
      doc.rect(cx, CT, CW3, 14).fill(card.color);
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.white)
         .text(`${card.label}  ·  ${card.title}`, cx + 5, CT + 3, { lineBreak: false });
      doc.roundedRect(cx, CT + 14, CW3, 138, 0).fill(C.light);
      doc.roundedRect(cx, CT, CW3, 152, 3).lineWidth(0.5).strokeColor(C.border).stroke();
      let cy = CT + 20;
      (card.text || '').split('\n').slice(0, 12).forEach(l => {
        if (cy > CT + 148) return;
        doc.font('Helvetica').fontSize(7.5).fillColor(C.dark)
           .text(l.trim() || ' ', cx + 6, cy, { width: CW3 - 12, lineBreak: false });
        cy += doc.heightOfString(l.trim() || ' ', { width: CW3 - 12 }) + 2;
      });
    });
    pageFooter(doc, MAR, PW, PH, clientName, clientCompany, shortId);


    // ════════════════════════════════════════════════════════════════════
    // PAGE 5 — 30-DAY PLAN + CTA
    // ════════════════════════════════════════════════════════════════════
    doc.addPage();
    y = sectionBanner(doc, MAR, MAR, INNER, 'Section 04', '30-Day Strategic Roadmap & Next Steps', 5, PAGES);
    y = wrapBlock(doc, plan30, MAR, y, INNER, PH - 205);
    y += 8;

    const CTA_Y = Math.max(y + 8, PH - 195);
    const CTA_H = PH - CTA_Y - 46;
    doc.roundedRect(MAR, CTA_Y, INNER, CTA_H, 8).fill(C.navy);
    doc.rect(MAR, CTA_Y, INNER, 4).fill(C.gold);
    doc.font('Helvetica-Bold').fontSize(16).fillColor(C.white)
       .text('Your Transformation Starts Now', MAR + 20, CTA_Y + 16, { width: INNER - 40, align: 'center', lineBreak: false });
    doc.font('Helvetica').fontSize(9).fillColor([160, 180, 210])
       .text("You completed the assessment. Here's what happens next.",
             MAR + 20, CTA_Y + 37, { width: INNER - 40, align: 'center', lineBreak: false });

    const SY = CTA_Y + 56;
    const SW = (INNER - 60) / 4;
    [{ n:'1', l:'Book Strategy\nDebrief' }, { n:'2', l:'Execute 7-Day\nRoadmap' },
     { n:'3', l:'Launch 30-Day\nPlan'    }, { n:'4', l:'90-Day\nRe-Assessment' }]
    .forEach((s, i) => {
      const sx = MAR + 30 + i * (SW + 10);
      doc.roundedRect(sx, SY, SW, 50, 5).fill([50, 75, 115]);
      doc.font('Helvetica-Bold').fontSize(20).fillColor(C.gold).text(s.n, sx, SY + 5, { width: SW, align: 'center', lineBreak: false });
      doc.font('Helvetica').fontSize(7.5).fillColor(C.white).text(s.l, sx + 4, SY + 30, { width: SW - 8, align: 'center', lineBreak: false });
    });
    doc.font('Helvetica-Bold').fontSize(9).fillColor(C.gold)
       .text('SME Media Group, LLC  ·  smemediagroup.com',
             MAR + 20, SY + 58, { width: INNER - 40, align: 'center', lineBreak: false });

    doc.rect(0, PH - 36, PW, 36).fill(C.navy);
    doc.font('Helvetica').fontSize(7.5).fillColor([120, 140, 165])
       .text(`© ${new Date().getFullYear()} SME Media Group, LLC  ·  Future-Ready Transformation System™  ·  Confidential  ·  FRTS-${shortId}`,
             MAR, PH - 22, { width: INNER, align: 'center', lineBreak: false });

    doc.end();
  });

  // ── Upload to Vercel Blob ─────────────────────────────────────────────
  const pdfBuffer = Buffer.concat(chunks);
  const safeName  = clientCompany.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').slice(0, 30);
  const filename  = `FRTS-Report-${safeName}-${shortId}.pdf`;

  let blobUrl;
  try {
    const blob = await put(`reports/${filename}`, pdfBuffer, {
      access: 'public', contentType: 'application/pdf',
    });
    blobUrl = blob.url;
  } catch (blobErr) {
    console.error('[FRTS PDF] Blob upload failed:', blobErr.message);
    return res.status(500).json({ success: false, error: 'PDF generated but upload failed.', detail: blobErr.message });
  }

  return res.status(200).json({
    success:       true,
    blob_url:      blobUrl,
    filename,
    pdf_password:  pdfPassword,
    debrief_path:  debriefPath,
    submission_id: submissionId,
    mime_type:     'application/pdf',
    size_kb:       Math.round(pdfBuffer.length / 1024),
    page_count:    PAGES,
  });
};
