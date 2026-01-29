export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import JSON5 from 'json5';

// ---------------- Helper Functions ---------------- //

function extractBalancedJSON(text: string) {
  let start = text.indexOf('{');
  if (start === -1) throw new Error('No JSON object start found');

  let depth = 0;
  let inString = false;
  let stringChar = '';
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const c = text[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === stringChar) inString = false;
      continue;
    }

    if (c === '"' || c === "'") {
      inString = true;
      stringChar = c;
      continue;
    }

    if (c === '{') depth++;
    if (c === '}') depth--;

    if (depth === 0) return text.slice(start, i + 1);
  }

  throw new Error('Unbalanced JSON');
}

function getFontFamily(element: any, customFonts: Map<string, string>) {
  const defaultFonts = {
    1: 'Virgil, Kalam, Caveat, "Comic Neue", "Comic Sans MS", "Marker Felt", cursive',
    2: 'Helvetica, Arial, sans-serif',
    3: 'Courier New, monospace',
    4: 'Georgia, serif',
    5: 'Arial, sans-serif',
  } as Record<number, string>;
  
  // Create a unique key for this element's font configuration
  const fontKey = element.customFontFamily ? 
    `${element.fontFamily}-${element.customFontFamily}` : 
    `${element.fontFamily}`;
  
  const resolvedFont = customFonts.get(fontKey) || defaultFonts[element.fontFamily] || 'Virgil, Kalam, Caveat, "Comic Neue", cursive';
  
  // For fontFamily 1 (Virgil), always force handwritten styling
  if (element.fontFamily === 1) {
    return 'Virgil, Kalam, Caveat, "Comic Neue", "Comic Sans MS", "Marker Felt", cursive';
  }
  
  return resolvedFont;
}

function extractCustomFonts(elements: any[]) {
  const customFonts = new Map<string, string>();
  const fontFamilyMap: Record<number, string> = {
    1: 'Virgil',
    2: 'Helvetica',
    3: 'Courier New',
    4: 'Georgia',
    5: 'Arial',
  };
  
  const googleFontUrls = new Set<string>();
  
  elements.forEach(el => {
    if (el.type === 'text') {
      // Handle custom font family if provided
      if (el.fontFamily && el.customFontFamily) {
        const customFont = el.customFontFamily;
        const fontKey = `${el.fontFamily}-${customFont}`;
        customFonts.set(fontKey, `${customFont}, ${fontFamilyMap[el.fontFamily] || 'sans-serif'}`);
        
        // Add Google Font if it looks like a web font
        if (customFont) {
          // Common web fonts that are likely available on Google Fonts
          const commonWebFonts = [
            'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 
            'Raleway', 'Nunito', 'Ubuntu', 'Playfair Display', 'Merriweather',
            'Oswald', 'Source Sans Pro', 'Slabo', 'Oxygen', 'Bitter', 'PT Sans'
          ];
          
          // Check if it's a common web font or looks like one (single word, no special chars)
          if (commonWebFonts.includes(customFont) || /^[a-zA-Z]+$/.test(customFont)) {
            const fontName = customFont.replace(/\s+/g, '+');
            googleFontUrls.add(`https://fonts.googleapis.com/css2?family=${fontName}:wght@400;700&display=swap`);
          }
        }
      }
      
      // Handle cases where font family might be stored as a string directly
      if (el.fontFamily && typeof el.fontFamily === 'string') {
        customFonts.set(el.fontFamily, el.fontFamily);
      }
    }
  });
  
  return { customFonts, googleFontUrls: Array.from(googleFontUrls) };
}

