import type { CampKind, Side } from '@macrogod/shared';

/** Map + unit palette of the Pixi renderer: retro-futuristic "Spire" theme (brass, patina, arc energy). */
export const MAP_COLORS = {
  wall: '#191309',
  wallPlate: '#241c0f',
  rivet: '#8a6a32',
  ground: '#453a28',
  laneEdge: '#6b5a35',
  laneDirt: '#8a7245',
  river: '#1fb8c4',
  riverGlow: '#8ef2ff',
  tunnel: '#5a4a2a',
  tunnelMouth: '#d9a53f',
  baseBlue: '#1d2a3f',
  baseRed: '#3a2420',
  fountainBlue: '#2d8bdb',
  fountainRed: '#db4b3a',
};

export const TEAM_COLORS: Record<Side, number> = {
  blue: 0x3d8bff,
  red: 0xff4d5e,
  neutral: 0xf2a33a,
};

export const TEAM_DARK: Record<Side, number> = {
  blue: 0x123a73,
  red: 0x6e1622,
  neutral: 0x6b4513,
};

export const COLORS = {
  hpAlly: 0x3ecf8e,
  hpEnemy: 0xff4d5e,
  hpNeutral: 0xf5b84a,
  hpBack: 0x05080c,
  selection: 0xf0d58a,
  xp: 0x9f7aea,
  ward: 0xf5d547,
  dead: 0x4a4f58,
  rubble: 0x2a2f37,
  orderMove: 0x3ecf8e,
  orderAttack: 0xff4d5e,
  heal: 0x7dffa8,
  shield: 0xf0d58a,
  ability: 0xb48cff,
};

export const CAMP_COLORS: Record<CampKind, number> = {
  blueSentinel: 0x4aa8ff,
  redBrambleback: 0xff5a3c,
  gromp: 0x7ccf6a,
  wolves: 0xa9b4c2,
  raptors: 0xf0a04b,
  krugs: 0xb8916a,
  scuttle: 0x4fd1c5,
  dragon: 0xb48cff,
  baron: 0x9f5fff,
};

export const FOG_COLOR = 'rgba(3, 6, 12, 0.62)';
