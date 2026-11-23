import JSZip from 'jszip';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const M_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/math';

const UNICODE_TO_LATEX: Record<string, string> = {
  '×': '\\times ',
  '÷': '\\div ',
  '±': '\\pm ',
  '∓': '\\mp ',
  '·': '\\cdot ',
  '≤': '\\le ',
  '≥': '\\ge ',
  '≠': '\\ne ',
  '≈': '\\approx ',
  '≡': '\\equiv ',
  '∞': '\\infty ',
  '√': '\\sqrt',
  '∫': '\\int ',
  '∬': '\\iint ',
  '∭': '\\iiint ',
  '∮': '\\oint ',
  '∑': '\\sum ',
  '∏': '\\prod ',
  '∂': '\\partial ',
  '∇': '\\nabla ',
  '∈': '\\in ',
  '∉': '\\notin ',
  '⊂': '\\subset ',
  '⊆': '\\subseteq ',
  '⊃': '\\supset ',
  '⊇': '\\supseteq ',
  '∪': '\\cup ',
  '∩': '\\cap ',
  '∅': '\\emptyset ',
  '∀': '\\forall ',
  '∃': '\\exists ',
  '¬': '\\neg ',
  '∧': '\\land ',
  '∨': '\\lor ',
  '⇒': '\\Rightarrow ',
  '⇔': '\\Leftrightarrow ',
  '→': '\\rightarrow ',
  '←': '\\leftarrow ',
  '↔': '\\leftrightarrow ',
  '∠': '\\angle ',
  '⊥': '\\perp ',
  '∥': '\\parallel ',
  '△': '\\triangle ',
  '≅': '\\cong ',
  '∼': '\\sim ',
  '°': '^\\circ ',
  '′': "'",
  '″': "''",
  'α': '\\alpha ',
  'β': '\\beta ',
  'γ': '\\gamma ',
  'δ': '\\delta ',
  'ε': '\\varepsilon ',
  'ζ': '\\zeta ',
  'η': '\\eta ',
  'θ': '\\theta ',
  'κ': '\\kappa ',
  'λ': '\\lambda ',
  'μ': '\\mu ',
  'ν': '\\nu ',
  'ξ': '\\xi ',
  'π': '\\pi ',
  'ρ': '\\rho ',
  'σ': '\\sigma ',
  'τ': '\\tau ',
  'φ': '\\varphi ',
  'χ': '\\chi ',
  'ψ': '\\psi ',
  'ω': '\\omega ',
  'Γ': '\\Gamma ',
  'Δ': '\\Delta ',
  'Θ': '\\Theta ',
  'Λ': '\\Lambda ',
  'Σ': '\\Sigma ',
  'Φ': '\\Phi ',
  'Ψ': '\\Psi ',
  'Ω': '\\Omega ',
  '−': '-',
  '–': '-',
};

function getLocalName(node: Element): string {
  return node.localName || node.nodeName.replace(/^.*:/, '');
}

function getDirectChild(parent: Element, localName: string): Element | null {
  for (const child of Array.from(parent.children)) {
    if (getLocalName(child) === localName) return child;
  }
  return null;
}

function getDirectChildren(parent: Element, localName: string): Element[] {
  return Array.from(parent.children).filter((child) => getLocalName(child) === localName);
}

function getAttrVal(el: Element | null, attrName = 'val'): string {
  if (!el) return '';
  return (
    el.getAttribute(`m:${attrName}`) ||
    el.getAttribute(`w:${attrName}`) ||
    el.getAttribute(attrName) ||
    ''
  );
}

function mapMathText(raw: string): string {
  let out = '';
  for (const ch of raw) {
    out += UNICODE_TO_LATEX[ch] ?? ch;
  }
  return out;
}

function convertChildren(node: Element | null): string {
  if (!node) return '';
  return Array.from(node.children).map(convertOmmlNode).join('');
}

function wrapBracesIfNeeded(tex: string): string {
  const clean = tex.trim();
  if (!clean) return '{}';
  return `{${clean}}`;
}

function convertNaryChar(ch: string): string {
  switch (ch) {
    case '∑':
      return '\\sum';
    case '∏':
      return '\\prod';
    case '∐':
      return '\\coprod';
    case '∫':
    case '':
      return '\\int';
    case '∬':
      return '\\iint';
    case '∭':
      return '\\iiint';
    case '∮':
      return '\\oint';
    case '⋃':
    case '∪':
      return '\\bigcup';
    case '⋂':
    case '∩':
      return '\\bigcap';
    case '⋁':
      return '\\bigvee';
    case '⋀':
      return '\\bigwedge';
    default:
      return UNICODE_TO_LATEX[ch]?.trim() || '\\int';
  }
}

