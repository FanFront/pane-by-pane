import type { Theme } from './theme.ts';

/** Canvas does not inherit CSS text/line colours: provide a complete drawing palette.
 * Keep these values in one place so themes can be checked without a browser/canvas. */
export interface BoardPalette {
  clearGlass: string;
  lead: string;
  leadHighlight: string;
  playerWall: string;
  ink: string;
  inkHalo: string;
  undecided: string;
  emptySheen: string;
  areaHighlight: string;
  markerFill: string;
  markerOutline: string;
  markerInk: string;
  towerFill: string;
  towerOutline: string;
  towerInk: string;
  counterFill: string;
  counterInk: string;
  palisadeGuide: string;
  paintTint: string;
  paintTintAmount: number;
  paintHighlightCenter: number;
  paintHighlightMid: number;
}

const classic: BoardPalette = {
  clearGlass: '#e4e9ef',
  lead: '#1d1c21',
  leadHighlight: 'rgba(255,255,255,0.28)',
  playerWall: '#5b5560',
  ink: '#17161a',
  inkHalo: 'rgba(255,255,255,0.55)',
  undecided: 'rgba(30,25,40,0.28)',
  emptySheen: 'rgba(255,255,255,0.7)',
  areaHighlight: 'rgba(255,255,255,0.35)',
  markerFill: '#fbf7ef',
  markerOutline: '#1d1c21',
  markerInk: '#17161a',
  towerFill: '#2b2733',
  towerOutline: '#fbf7ef',
  towerInk: '#fbf7ef',
  counterFill: 'rgba(28,28,33,0.88)',
  counterInk: '#fbf7ef',
  palisadeGuide: 'rgba(23,22,26,0.28)',
  paintTint: '#17263d',
  paintTintAmount: 0,
  paintHighlightCenter: 0.3,
  paintHighlightMid: 0.08,
};

const modern: BoardPalette = {
  ...classic,
  clearGlass: '#dfe9f8',
  lead: '#202e46',
  playerWall: '#52647e',
  ink: '#172b44',
  markerOutline: '#202e46',
  markerInk: '#172b44',
  undecided: 'rgba(33,49,76,0.3)',
};

const dark: BoardPalette = {
  ...classic,
  // Empty cells are dark glass, not blue-grey paper with a white sheen.
  clearGlass: '#203047',
  lead: '#b6c7df',
  leadHighlight: 'rgba(255,255,255,0.42)',
  playerWall: '#f2c47f',
  ink: '#f0f5ff',
  inkHalo: 'rgba(10,20,35,0.8)',
  undecided: 'rgba(198,218,247,0.34)',
  emptySheen: 'rgba(166,202,248,0.1)',
  areaHighlight: 'rgba(184,214,255,0.2)',
  markerFill: '#1c3049',
  markerOutline: '#b6c7df',
  markerInk: '#f0f5ff',
  towerFill: '#1c3049',
  towerOutline: '#b6c7df',
  towerInk: '#f0f5ff',
  counterFill: 'rgba(11,22,37,0.94)',
  counterInk: '#f0f5ff',
  palisadeGuide: 'rgba(222,236,255,0.35)',
  // Keep coloured regions jewel-toned while making all clue ink readable.
  paintTint: '#15243a',
  paintTintAmount: 0.60,
  paintHighlightCenter: 0.09,
  paintHighlightMid: 0.03,
};

export function boardPalette(theme: Theme): BoardPalette {
  return theme === 'dark' ? dark : theme === 'modern' ? modern : classic;
}

/** Blend a six-digit hex glass colour without losing the hex format that
 * completion lighting and colour enrichment use elsewhere in the renderer. */
export function tintedPane(hue: string, palette: BoardPalette): string {
  if (palette.paintTintAmount <= 0) return hue;
  const amount = palette.paintTintAmount;
  const hex = (index: number): string => {
    const from = parseInt(hue.slice(index, index + 2), 16);
    const toward = parseInt(palette.paintTint.slice(index, index + 2), 16);
    return Math.round(from + (toward - from) * amount).toString(16).padStart(2, '0');
  };
  return `#${hex(1)}${hex(3)}${hex(5)}`;
}
