/** Original art tokens for the handmade workshop treatment.
 * Theme selection remains in theme.ts. No puzzle or saved hue indices here. */
import type { Theme } from '../theme.ts';

export interface WorkshopMaterial {
  surface: string;
  metal: string;
  paper: string;
  ambientLight: string;
  outline: string;
  glassTextureStrength: number;
}

export const WORKSHOP_COLORS = Object.freeze({
  walnut: '#382b28',
  parchment: '#f0e3cb',
  brass: '#ba8c46',
  sapphire: '#517cba',
  sunlight: '#ffdc9f',
});

export const THEME_MATERIALS: Readonly<Record<Theme, WorkshopMaterial>> = Object.freeze({
  classic: {
    surface: WORKSHOP_COLORS.walnut,
    metal: WORKSHOP_COLORS.brass,
    paper: WORKSHOP_COLORS.parchment,
    ambientLight: WORKSHOP_COLORS.sunlight,
    outline: '#282126',
    glassTextureStrength: 0.16,
  },
  modern: {
    surface: '#253953',
    metal: '#8099bd',
    paper: '#f2f5fb',
    ambientLight: '#e9f5ff',
    outline: '#26374b',
    glassTextureStrength: 0.09,
  },
  dark: {
    surface: '#101722',
    metal: '#b6c7df',
    paper: '#202f44',
    ambientLight: '#d2defb',
    outline: '#bccce4',
    glassTextureStrength: 0.08,
  },
});

export function workshopMaterial(theme: Theme): WorkshopMaterial {
  return THEME_MATERIALS[theme];
}