function generateRoughPaths(points: number[][], roughness: number) {
  const paths: string[] = [];

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

export async function POST(req: NextRequest) {
  let browser: any;
  let page: any;

  try {
    // 1. Parse input
    const rawText = await req.text();
    const cleaned = rawText.replace(/^\uFEFF/, '').replace(/\0/g, '');
    const jsonText = extractBalancedJSON(cleaned);
    const scene = JSON5.parse(jsonText);

    const elements = scene.elements || [];
    const files = scene.files || {};

    if (!elements.length) {
      return NextResponse.json({ error: 'No elements found' }, { status: 400 });
    }

    // Extract custom fonts from the file
    const { customFonts, googleFontUrls } = extractCustomFonts(elements);

    // 2. Calculate bounds
    const minX = Math.min(...elements.map((e: any) => e.x)) - 50;
    const minY = Math.min(...elements.map((e: any) => e.y)) - 50;
    const maxX = Math.max(...elements.map((e: any) => e.x + (e.width || 0))) + 50;
    const maxY = Math.max(...elements.map((e: any) => e.y + (e.height || 0))) + 50;

    const rawWidth = maxX - minX;
    const rawHeight = maxY - minY;

    const MAX_WIDTH = 2000;
    const MAX_HEIGHT = 3000;

    const scale = Math.min(
      rawWidth / rawHeight > MAX_WIDTH / MAX_HEIGHT
        ? MAX_WIDTH / rawWidth
        : MAX_HEIGHT / rawHeight,
      0.4
    );

    const width = Math.ceil(rawWidth * scale);
    const height = Math.ceil(rawHeight * scale);

    const s = (v: number) => Math.round(v * scale);
    const offsetX = -minX;
    const offsetY = -minY;

    // 3. Render HTML
    function renderElement(el: any) {
      const base = `position:absolute;left:${s(el.x + offsetX)}px;top:${s(
        el.y + offsetY
      )}px;opacity:${(el.opacity ?? 100) / 100};`;

      if (el.type === 'text') {
        const fontFamily = getFontFamily(el, customFonts);
        const isHandwritten = el.fontFamily === 1;
        
        return `<div style="${base}width:${s(el.width)}px;height:${s(
          el.height
        )}px;color:${el.strokeColor};font-size:${s(
          el.fontSize
        )}px;font-family:${fontFamily};${isHandwritten ? 'font-style:normal;font-weight:normal;' : ''}white-space:pre;">${
          el.text || ''
        }</div>`;
      }

      if (el.type === 'rectangle' || el.type === 'ellipse') {
        return `<div style="${base}width:${s(el.width)}px;height:${s(
          el.height
        )}px;border:${Math.max(1, s(el.strokeWidth))}px solid ${
          el.strokeColor
        };background:${el.backgroundColor || 'transparent'};${
          el.type === 'ellipse' ? 'border-radius:50%;' : ''
        }"></div>`;
      }

      if (el.type === 'freedraw') {
        const pts = el.points;
        if (!pts?.length) return '';

        const xs = pts.map((p: any) => p[0]);
        const ys = pts.map((p: any) => p[1]);

        const minPX = Math.min(...xs);
        const minPY = Math.min(...ys);
        const w = Math.max(...xs) - minPX;
        const h = Math.max(...ys) - minPY;

        const paths = generateRoughPaths(
          pts.map(([x, y]: any) => [x - minPX, y - minPY]),
          el.roughness ?? 1
        );

        return `<svg style="position:absolute;left:${s(
          el.x + offsetX + minPX
        )}px;top:${s(el.y + offsetY + minPY)}px;" width="${s(
          w
        )}" height="${s(h)}" viewBox="0 0 ${w} ${h}">
          ${paths
            .map(
              (d) =>
                `<path d="${d}" fill="none" stroke="${el.strokeColor}" stroke-width="${
                  (el.strokeWidth ?? 1) * scale
                }" stroke-linecap="round" />`
            )
            .join('')}
        </svg>`;
      }

      if (el.type === 'image') {
        const file = files[el.fileId];
        if (!file?.dataURL) return '';
        return `<img style="${base}width:${s(el.width)}px;height:${s(
          el.height
        )}px;object-fit:contain;" src="${file.dataURL}" />`;
      }

      return '';
    }

    const googleFontLinks = googleFontUrls.map(url => `<link rel="stylesheet" href="${url}">`).join('\n');
    
    const html = `
      <html>
        <head>
          <style>body{margin:0;padding:0;}</style>
          ${googleFontLinks}
          <style>
            /* Force handwritten styling for all text elements */
            * {
              -webkit-font-smoothing: antialiased;
              -moz-osx-font-smoothing: grayscale;
            }
            
            /* Font loading fallbacks - Multiple sources for Virgil */
            @font-face {
              font-family: 'Virgil';
              src: local('Virgil'), 
                   url('https://cdn.jsdelivr.net/gh/excalidraw/excalidraw@master/packages/excalidraw/assets/font/Virgil.woff2') format('woff2'),
                   url('https://cdn.jsdelivr.net/gh/excalidraw/excalidraw@master/packages/excalidraw/assets/font/Virgil.woff') format('woff'),
                   url('https://raw.githubusercontent.com/excalidraw/excalidraw/master/packages/excalidraw/assets/font/Virgil.woff2') format('woff2'),
                   url('https://raw.githubusercontent.com/excalidraw/excalidraw/master/packages/excalidraw/assets/font/Virgil.woff') format('woff'),
                   local('Comic Sans MS'), local('Marker Felt'), local('Bradley Hand'), cursive;
              font-weight: normal;
              font-style: normal;
              font-display: swap;
            }
            
            /* Load Comic Neue as strong fallback for handwritten look */
            @import url('https://fonts.googleapis.com/css2?family=Comic+Neue:wght@400;700&display=swap');
            
            /* Additional handwritten fallbacks */
            @import url('https://fonts.googleapis.com/css2?family=Kalam:wght@400;700&display=swap');
            @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&display=swap');
            
            /* Ensure fonts are loaded */
            body {
              font-display: swap;
            }
            
            /* Force handwritten styling for text elements */
            div[style*="font-family"] {
              font-family: 'Virgil', 'Kalam', 'Caveat', 'Comic Neue', 'Comic Sans MS', 'Marker Felt', cursive !important;
            }
            
            /* Specific override for elements that should be handwritten */
            .handwritten {
              font-family: 'Virgil', 'Kalam', 'Caveat', 'Comic Neue', 'Comic Sans MS', 'Marker Felt', cursive !important;
            }
          </style>
        </head>
        <body style="background:${scene.appState?.viewBackgroundColor || '#fff'}">
          <div style="position:relative;width:${width}px;height:${height}px">
            ${elements.map(renderElement).join('')}
          </div>
          <script>
            // Enhanced font loading detection with debugging
            function waitForFonts() {
              console.log('Starting font loading detection...');
              
              if (document.fonts && document.fonts.ready) {
                console.log('Using document.fonts.ready API');
                return document.fonts.ready.then(function() {
                  console.log('document.fonts.ready resolved');
                  // Additional wait for font rendering
                  return new Promise(resolve => setTimeout(resolve, 1000));
                });
              } else {
                console.log('Using fallback timeout');
                // Fallback for older browsers
                return new Promise(resolve => setTimeout(resolve, 4000));
              }
            }
            
            // Force handwritten styling on all text elements
            function forceHandwrittenStyling() {
              console.log('Forcing handwritten styling on all text elements...');
              const allDivs = document.querySelectorAll('div[style*="font-family"]');
              console.log('Found', allDivs.length, 'text elements to style');
              
              allDivs.forEach((div, index) => {
                const currentStyle = div.getAttribute('style');
                console.log('Element', index, 'current style:', currentStyle);
                
                // Force handwritten font family
                const newStyle = currentStyle.replace(/font-family:[^;]*/g, 'font-family: Virgil, Kalam, Caveat, "Comic Neue", "Comic Sans MS", "Marker Felt", cursive');
                div.setAttribute('style', newStyle);
                
                console.log('Element', index, 'updated style:', newStyle);
              });
            }
            
            waitForFonts().then(function() {
              console.log('Fonts loaded, applying handwritten styling...');
              forceHandwrittenStyling();
              
              document.body.classList.add('fonts-loaded');
              console.log('Fonts loaded and ready - PDF generation can proceed');
              
              // Debug: Log available fonts
              if (document.fonts) {
                console.log('Available fonts:', Array.from(document.fonts).map(f => f.family));
              }
            }).catch(function(error) {
              console.error('Font loading error:', error);
              forceHandwrittenStyling(); // Force styling even on error
              document.body.classList.add('fonts-loaded');
            });
          </script>
        </body>
      </html>
    `;

    // 4. Launch browser
    if (process.env.NODE_ENV === 'production') {
      const chromium = (await import('@sparticuz/chromium')).default;
      const puppeteer = (await import('puppeteer-core')).default;

      const executablePath = await chromium.executablePath();
      if (!executablePath) throw new Error('Chromium executable not found');

      browser = await puppeteer.launch({
        args: chromium.args,
        executablePath,
        headless: chromium.headless,
      });
    } else {
      const puppeteer = (await import('puppeteer')).default;
      browser = await puppeteer.launch({ headless: true });
    }

    // 5. PDF
    page = await browser.newPage();
    await page.setViewport({ width, height });
    
    // Enable console logging from the page
    page.on('console', (msg: any) => {
      console.log('PAGE LOG:', msg.text());
    });
    
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    // Wait for fonts to load
    try {
      await page.waitForFunction(
        () => document.body.classList.contains('fonts-loaded'),
        { timeout: 10000 }
      );
      console.log('Font loading completed successfully');
    } catch (e) {
      // If font loading times out, continue anyway
      console.warn('Font loading timeout, proceeding with PDF generation:', e);
    }
    
    // Additional wait to ensure fonts are rendered
    await new Promise(resolve => setTimeout(resolve, 2000));

    const pdf = await page.pdf({
      width: `${width}px`,
      height: `${height}px`,
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    await page.close();
    await browser.close();

    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="converted.pdf"',
      },
    });
  } catch (err: any) {
    if (page && !page.isClosed()) await page.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});

    console.error(err);
    return NextResponse.json(
      { error: err.message ?? 'PDF generation failed' },
      { status: 500 }
    );
  }
}
