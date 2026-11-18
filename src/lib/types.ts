export type CategoryId = 'serif' | 'sans-serif' | 'handwriting' | 'display' | 'monospace' | 'retro' | 'gothic' | 'pixel' | 'decorative';
export interface CategoryEvidence { category: CategoryId; source: 'metadata' | 'tag'; detail: string; } // detail: 'category: "SERIF"' or '/Theme/Pixel=100'
export interface FontStyle { style: 'normal' | 'italic'; weight: number; filename: string; fullName: string; url: string; }
export interface FontAxis { tag: string; min: number; max: number; }
export interface FontFamily {
  slug: string;            // lowercase, a-z0-9 and '-', unique (e.g. 'ibm-plex-sans')
  family: string;          // exact Google Fonts family name, e.g. 'IBM Plex Sans'
  designer: string;
  license: 'OFL' | 'APACHE2' | 'UFL';
  licenseName: string;     // 'SIL Open Font License 1.1' | 'Apache License 2.0' | 'Ubuntu Font Licence 1.0'
  licenseFile: string;     // 'OFL.txt' | 'LICENSE.txt' | 'UFL.txt' (must exist in repo dir)
  licenseUrl: string;      // raw URL of licenseFile at pinned commit
  categories: CategoryId[];
  categoryEvidence: CategoryEvidence[];
  tags: string[];          // human tags with score >= 50, e.g. '/Sans/Geometric' (no /Quality, /quant, /Fontquant, /Skip)
  styles: FontStyle[];     // sorted: weight asc, normal before italic
  weights: number[];       // unique sorted
  hasItalic: boolean;
  axes: FontAxis[];
  isVariable: boolean;     // axes.length > 0
  subsets: string[];       // excluding 'menu'
  dateAdded: string;       // YYYY-MM-DD
  repoPath: string;        // 'ofl/inter'
  source: { repo: 'google/fonts'; commit: string; url: string }; // url = https://github.com/google/fonts/tree/<sha>/<repoPath>
  upstream: { repositoryUrl: string; commit?: string } | null;  // METADATA source.repository_url
  copyright: string;       // first font's copyright
  related: string[];       // up to 6 slugs, computed at import
}
export interface FontIndexEntry { slug: string; family: string; designer: string; categories: CategoryId[]; weights: number[]; hasItalic: boolean; isVariable: boolean; styleCount: number; dateAdded: string; previewWeight: number; previewStyle: 'normal' | 'italic'; }
export const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: 'serif', label: 'Serif' }, { id: 'sans-serif', label: 'Sans Serif' }, { id: 'handwriting', label: 'Handwriting' },
  { id: 'display', label: 'Display' }, { id: 'monospace', label: 'Monospace' }, { id: 'retro', label: 'Retro' },
  { id: 'gothic', label: 'Gothic' }, { id: 'pixel', label: 'Pixel' }, { id: 'decorative', label: 'Decorative' } ];