function convertDelimiterPair(begChr: string, endChr: string): [string, string] {
  const mapOpen = (c: string) => {
    if (!c) return '(';
    if (c === '{') return '\\{';
    if (c === '|') return '|';
    if (c === '‖') return '\\|';
    if (c === '[') return '[';
    if (c === '(') return '(';
    if (c === '⟨') return '\\langle ';
    return c;
  };
  const mapClose = (c: string) => {
    if (!c) return ')';
    if (c === '}') return '\\}';
    if (c === '|') return '|';
    if (c === '‖') return '\\|';
    if (c === ']') return ']';
    if (c === ')') return ')';
    if (c === '⟩') return '\\rangle ';
    return c;
  };
  return [mapOpen(begChr), mapClose(endChr)];
}

function convertOmmlNode(node: Element): string {
  const name = getLocalName(node);

  switch (name) {
    case 'oMathPara':
    case 'oMath':
    case 'e':
    case 'num':
    case 'den':
    case 'deg':
    case 'sub':
    case 'sup':
    case 'lim':
    case 'fName':
    case 'box':
      return convertChildren(node);

    case 'r': {
      let text = '';
      for (const child of Array.from(node.children)) {
        const cn = getLocalName(child);
        if (cn === 't') {
          text += mapMathText(child.textContent || '');
        }
      }
      return text;
    }

    case 't':
      return mapMathText(node.textContent || '');

    case 'f': {
      const fPr = getDirectChild(node, 'fPr');
      const fType = getAttrVal(getDirectChild(fPr as Element, 'type'));
      const num = convertChildren(getDirectChild(node, 'num')).trim();
      const den = convertChildren(getDirectChild(node, 'den')).trim();
      if (fType === 'noBar') {
        return `\\binom{${num}}{${den}}`;
      }
      if (fType === 'lin') {
        return `${num}/${den}`;
      }
      return `\\frac{${num}}{${den}}`;
    }

    case 'rad': {
      const deg = convertChildren(getDirectChild(node, 'deg')).trim();
      const expr = convertChildren(getDirectChild(node, 'e')).trim();
      if (deg) {
        return `\\sqrt[${deg}]{${expr}}`;
      }
      return `\\sqrt{${expr}}`;
    }

    case 'sSup': {
      const base = convertChildren(getDirectChild(node, 'e')).trim();
      const sup = convertChildren(getDirectChild(node, 'sup')).trim();
      return `${base}^${wrapBracesIfNeeded(sup)}`;
    }

    case 'sSub': {
      const base = convertChildren(getDirectChild(node, 'e')).trim();
      const sub = convertChildren(getDirectChild(node, 'sub')).trim();
      return `${base}_${wrapBracesIfNeeded(sub)}`;
    }

    case 'sSubSup': {
      const base = convertChildren(getDirectChild(node, 'e')).trim();
      const sub = convertChildren(getDirectChild(node, 'sub')).trim();
      const sup = convertChildren(getDirectChild(node, 'sup')).trim();
      return `${base}_${wrapBracesIfNeeded(sub)}^${wrapBracesIfNeeded(sup)}`;
    }

    case 'sPre': {
      const base = convertChildren(getDirectChild(node, 'e')).trim();
      const sub = convertChildren(getDirectChild(node, 'sub')).trim();
      const sup = convertChildren(getDirectChild(node, 'sup')).trim();
      return `{}_${wrapBracesIfNeeded(sub)}^${wrapBracesIfNeeded(sup)}${base}`;
    }

    case 'nary': {
      const naryPr = getDirectChild(node, 'naryPr');
      const chr = naryPr ? getAttrVal(getDirectChild(naryPr, 'chr')) : '∫';
      const op = convertNaryChar(chr);
      const sub = convertChildren(getDirectChild(node, 'sub')).trim();
      const sup = convertChildren(getDirectChild(node, 'sup')).trim();
      const expr = convertChildren(getDirectChild(node, 'e')).trim();
      let res = op;
      if (sub) res += `_{${sub}}`;
      if (sup) res += `^{${sup}}`;
      if (expr) res += ` ${expr}`;
      return res;
    }

    case 'limLow': {
      const base = convertChildren(getDirectChild(node, 'e')).trim();
      const lim = convertChildren(getDirectChild(node, 'lim')).trim();
      const normalizedBase = /^(lim|max|min|sup|inf)$/i.test(base) ? `\\${base.toLowerCase()}` : base;
      return `${normalizedBase}_{${lim}}`;
    }

    case 'limUpp': {
      const base = convertChildren(getDirectChild(node, 'e')).trim();
      const lim = convertChildren(getDirectChild(node, 'lim')).trim();
      return `\\overset{${lim}}{${base}}`;
    }

    case 'func': {
      const fn = convertChildren(getDirectChild(node, 'fName')).trim();
      const expr = convertChildren(getDirectChild(node, 'e')).trim();
      const known = ['sin', 'cos', 'tan', 'csc', 'sec', 'cot', 'log', 'ln', 'lim', 'max', 'min'];
      const latexFn = known.includes(fn.toLowerCase()) ? `\\${fn.toLowerCase()}` : fn;
      return `${latexFn} ${expr}`;
    }

    case 'd': {
      const dPr = getDirectChild(node, 'dPr');
      const begChr = dPr ? getAttrVal(getDirectChild(dPr, 'begChr')) || '(' : '(';
      const endChr = dPr ? getAttrVal(getDirectChild(dPr, 'endChr')) || ')' : ')';
      const sepChr = dPr ? getAttrVal(getDirectChild(dPr, 'sepChr')) || ',' : ',';
      const elems = getDirectChildren(node, 'e');

      // Check if single inner matrix so we produce pmatrix/bmatrix cleanly
      if (elems.length === 1) {
        const innerM = getDirectChild(elems[0], 'm');
        if (innerM && getDirectChildren(elems[0], 'm').length === 1 && elems[0].children.length === 1) {
          const matrixBody = convertMatrixRows(innerM);
          if (begChr === '(' && endChr === ')') return `\\begin{pmatrix} ${matrixBody} \\end{pmatrix}`;
          if (begChr === '[' && endChr === ']') return `\\begin{bmatrix} ${matrixBody} \\end{bmatrix}`;
          if (begChr === '|' && endChr === '|') return `\\begin{vmatrix} ${matrixBody} \\end{vmatrix}`;
          if (begChr === '{' && endChr === '}') return `\\begin{Bmatrix} ${matrixBody} \\end{Bmatrix}`;
        }
      }

      const [openDel, closeDel] = convertDelimiterPair(begChr, endChr);
      const body = elems.map((el) => convertChildren(el).trim()).join(`${sepChr} `);
      return `\\left${openDel} ${body} \\right${closeDel}`;
    }

    case 'm': {
      const matrixBody = convertMatrixRows(node);
      return `\\begin{matrix} ${matrixBody} \\end{matrix}`;
    }

    case 'eqArr': {
      const lines = getDirectChildren(node, 'e')
        .map((el) => convertChildren(el).trim())
        .filter(Boolean);
      return `\\begin{aligned} ${lines.join(' \\\\ ')} \\end{aligned}`;
    }

    case 'acc': {
      const accPr = getDirectChild(node, 'accPr');
      const chr = accPr ? getAttrVal(getDirectChild(accPr, 'chr')) : '̂';
      const expr = convertChildren(getDirectChild(node, 'e')).trim();
      if (chr === '⃗' || chr === '→') return `\\vec{${expr}}`;
      if (chr === '̄' || chr === '¯') return `\\bar{${expr}}`;
      if (chr === '̇') return `\\dot{${expr}}`;
      if (chr === '̈') return `\\ddot{${expr}}`;
      if (chr === '̃') return `\\tilde{${expr}}`;
      return `\\hat{${expr}}`;
    }

    case 'bar': {
      const barPr = getDirectChild(node, 'barPr');
      const pos = barPr ? getAttrVal(getDirectChild(barPr, 'pos')) : 'top';
      const expr = convertChildren(getDirectChild(node, 'e')).trim();
      return pos === 'bot' ? `\\underline{${expr}}` : `\\overline{${expr}}`;
    }

    case 'groupChr': {
      const gPr = getDirectChild(node, 'groupChrPr');
      const pos = gPr ? getAttrVal(getDirectChild(gPr, 'pos')) : 'bot';
      const expr = convertChildren(getDirectChild(node, 'e')).trim();
      return pos === 'top' ? `\\overbrace{${expr}}` : `\\underbrace{${expr}}`;
    }

    case 'borderBox':
      return `\\boxed{${convertChildren(getDirectChild(node, 'e')).trim()}}`;

    case 'rPr':
    case 'fPr':
    case 'radPr':
    case 'dPr':
    case 'naryPr':
    case 'mPr':
    case 'accPr':
    case 'barPr':
    case 'sSupPr':
    case 'sSubPr':
    case 'sSubSupPr':
    case 'ctrlPr':
      return '';

    default:
      return convertChildren(node);
  }
}

