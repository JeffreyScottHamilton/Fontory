export type CategoryId = 'serif' | 'sans-serif' | 'handwriting' | 'display' | 'monospace' | 'retro' | 'gothic' | 'pixel' | 'decorative';
export type LicenseId = 'OFL' | 'APACHE2' | 'UFL' | 'MIT' | 'CC0' | 'UNLICENSE';
export type PreviewMode = 'css2' | 'fontface';
export type CollectionId = 'google-fonts' | 'league' | 'velvetyne' | 'fontsource';
export interface CategoryEvidence { category: CategoryId; source: 'metadata' | 'tag' | 'fontsource'; detail: string; } // detail: 'category: "SERIF"' or '/Theme/Pixel=100' or 'category: "display"' (fontsource metadata.json)
export interface FontStyle { style: 'normal' | 'italic'; weight: number; filename: string; fullName: string; url: string; previewUrl?: string; } // previewUrl: woff2 used for @font-face when the download file is not the best preview format
export interface FontAxis { tag: string; min: number; max: number; }
export interface FontFamily {
  slug: string;            // lowercase, a-z0-9 and '-', unique (e.g. 'ibm-plex-sans')
  family: string;          // exact family name, e.g. 'IBM Plex Sans'
  designer: string;
  license: LicenseId;
  licenseName: string;     // 'SIL Open Font License 1.1' | 'Apache License 2.0' | 'Ubuntu Font Licence 1.0' | 'MIT License' | 'CC0 1.0 Universal' | 'The Unlicense'
  licenseFile: string;     // actual file name in source (e.g. 'OFL.txt', 'LICENSE.txt', 'UFL.txt')
  licenseUrl: string;      // raw URL of licenseFile at pinned commit, or site-relative '/fonts/...' for vendored files
  categories: CategoryId[]; // may be EMPTY (no evidence = uncategorized)
  categoryEvidence: CategoryEvidence[];
  tags: string[];          // human tags with score >= 50, e.g. '/Sans/Geometric' (no /Quality, /quant, /Fontquant, /Skip)
  styles: FontStyle[];     // sorted: weight asc, normal before italic
  weights: number[];       // unique sorted
  hasItalic: boolean;
  axes: FontAxis[];
  isVariable: boolean;     // axes.length > 0
  subsets: string[];       // excluding 'menu'
  dateAdded: string;       // YYYY-MM-DD
  repoPath: string;        // 'ofl/inter' (directory inside the source repo, '' for repo root)
  source: { repo: string; commit: string; url: string; host: 'github' | 'gitlab' }; // repo 'google/fonts' | 'theleagueof/blackout' | 'velvetyne/basteleur' | 'fontsource/font-files'
  upstream: { repositoryUrl: string; commit?: string } | null;  // METADATA source.repository_url
  copyright: string;       // first font's copyright
  related: string[];       // up to 6 slugs, computed at import
  preview: PreviewMode;    // 'css2' (Google css2 API) or 'fontface' (self-hosted public/fontface/<slug>.css)
  collection: CollectionId;
}
export interface FontIndexEntry { slug: string; family: string; designer: string; categories: CategoryId[]; weights: number[]; hasItalic: boolean; isVariable: boolean; styleCount: number; dateAdded: string; previewWeight: number; previewStyle: 'normal' | 'italic'; preview: PreviewMode; collection: CollectionId; }
export const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: 'serif', label: 'Serif' }, { id: 'sans-serif', label: 'Sans Serif' }, { id: 'handwriting', label: 'Handwriting' },
  { id: 'display', label: 'Display' }, { id: 'monospace', label: 'Monospace' }, { id: 'retro', label: 'Retro' },
  { id: 'gothic', label: 'Gothic' }, { id: 'pixel', label: 'Pixel' }, { id: 'decorative', label: 'Decorative' } ];
// Display names and source links for each collection (footer, detail page).
export const COLLECTIONS: Record<CollectionId, { name: string; repoLabel: string; href: string }> = {
  'google-fonts': { name: 'Google Fonts', repoLabel: 'google/fonts', href: 'https://github.com/google/fonts' },
  league: { name: 'The League of Moveable Type', repoLabel: 'theleagueof', href: 'https://github.com/theleagueof' },
  velvetyne: { name: 'Velvetyne', repoLabel: 'gitlab.com/velvetyne', href: 'https://gitlab.com/velvetyne' },
  fontsource: { name: 'Fontsource', repoLabel: 'fontsource/font-files', href: 'https://github.com/fontsource/font-files' },
};
