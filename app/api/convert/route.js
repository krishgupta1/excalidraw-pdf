import { NextResponse } from 'next/server';
import chromium from '@sparticuz/chromium';
import puppeteerCore from 'puppeteer-core';
import JSON5 from 'json5';

// ---------------- Helper Functions ---------------- //

function extractBalancedJSON(text) {
  let start = text.indexOf("{");
  if (start === -1) throw new Error("No JSON object start found");
  let depth = 0; let inString = false; let stringChar = ""; let escaped = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escaped) escaped = false; else if (c === "\\") escaped = true; else if (c === stringChar) inString = false;
      continue;
    }
    if (c === '"' || c === "'") { inString = true; stringChar = c; continue; }
    if (c === "{") depth++; if (c === "}") depth--;
    if (depth === 0) return text.slice(start, i + 1);
  }
  throw new Error("Unbalanced JSON: could not recover object");
}

function getFontFamily(fontFamily) {
  return {
    1: "Virgil, Segoe UI Emoji, Apple Color Emoji, sans-serif",
    2: "Helvetica, Arial, sans-serif",
    3: "Courier New, monospace",
    4: "Georgia, serif",
    5: "Arial, sans-serif",
  }[fontFamily] || "Virgil, sans-serif";
}

function generateRoughPaths(points, roughness) {
  const paths = [];
  let main = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length; i++) {
    main += ` L ${points[i][0]} ${points[i][1]}`;
  }
  paths.push(main);
  if (roughness > 0) {
    const layers = Math.min(2, Math.ceil(roughness));
    for (let l = 0; l < layers; l++) {
      let p = `M ${points[0][0]} ${points[0][1]}`;
      for (let i = 1; i < points.length; i++) {
        const j = Math.min(roughness * 0.8, 1.2);
        p += ` L ${points[i][0] + (Math.random() - 0.5) * j} ${points[i][1] + (Math.random() - 0.5) * j}`;
      }
      paths.push(p);
    }
  }
  return paths;
}

// ---------------- Main Handler ---------------- //

export async function POST(req) {
  let browser = null;
  
  try {
    const text = await req.text();
    const cleanedText = text.replace(/^\uFEFF/, "").replace(/\0/g, "");
    const jsonText = extractBalancedJSON(cleanedText);
    const scene = JSON5.parse(jsonText);
    const elements = scene.elements || [];
    const files = scene.files || {};

    if (!elements.length) return NextResponse.json({ error: "No elements found" }, { status: 400 });

    // Calculation logic
    const minX = Math.min(...elements.map(e => e.x)) - 50;
    const minY = Math.min(...elements.map(e => e.y)) - 50;
    const maxX = Math.max(...elements.map(e => e.x + (e.width || 0))) + 50;
    const maxY = Math.max(...elements.map(e => e.y + (e.height || 0))) + 50;
    const rawWidth = maxX - minX;
    const rawHeight = maxY - minY;
    
    const MAX_WIDTH = 2000; const MAX_HEIGHT = 3000;
    const scale = Math.min(rawWidth / rawHeight > MAX_WIDTH / MAX_HEIGHT ? MAX_WIDTH / rawWidth : MAX_HEIGHT / rawHeight, 0.4);
    const width = Math.ceil(rawWidth * scale);
    const height = Math.ceil(rawHeight * scale);
    const s = v => Math.round(v * scale);
    const offsetX = -minX; const offsetY = -minY;

    function renderElement(el) {
      const base = `position:absolute;left:${s(el.x + offsetX)}px;top:${s(el.y + offsetY)}px;opacity:${(el.opacity ?? 100) / 100};`;
      if (el.type === "text") return `<div style="${base}width:${s(el.width)}px;height:${s(el.height)}px;color:${el.strokeColor};font-size:${s(el.fontSize)}px;font-family:${getFontFamily(el.fontFamily)};white-space:pre;">${el.text || ""}</div>`;
      if (el.type === "rectangle" || el.type === "ellipse") return `<div style="${base}width:${s(el.width)}px;height:${s(el.height)}px;border:${Math.max(1, s(el.strokeWidth))}px solid ${el.strokeColor};background:${el.backgroundColor || "transparent"};${el.type === "ellipse" ? "border-radius:50%;" : ""}"></div>`;
      if (el.type === "freedraw") {
        const pts = el.points; if (!pts?.length) return "";
        const xs = pts.map(p => p[0]); const ys = pts.map(p => p[1]);
        const minX = Math.min(...xs); const minY = Math.min(...ys);
        const w = Math.max(...xs) - minX; const h = Math.max(...ys) - minY;
        const paths = generateRoughPaths(pts.map(([x, y]) => [x - minX, y - minY]), el.roughness ?? 1);
        return `<svg style="position:absolute;left:${s(el.x + offsetX + minX)}px;top:${s(el.y + offsetY + minY)}px;" width="${s(w)}" height="${s(h)}" viewBox="0 0 ${w} ${h}">${paths.map(d => `<path d="${d}" fill="none" stroke="${el.strokeColor}" stroke-width="${(el.strokeWidth ?? 1) * scale}" stroke-linecap="round"/>`).join("")}</svg>`;
      }
      if (el.type === "image") { const file = files[el.fileId]; if (!file?.dataURL) return ""; return `<img style="${base}width:${s(el.width)}px;height:${s(el.height)}px;object-fit:contain;" src="${file.dataURL}" />`; }
      return "";
    }

    const htmlContent = `<html><body style="margin:0;background:${scene.appState?.viewBackgroundColor || "#fff"}"><div style="position:relative;width:${width}px;height:${height}px">${elements.map(renderElement).join("")}</div></body></html>`;

    // 🚀 VERCEL CONFIGURATION
    // Only loads the lightweight browser for Vercel
    browser = await puppeteerCore.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.setViewport({ width, height });
    await page.setContent(htmlContent);

    const pdfBuffer = await page.pdf({
      width: `${width}px`,
      height: `${height}px`,
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="converted.pdf"' },
    });

  } catch (e) {
    console.error("Vercel Conversion Error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  } finally {
    if (browser) await browser.close();
  }
}