function convertMatrixRows(mNode: Element): string {
  const rows = getDirectChildren(mNode, 'mr');
  return rows
    .map((mr) =>
      getDirectChildren(mr, 'e')
        .map((cell) => convertChildren(cell).trim())
        .join(' & ')
    )
    .join(' \\\\ ');
}

/**
 * Mengonversi seluruh Word Equation (<m:oMath> & <m:oMathPara>) di dalam word/document.xml
 * menjadi teks LaTeX ($...$ / $$...$$) sebelum dibaca oleh mammoth.
 */
export async function preprocessDocxMath(arrayBuffer: ArrayBuffer): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const docFile = zip.file('word/document.xml');
  if (!docFile) {
    return arrayBuffer;
  }

  const xmlText = await docFile.async('string');
  if (!xmlText.includes('oMath')) {
    return arrayBuffer;
  }

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
  if (xmlDoc.querySelector('parsererror')) {
    return arrayBuffer;
  }

  const createWordTextRun = (latex: string): Element => {
    const run = xmlDoc.createElementNS(W_NS, 'w:r');
    const textEl = xmlDoc.createElementNS(W_NS, 'w:t');
    textEl.setAttribute('xml:space', 'preserve');
    textEl.textContent = latex;
    run.appendChild(textEl);
    return run;
  };

  // 1. Replace block equations <m:oMathPara>
  const oMathParas = Array.from(xmlDoc.getElementsByTagNameNS(M_NS, 'oMathPara'));
  for (const para of oMathParas) {
    const mathNodes = getDirectChildren(para, 'oMath');
    const latexParts = mathNodes
      .map((m) => convertOmmlNode(m).replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    if (latexParts.length > 0 && para.parentNode) {
      const replacement = createWordTextRun(` $${latexParts.join(' ')}$ `);
      para.parentNode.replaceChild(replacement, para);
    }
  }

  // 2. Replace inline equations <m:oMath>
  const inlineMaths = Array.from(xmlDoc.getElementsByTagNameNS(M_NS, 'oMath'));
  for (const mathEl of inlineMaths) {
    if (!mathEl.parentNode) continue;
    const latex = convertOmmlNode(mathEl).replace(/\s+/g, ' ').trim();
    if (latex) {
      const replacement = createWordTextRun(` $${latex}$ `);
      mathEl.parentNode.replaceChild(replacement, mathEl);
    }
  }

  const serializer = new XMLSerializer();
  const updatedXml = serializer.serializeToString(xmlDoc);
  zip.file('word/document.xml', updatedXml);

  return zip.generateAsync({ type: 'arraybuffer' });
}

