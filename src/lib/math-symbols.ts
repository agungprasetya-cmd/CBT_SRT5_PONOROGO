export interface MathSymbolItem {
  label: string;
  preview: string;
  snippet: string;
  title: string;
}

export interface MathSymbolCategory {
  id: string;
  label: string;
  items: MathSymbolItem[];
}

export const MATH_SYMBOL_CATEGORIES: MathSymbolCategory[] = [
  {
    id: 'basic',
    label: 'Dasar & Aljabar',
    items: [
      { label: 'Pecahan', preview: 'a/b', snippet: '$\\frac{a}{b}$', title: 'Pecahan' },
      { label: 'Akar', preview: '√x', snippet: '$\\sqrt{x}$', title: 'Akar kuadrat' },
      { label: 'Akar n', preview: 'ⁿ√x', snippet: '$\\sqrt[n]{x}$', title: 'Akar pangkat n' },
      { label: 'Pangkat', preview: 'x²', snippet: '$x^{2}$', title: 'Pangkat / eksponen' },
      { label: 'Subskrip', preview: 'xₙ', snippet: '$x_{n}$', title: 'Indeks bawah / subskrip' },
      { label: '±', preview: '±', snippet: '$\\pm$', title: 'Plus minus' },
      { label: '×', preview: '×', snippet: '$\\times$', title: 'Kali' },
      { label: '÷', preview: '÷', snippet: '$\\div$', title: 'Bagi' },
      { label: '·', preview: '·', snippet: '$\\cdot$', title: 'Titik perkalian' },
      { label: '≠', preview: '≠', snippet: '$\\neq$', title: 'Tidak sama dengan' },
      { label: '≤', preview: '≤', snippet: '$\\leq$', title: 'Kurang dari atau sama dengan' },
      { label: '≥', preview: '≥', snippet: '$\\geq$', title: 'Lebih dari atau sama dengan' },
      { label: '≈', preview: '≈', snippet: '$\\approx$', title: 'Kira-kira sama dengan' },
      { label: '∞', preview: '∞', snippet: '$\\infty$', title: 'Tak hingga' },
      { label: 'Log', preview: 'ᵃlog b', snippet: '$\\log_{a} b$', title: 'Logaritma' },
      { label: 'Mutlak', preview: '|x|', snippet: '$|x|$', title: 'Nilai mutlak' },
    ],
  },
  {
    id: 'calculus',
    label: 'Kalkulus & Matriks',
    items: [
      {
        label: 'Limit',
        preview: 'lim',
        snippet: '$$\\lim_{x \\to 0} \\frac{\\sin x}{x}$$',
        title: 'Limit fungsi',
      },
      {
        label: 'Integral',
        preview: '∫',
        snippet: '$$\\int_{a}^{b} f(x)\\,dx$$',
        title: 'Integral tentu',
      },
      {
        label: 'Int. Tak Tentu',
        preview: '∫dx',
        snippet: '$\\int f(x)\\,dx$',
        title: 'Integral tak tentu',
      },
      {
        label: 'Sigma',
        preview: '∑',
        snippet: '$\\sum_{i=1}^{n} x_i$',
        title: 'Notasi sigma',
      },
      {
        label: 'Produk',
        preview: '∏',
        snippet: '$\\prod_{i=1}^{n} x_i$',
        title: 'Notasi perkalian',
      },
      {
        label: 'Turunan',
        preview: 'dy/dx',
        snippet: '$\\frac{dy}{dx}$',
        title: 'Turunan pertama',
      },
      {
        label: 'Parsial',
        preview: '∂',
        snippet: '$\\frac{\\partial f}{\\partial x}$',
        title: 'Turunan parsial',
      },
      {
        label: 'Matriks 2×2',
        preview: '(2×2)',
        snippet: '$\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$',
        title: 'Matriks 2x2',
      },
      {
        label: 'Matriks 3×3',
        preview: '(3×3)',
        snippet: '$\\begin{pmatrix} a & b & c \\\\ d & e & f \\\\ g & h & i \\end{pmatrix}$',
        title: 'Matriks 3x3',
      },
      {
        label: 'SPLTV/Sistem',
        preview: '{...',
        snippet: '$$\\begin{cases} x + y = 5 \\\\ 2x - y = 1 \\end{cases}$$',
        title: 'Sistem persamaan',
      },
      {
        label: 'Kombinasi',
        preview: 'C(n,k)',
        snippet: '$\\binom{n}{k}$',
        title: 'Koefisien binomial / kombinasi',
      },
    ],
  },
  {
    id: 'geometry',
    label: 'Geometri & Trigono',
    items: [
      { label: 'Derajat', preview: '°', snippet: '$30^{\\circ}$', title: 'Derajat sudut' },
      { label: 'Sudut', preview: '∠', snippet: '$\\angle ABC$', title: 'Simbol sudut' },
      { label: 'Tegak Lurus', preview: '⊥', snippet: '$\\perp$', title: 'Tegak lurus' },
      { label: 'Sejajar', preview: '∥', snippet: '$\\parallel$', title: 'Garis sejajar' },
      { label: 'Segitiga', preview: '△', snippet: '$\\triangle ABC$', title: 'Segitiga' },
      { label: 'Kongruen', preview: '≅', snippet: '$\\cong$', title: 'Kongruen' },
      { label: 'Sebangun', preview: '∼', snippet: '$\\sim$', title: 'Sebangun' },
      { label: 'Vektor', preview: 'v⃗', snippet: '$\\vec{AB}$', title: 'Vektor' },
      { label: 'Ruas Garis', preview: 'AB̅', snippet: '$\\overline{AB}$', title: 'Ruas garis' },
      { label: 'sin', preview: 'sin θ', snippet: '$\\sin \\theta$', title: 'Sinus' },
      { label: 'cos', preview: 'cos θ', snippet: '$\\cos \\theta$', title: 'Cosinus' },
      { label: 'tan', preview: 'tan θ', snippet: '$\\tan \\theta$', title: 'Tangen' },
    ],
  },
  {
    id: 'logic',
    label: 'Himpunan & Logika',
    items: [
      { label: 'Elemen', preview: '∈', snippet: '$\\in$', title: 'Anggota himpunan' },
      { label: 'Bukan Elemen', preview: '∉', snippet: '$\\notin$', title: 'Bukan anggota himpunan' },
      { label: 'Subset', preview: '⊂', snippet: '$\\subset$', title: 'Himpunan bagian sejati' },
      { label: 'Subset =', preview: '⊆', snippet: '$\\subseteq$', title: 'Himpunan bagian' },
      { label: 'Gabungan', preview: '∪', snippet: '$\\cup$', title: 'Gabungan himpunan' },
      { label: 'Irisan', preview: '∩', snippet: '$\\cap$', title: 'Irisan himpunan' },
      { label: 'Himp. Kosong', preview: '∅', snippet: '$\\emptyset$', title: 'Himpunan kosong' },
      { label: 'Untuk Semua', preview: '∀', snippet: '$\\forall$', title: 'Kuantor universal' },
      { label: 'Ada', preview: '∃', snippet: '$\\exists$', title: 'Kuantor eksistensial' },
      { label: 'Implikasi', preview: '⇒', snippet: '$\\Rightarrow$', title: 'Jika... maka...' },
      { label: 'Biimplikasi', preview: '⇔', snippet: '$\\Leftrightarrow$', title: 'Jika dan hanya jika' },
      { label: 'Negasi', preview: '¬', snippet: '$\\neg p$', title: 'Negasi logika' },
      { label: 'Dan / Atau', preview: '∧ / ∨', snippet: '$p \\land q$', title: 'Konjungsi / disjungsi' },
    ],
  },
  {
    id: 'greek',
    label: 'Yunani & Kimia',
    items: [
      { label: 'α', preview: 'α', snippet: '$\\alpha$', title: 'Alpha' },
      { label: 'β', preview: 'β', snippet: '$\\beta$', title: 'Beta' },
      { label: 'γ', preview: 'γ', snippet: '$\\gamma$', title: 'Gamma' },
      { label: 'θ', preview: 'θ', snippet: '$\\theta$', title: 'Theta' },
      { label: 'π', preview: 'π', snippet: '$\\pi$', title: 'Pi' },
      { label: 'λ', preview: 'λ', snippet: '$\\lambda$', title: 'Lambda' },
      { label: 'μ', preview: 'μ', snippet: '$\\mu$', title: 'Mu' },
      { label: 'σ', preview: 'σ', snippet: '$\\sigma$', title: 'Sigma kecil' },
      { label: 'ω', preview: 'ω', snippet: '$\\omega$', title: 'Omega kecil' },
      { label: 'Δ', preview: 'Δ', snippet: '$\\Delta$', title: 'Delta' },
      { label: 'Ω', preview: 'Ω', snippet: '$\\Omega$', title: 'Ohm / Omega' },
      { label: '→', preview: '→', snippet: '$\\rightarrow$', title: 'Panah reaksi' },
      { label: '⇌', preview: '⇌', snippet: '$\\rightleftharpoons$', title: 'Kesetimbangan kimia' },
    ],
  },
];