/**
 * Mengonversi simbol matematika Unicode / teks formula yang ditempel dari PDF/Word
 * menjadi format teks + KaTeX ($...$) yang rapi tanpa merusak blok $...$ yang sudah ada.
 */
export function normalizeMathText(input: string): string {
  if (!input) return '';

  // Lindungi blok $...$ dan $$...$$ yang sudah valid
  const segments = input.split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g);

  return segments
    .map((seg) => {
      if (seg.startsWith('$') && seg.endsWith('$')) {
        return seg;
      }

      let out = seg;
      // Ubah pecahan Unicode umum ke KaTeX agar terbaca jelas
      const unicodeFractions: Record<string, string> = {
        '½': '$\\frac{1}{2}$',
        '⅓': '$\\frac{1}{3}$',
        '⅔': '$\\frac{2}{3}$',
        '¼': '$\\frac{1}{4}$',
        '¾': '$\\frac{3}{4}$',
        '⅕': '$\\frac{1}{5}$',
        '⅖': '$\\frac{2}{5}$',
        '⅗': '$\\frac{3}{5}$',
        '⅘': '$\\frac{4}{5}$',
        '⅙': '$\\frac{1}{6}$',
        '⅚': '$\\frac{5}{6}$',
        '⅛': '$\\frac{1}{8}$',
        '⅜': '$\\frac{3}{8}$',
        '⅝': '$\\frac{5}{8}$',
        '⅞': '$\\frac{7}{8}$',
      };
      for (const [k, v] of Object.entries(unicodeFractions)) {
        out = out.split(k).join(v);
      }

      // Ubah pola √(...) atau √angka/huruf menjadi $\sqrt{...}$
      out = out.replace(/√\(([^()\n]+)\)/g, (_, inner) => `$\\sqrt{${inner.trim()}}$`);
      out = out.replace(/√([A-Za-z0-9]+)/g, (_, inner) => `$\\sqrt{${inner}}$`);
      out = out.replace(/∛\(([^()\n]+)\)/g, (_, inner) => `$\\sqrt[3]{${inner.trim()}}$`);
      out = out.replace(/∛([A-Za-z0-9]+)/g, (_, inner) => `$\\sqrt[3]{${inner}}$`);

      return out;
    })
    .join('');
}
