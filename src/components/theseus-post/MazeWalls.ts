// MazeWalls.ts: All wall coordinate data for the patent-drawing maze.
// Coordinates are in a 1400x2000 normalized space (matching patent schematic proportions).
// Ported from the reference schematic with zone assignments for scroll-based highlighting.

export type MazeZone =
  | 'capture'
  | 'pipeline'
  | 'vault'
  | 'engine'
  | 'compose'
  | 'vector'
  | 'resurface'
  | 'tension'
  | 'iq'
  | 'feedback'
  | 'connectors'
  | 'commons'
  | 'ui'
  | 'frame'
  | 'p1'
  | 'p2'
  | 'p3'
  | 'p4'
  | 'p5'
  | 'p6'
  | 'p7';

export interface MazeWall {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  weight: 'structural' | 'standard' | 'baffle';
  zone: MazeZone;
}

// Zone accent colors (used for highlighting active walls)
// Muted zone accent colors: softer than the foreground brand colors
// to keep the maze as background texture, not competing with content.
export const ZONE_COLORS: Record<MazeZone, string> = {
  capture: '#4A7A82',
  pipeline: '#B0715E',
  vault: '#4A7A7A',
  engine: '#B0715E',
  compose: '#4A7A82',
  vector: '#8A6F92',
  resurface: '#B09A6A',
  tension: '#B0715E',
  iq: '#B09A6A',
  feedback: '#B09A6A',
  connectors: '#8A6F92',
  commons: '#4A7A82',
  ui: '#4A7A82',
  frame: '#1e1a14',
  p1: '#B0715E',
  p2: '#B0715E',
  p3: '#B0715E',
  p4: '#B0715E',
  p5: '#B0715E',
  p6: '#B0715E',
  p7: '#B0715E',
};

// Coordinate space dimensions
export const MAZE_W = 1400;
export const MAZE_H = 2000;

// Ink palette for labels and decorative elements
export const INK = '#1e1a14';
export const INK_MED = '#3a3428';
export const INK_LIGHT = '#5a5244';
export const INK_FAINT = '#8a8070';
export const INK_GHOST = '#b0a890';
export const INK_WHISPER = '#c8c0a8';
export const TEAL = '#5A8A8A';
export const AMBER = '#9A8A50';
export const RED = '#9A6050';

// Helper to build wall entries concisely
function w(x1: number, y1: number, x2: number, y2: number, weight: 0 | 1 | 2, zone: MazeZone): MazeWall {
  const wt = weight === 1 ? 'structural' : weight === 2 ? 'baffle' : 'standard';
  return { x1, y1, x2, y2, weight: wt, zone };
}

export const MAZE_WALLS: MazeWall[] = [
  // ── OUTER BOUNDARY ──
  w(80, 130, 1320, 130, 1, 'frame'),
  w(80, 130, 80, 1860, 1, 'frame'),
  w(1320, 130, 1320, 1860, 1, 'frame'),
  w(80, 1860, 1320, 1860, 1, 'frame'),

  // ── ENTRY GATE (top, centered gap) ──
  w(620, 130, 620, 190, 0, 'capture'),
  w(780, 130, 780, 190, 0, 'capture'),
  w(640, 165, 690, 165, 2, 'capture'),
  w(720, 175, 770, 175, 2, 'capture'),

  // ── CAPTURE / INGEST CHAMBER ──
  w(180, 250, 520, 250, 0, 'capture'),
  w(600, 250, 1220, 250, 0, 'capture'),
  w(180, 250, 180, 370, 0, 'capture'),
  w(1220, 250, 1220, 370, 0, 'capture'),
  w(180, 370, 370, 370, 0, 'capture'),
  w(440, 370, 560, 370, 0, 'capture'),
  w(640, 370, 780, 370, 0, 'capture'),
  w(860, 370, 960, 370, 0, 'capture'),
  w(1040, 370, 1220, 370, 0, 'capture'),
  // Internal capture baffles
  w(280, 280, 280, 340, 2, 'capture'),
  w(400, 270, 400, 320, 2, 'capture'),
  w(700, 280, 700, 350, 2, 'capture'),
  w(850, 265, 850, 330, 2, 'capture'),
  w(1000, 280, 1000, 350, 2, 'capture'),
  w(1120, 270, 1120, 340, 2, 'capture'),
  w(200, 310, 260, 310, 2, 'capture'),
  w(320, 300, 380, 300, 2, 'capture'),
  w(900, 300, 940, 300, 2, 'capture'),
  w(1060, 310, 1100, 310, 2, 'capture'),

  // ── PIPELINE OUTER WALLS ──
  w(180, 370, 180, 1340, 0, 'pipeline'),
  w(520, 370, 520, 1340, 0, 'pipeline'),

  // ── PASS 1: NER PIPELINE (370-490) ──
  w(300, 405, 520, 405, 2, 'p1'),
  w(180, 420, 280, 420, 2, 'p1'),
  w(220, 440, 300, 440, 2, 'p1'),
  w(340, 440, 420, 440, 2, 'p1'),
  w(450, 420, 520, 420, 2, 'p1'),
  w(260, 460, 380, 460, 2, 'p1'),
  w(420, 455, 490, 455, 2, 'p1'),
  w(180, 490, 320, 490, 0, 'p1'),
  w(400, 490, 520, 490, 0, 'p1'),
  // NER internal verticals
  w(210, 395, 210, 445, 2, 'p1'),
  w(250, 425, 250, 475, 2, 'p1'),
  w(340, 395, 340, 430, 2, 'p1'),
  w(390, 410, 390, 460, 2, 'p1'),
  w(470, 395, 470, 440, 2, 'p1'),

  // ── PASS 2: ENTITY RESOLUTION (490-600) ──
  w(300, 530, 520, 530, 2, 'p2'),
  w(180, 545, 280, 545, 2, 'p2'),
  w(220, 560, 340, 560, 2, 'p2'),
  w(380, 555, 480, 555, 2, 'p2'),
  w(260, 580, 400, 580, 2, 'p2'),
  w(180, 600, 360, 600, 0, 'p2'),
  w(440, 600, 520, 600, 0, 'p2'),
  w(210, 505, 210, 555, 2, 'p2'),
  w(250, 520, 250, 570, 2, 'p2'),
  w(310, 505, 310, 540, 2, 'p2'),
  w(370, 515, 370, 565, 2, 'p2'),
  w(430, 505, 430, 560, 2, 'p2'),
  w(490, 520, 490, 570, 2, 'p2'),

  // ── PASS 3: SHARED ENTITY MATCH (600-710) ──
  w(280, 640, 520, 640, 2, 'p3'),
  w(180, 650, 250, 650, 2, 'p3'),
  w(200, 670, 320, 670, 2, 'p3'),
  w(360, 665, 480, 665, 2, 'p3'),
  w(240, 690, 380, 690, 2, 'p3'),
  w(180, 710, 340, 710, 0, 'p3'),
  w(420, 710, 520, 710, 0, 'p3'),
  w(215, 615, 215, 660, 2, 'p3'),
  w(270, 625, 270, 680, 2, 'p3'),
  w(330, 610, 330, 655, 2, 'p3'),
  w(400, 625, 400, 670, 2, 'p3'),
  w(460, 620, 460, 665, 2, 'p3'),

  // ── PASS 4: TF-IDF / KEYWORD (710-820) ──
  w(300, 745, 520, 745, 2, 'p4'),
  w(180, 755, 270, 755, 2, 'p4'),
  w(220, 775, 360, 775, 2, 'p4'),
  w(400, 770, 490, 770, 2, 'p4'),
  w(250, 795, 400, 795, 2, 'p4'),
  w(180, 820, 320, 820, 0, 'p4'),
  w(400, 820, 520, 820, 0, 'p4'),
  w(210, 725, 210, 770, 2, 'p4'),
  w(260, 730, 260, 785, 2, 'p4'),
  w(330, 720, 330, 760, 2, 'p4'),
  w(380, 735, 380, 780, 2, 'p4'),
  w(450, 725, 450, 775, 2, 'p4'),

  // ── PASS 5: SBERT EMBEDDINGS (820-930) ──
  w(280, 855, 520, 855, 2, 'p5'),
  w(180, 865, 250, 865, 2, 'p5'),
  w(200, 885, 340, 885, 2, 'p5'),
  w(380, 880, 480, 880, 2, 'p5'),
  w(240, 905, 380, 905, 2, 'p5'),
  w(180, 930, 350, 930, 0, 'p5'),
  w(430, 930, 520, 930, 0, 'p5'),
  w(215, 835, 215, 880, 2, 'p5'),
  w(270, 840, 270, 895, 2, 'p5'),
  w(340, 835, 340, 870, 2, 'p5'),
  w(420, 840, 420, 890, 2, 'p5'),
  w(490, 835, 490, 885, 2, 'p5'),

  // ── PASS 6: NLI STANCE DETECTION (930-1060) ──
  w(300, 965, 520, 965, 2, 'p6'),
  w(180, 980, 270, 980, 2, 'p6'),
  w(220, 1000, 360, 1000, 2, 'p6'),
  w(400, 995, 490, 995, 2, 'p6'),
  w(250, 1020, 400, 1020, 2, 'p6'),
  w(180, 1040, 280, 1040, 2, 'p6'),
  w(320, 1040, 480, 1040, 2, 'p6'),
  w(180, 1060, 380, 1060, 0, 'p6'),
  w(460, 1060, 520, 1060, 0, 'p6'),
  w(210, 945, 210, 995, 2, 'p6'),
  w(270, 950, 270, 1010, 2, 'p6'),
  w(340, 945, 340, 990, 2, 'p6'),
  w(430, 950, 430, 1005, 2, 'p6'),

  // ── PASS 7: KGE (1060-1190) ──
  w(280, 1095, 520, 1095, 2, 'p7'),
  w(180, 1110, 260, 1110, 2, 'p7'),
  w(220, 1130, 370, 1130, 2, 'p7'),
  w(410, 1125, 500, 1125, 2, 'p7'),
  w(260, 1150, 420, 1150, 2, 'p7'),
  w(180, 1170, 300, 1170, 2, 'p7'),
  w(340, 1170, 480, 1170, 2, 'p7'),
  w(180, 1190, 380, 1190, 0, 'p7'),
  w(460, 1190, 520, 1190, 0, 'p7'),
  w(210, 1075, 210, 1125, 2, 'p7'),
  w(280, 1080, 280, 1140, 2, 'p7'),
  w(350, 1075, 350, 1120, 2, 'p7'),
  w(440, 1080, 440, 1130, 2, 'p7'),

  // ── KNOWLEDGE GRAPH VAULT (center) ──
  w(580, 420, 920, 420, 0, 'vault'),
  w(920, 420, 920, 580, 0, 'vault'),
  w(580, 580, 760, 580, 0, 'vault'),
  w(580, 420, 580, 580, 0, 'vault'),
  w(920, 520, 1040, 520, 0, 'vault'),
  // Internal vault structure
  w(640, 445, 640, 555, 2, 'vault'),
  w(700, 435, 700, 520, 2, 'vault'),
  w(760, 445, 760, 555, 2, 'vault'),
  w(820, 435, 820, 530, 2, 'vault'),
  w(880, 445, 880, 555, 2, 'vault'),
  w(610, 470, 660, 470, 2, 'vault'),
  w(680, 490, 740, 490, 2, 'vault'),
  w(780, 475, 840, 475, 2, 'vault'),
  w(850, 505, 910, 505, 2, 'vault'),
  w(610, 520, 680, 520, 2, 'vault'),
  w(720, 535, 800, 535, 2, 'vault'),
  w(840, 540, 900, 540, 2, 'vault'),
  w(610, 555, 650, 555, 2, 'vault'),
  w(690, 555, 740, 555, 2, 'vault'),

  // ── CONNECTION ENGINE (right-center) ──
  w(960, 370, 960, 520, 0, 'engine'),
  w(960, 580, 960, 780, 0, 'engine'),
  w(1080, 520, 1080, 700, 0, 'engine'),
  w(960, 700, 1080, 700, 0, 'engine'),
  w(960, 780, 1120, 780, 0, 'engine'),
  w(1120, 640, 1120, 780, 0, 'engine'),
  w(1120, 640, 1220, 640, 0, 'engine'),
  // CE internal maze
  w(990, 400, 990, 480, 2, 'engine'),
  w(1020, 420, 1020, 500, 2, 'engine'),
  w(1050, 400, 1050, 460, 2, 'engine'),
  w(990, 540, 1060, 540, 2, 'engine'),
  w(960, 600, 1020, 600, 2, 'engine'),
  w(1040, 590, 1080, 590, 2, 'engine'),
  w(990, 640, 1040, 640, 2, 'engine'),
  w(960, 660, 1010, 660, 2, 'engine'),
  w(1030, 660, 1080, 660, 2, 'engine'),
  w(990, 720, 1060, 720, 2, 'engine'),
  w(960, 750, 1020, 750, 2, 'engine'),
  w(1040, 740, 1100, 740, 2, 'engine'),

  // ── COMPOSE ENGINE (center-left of KG) ──
  w(580, 640, 720, 640, 0, 'compose'),
  w(720, 640, 720, 790, 0, 'compose'),
  w(580, 790, 720, 790, 0, 'compose'),
  w(580, 640, 580, 790, 0, 'compose'),
  w(610, 670, 690, 670, 2, 'compose'),
  w(580, 700, 640, 700, 2, 'compose'),
  w(660, 695, 720, 695, 2, 'compose'),
  w(610, 725, 680, 725, 2, 'compose'),
  w(580, 750, 650, 750, 2, 'compose'),
  w(670, 745, 720, 745, 2, 'compose'),
  w(610, 770, 690, 770, 2, 'compose'),

  // ── VECTOR STORE (right of compose) ──
  w(780, 640, 910, 640, 0, 'vector'),
  w(910, 640, 910, 750, 0, 'vector'),
  w(780, 750, 910, 750, 0, 'vector'),
  w(780, 640, 780, 750, 0, 'vector'),
  w(810, 665, 880, 665, 2, 'vector'),
  w(780, 690, 840, 690, 2, 'vector'),
  w(860, 685, 910, 685, 2, 'vector'),
  w(810, 715, 870, 715, 2, 'vector'),
  w(780, 735, 830, 735, 2, 'vector'),

  // ── RESURFACER (lower center-right) ──
  w(760, 840, 920, 840, 0, 'resurface'),
  w(760, 840, 760, 1020, 0, 'resurface'),
  w(920, 840, 920, 1020, 0, 'resurface'),
  w(760, 1020, 920, 1020, 0, 'resurface'),
  w(790, 870, 890, 870, 2, 'resurface'),
  w(760, 900, 830, 900, 2, 'resurface'),
  w(850, 895, 920, 895, 2, 'resurface'),
  w(790, 930, 860, 930, 2, 'resurface'),
  w(760, 960, 840, 960, 2, 'resurface'),
  w(860, 955, 920, 955, 2, 'resurface'),
  w(790, 990, 870, 990, 2, 'resurface'),

  // ── TENSION DETECTION (lower center) ──
  w(580, 840, 700, 840, 0, 'tension'),
  w(580, 840, 580, 1000, 0, 'tension'),
  w(700, 840, 700, 1000, 0, 'tension'),
  w(580, 1000, 700, 1000, 0, 'tension'),
  w(610, 870, 670, 870, 2, 'tension'),
  w(580, 900, 640, 900, 2, 'tension'),
  w(660, 895, 700, 895, 2, 'tension'),
  w(610, 930, 680, 930, 2, 'tension'),
  w(580, 960, 650, 960, 2, 'tension'),
  w(670, 955, 700, 955, 2, 'tension'),

  // ── IQ TRACKER / FEEDBACK LOOP (bottom-left) ──
  w(180, 1250, 180, 1520, 0, 'iq'),
  w(180, 1520, 520, 1520, 0, 'iq'),
  w(520, 1190, 520, 1520, 0, 'iq'),
  w(280, 1250, 520, 1250, 0, 'iq'),
  // IQ internal maze (dense: the engine learning from itself)
  w(180, 1290, 300, 1290, 2, 'iq'),
  w(340, 1285, 520, 1285, 2, 'iq'),
  w(210, 1320, 280, 1320, 2, 'iq'),
  w(320, 1315, 440, 1315, 2, 'iq'),
  w(460, 1310, 520, 1310, 2, 'iq'),
  w(180, 1350, 260, 1350, 2, 'iq'),
  w(300, 1345, 400, 1345, 2, 'iq'),
  w(440, 1350, 520, 1350, 2, 'iq'),
  w(210, 1380, 340, 1380, 2, 'iq'),
  w(380, 1375, 480, 1375, 2, 'iq'),
  w(180, 1410, 270, 1410, 2, 'iq'),
  w(310, 1405, 420, 1405, 2, 'iq'),
  w(460, 1410, 520, 1410, 2, 'iq'),
  w(210, 1440, 350, 1440, 2, 'iq'),
  w(390, 1435, 490, 1435, 2, 'iq'),
  w(180, 1470, 280, 1470, 2, 'iq'),
  w(320, 1465, 440, 1465, 2, 'iq'),
  w(480, 1470, 520, 1470, 2, 'iq'),
  w(210, 1500, 380, 1500, 2, 'iq'),
  w(420, 1495, 500, 1495, 2, 'iq'),

  // ── FEEDBACK RETURN PATH ──
  w(520, 1440, 720, 1440, 0, 'feedback'),
  w(720, 1440, 720, 1580, 0, 'feedback'),
  w(720, 1580, 1220, 1580, 0, 'feedback'),
  w(1220, 1580, 1220, 370, 0, 'feedback'),
  // Return path internal baffles
  w(760, 1440, 760, 1540, 2, 'feedback'),
  w(800, 1470, 800, 1580, 2, 'feedback'),
  w(850, 1440, 850, 1550, 2, 'feedback'),
  w(900, 1480, 900, 1580, 2, 'feedback'),
  w(960, 1440, 960, 1560, 2, 'feedback'),
  w(1020, 1470, 1020, 1580, 2, 'feedback'),
  w(1080, 1440, 1080, 1560, 2, 'feedback'),
  w(1150, 1460, 1150, 1580, 2, 'feedback'),

  // ── INDEX-API CONNECTORS (right edge) ──
  w(1060, 820, 1220, 820, 0, 'connectors'),
  w(1060, 820, 1060, 1160, 0, 'connectors'),
  w(1220, 820, 1220, 1160, 0, 'connectors'),
  w(1060, 1160, 1220, 1160, 0, 'connectors'),
  w(1060, 880, 1140, 880, 2, 'connectors'),
  w(1140, 880, 1140, 950, 0, 'connectors'),
  w(1060, 950, 1140, 950, 0, 'connectors'),
  w(1160, 880, 1220, 880, 2, 'connectors'),
  w(1160, 880, 1160, 950, 2, 'connectors'),
  w(1060, 1000, 1220, 1000, 0, 'connectors'),
  w(1060, 1050, 1140, 1050, 2, 'connectors'),
  w(1160, 1040, 1220, 1040, 2, 'connectors'),
  w(1060, 1100, 1220, 1100, 0, 'connectors'),
  w(1100, 1000, 1100, 1050, 2, 'connectors'),
  w(1180, 1000, 1180, 1050, 2, 'connectors'),
  w(1100, 1100, 1100, 1160, 2, 'connectors'),
  w(1180, 1100, 1180, 1160, 2, 'connectors'),
  // MCP port marks
  w(1220, 860, 1260, 860, 2, 'connectors'),
  w(1220, 920, 1260, 920, 2, 'connectors'),
  w(1220, 980, 1260, 980, 2, 'connectors'),
  w(1220, 1040, 1260, 1040, 2, 'connectors'),
  w(1220, 1120, 1260, 1120, 2, 'connectors'),

  // ── THE COMMONS (bottom-right) ──
  w(800, 1240, 1120, 1240, 0, 'commons'),
  w(800, 1240, 800, 1420, 0, 'commons'),
  w(1120, 1240, 1120, 1420, 0, 'commons'),
  w(800, 1420, 1120, 1420, 0, 'commons'),
  w(840, 1275, 1080, 1275, 2, 'commons'),
  w(800, 1310, 900, 1310, 2, 'commons'),
  w(940, 1305, 1060, 1305, 2, 'commons'),
  w(840, 1340, 960, 1340, 2, 'commons'),
  w(1000, 1335, 1120, 1335, 2, 'commons'),
  w(800, 1370, 880, 1370, 2, 'commons'),
  w(920, 1365, 1040, 1365, 2, 'commons'),
  w(1060, 1370, 1120, 1370, 2, 'commons'),
  w(840, 1395, 1000, 1395, 2, 'commons'),

  // ── COMMONPLACE INTERFACE (bottom center) ──
  w(180, 1620, 640, 1620, 0, 'ui'),
  w(180, 1620, 180, 1780, 0, 'ui'),
  w(640, 1620, 640, 1780, 0, 'ui'),
  w(180, 1780, 640, 1780, 0, 'ui'),
  w(260, 1655, 640, 1655, 2, 'ui'),
  w(180, 1690, 400, 1690, 2, 'ui'),
  w(440, 1685, 640, 1685, 2, 'ui'),
  w(260, 1720, 560, 1720, 2, 'ui'),
  w(180, 1750, 340, 1750, 2, 'ui'),
  w(380, 1745, 540, 1745, 2, 'ui'),
  w(580, 1750, 640, 1750, 2, 'ui'),
  w(300, 1655, 300, 1720, 2, 'ui'),
  w(420, 1655, 420, 1690, 2, 'ui'),
  w(540, 1655, 540, 1720, 2, 'ui'),
  w(220, 1690, 220, 1755, 2, 'ui'),
  w(360, 1690, 360, 1750, 2, 'ui'),
  w(480, 1690, 480, 1755, 2, 'ui'),

  // ── EXIT GATE ──
  w(660, 1780, 660, 1860, 0, 'frame'),
  w(780, 1780, 780, 1860, 0, 'frame'),
  w(680, 1810, 720, 1810, 2, 'frame'),
  w(740, 1830, 770, 1830, 2, 'frame'),
];

// ── Labels for patent schematic ──
export interface MazeLabel {
  x: number;
  y: number;
  text: string;
  size: number;
  family: 'mono' | 'serif';
  color?: string;
  style?: 'italic' | 'normal';
  tracking?: number;
  weight?: number;
  rotate?: number;
}

export const MAZE_LABELS: MazeLabel[] = [
  // Title
  { x: 700, y: 108, text: 'FIG. 1', size: 18, style: 'italic', family: 'serif' },

  // Capture
  { x: 560, y: 220, text: 'CAPTURE / INGEST', size: 9.5, tracking: 2, family: 'mono' },
  { x: 560, y: 234, text: 'objects enter the graph', size: 7.5, color: INK_FAINT, family: 'serif', style: 'italic' },

  // Pipeline passes
  { x: 350, y: 395, text: '101  NER PIPELINE', size: 8, family: 'mono', tracking: 1 },
  { x: 280, y: 478, text: 'PERSON  ORG  GPE  LOC  EVENT', size: 5.5, color: INK_LIGHT, family: 'mono' },
  { x: 350, y: 510, text: '102  ENTITY RESOLUTION', size: 8, family: 'mono', tracking: 1 },
  { x: 280, y: 590, text: 'normalized deduplication', size: 5.5, color: INK_LIGHT, family: 'mono' },
  { x: 350, y: 620, text: '103  SHARED ENTITY MATCH', size: 8, family: 'mono', tracking: 1 },
  { x: 280, y: 700, text: 'cross-object convergence', size: 5.5, color: INK_LIGHT, family: 'mono' },
  { x: 350, y: 730, text: '104  TF-IDF / KEYWORD', size: 8, family: 'mono', tracking: 1 },
  { x: 280, y: 810, text: 'lexical similarity scoring', size: 5.5, color: INK_LIGHT, family: 'mono' },
  { x: 350, y: 840, text: '105  SBERT EMBEDDINGS', size: 8, family: 'mono', tracking: 1 },
  { x: 280, y: 920, text: '384d semantic vectors', size: 5.5, color: INK_LIGHT, family: 'mono' },
  { x: 350, y: 950, text: '106  NLI STANCE DETECTION', size: 8, family: 'mono', tracking: 1 },
  { x: 280, y: 1050, text: 'support / contradict / neutral', size: 5.5, color: INK_LIGHT, family: 'mono' },
  { x: 350, y: 1080, text: '107  KG EMBEDDINGS', size: 8, family: 'mono', tracking: 1 },
  { x: 280, y: 1180, text: 'TransE link prediction', size: 5.5, color: INK_LIGHT, family: 'mono' },

  // Knowledge Graph
  { x: 750, y: 462, text: '200  KNOWLEDGE GRAPH', size: 9, color: TEAL, family: 'mono', tracking: 1 },
  { x: 750, y: 478, text: 'Objects / Nodes / Edges / ResolvedEntities', size: 6, color: INK_FAINT, family: 'mono' },

  // Sub-systems
  { x: 1020, y: 560, text: '203  CONNECTION ENGINE', size: 7.5, family: 'mono', tracking: 1 },
  { x: 1020, y: 574, text: 'seven-pass orchestrator', size: 6, color: INK_FAINT, family: 'serif', style: 'italic' },
  { x: 650, y: 658, text: '202  COMPOSE', size: 7.5, family: 'mono', tracking: 1 },
  { x: 650, y: 672, text: 'real-time passes', size: 6, color: INK_FAINT, family: 'serif', style: 'italic' },
  { x: 845, y: 658, text: '201  VECTOR', size: 7.5, family: 'mono', tracking: 1 },
  { x: 845, y: 672, text: 'FAISS index', size: 6, color: INK_FAINT, family: 'serif', style: 'italic' },
  { x: 640, y: 858, text: '205  TENSION', size: 7.5, family: 'mono', tracking: 1 },
  { x: 640, y: 872, text: 'belief conflict', size: 6, color: RED, family: 'serif', style: 'italic' },
  { x: 840, y: 858, text: '204  RESURFACER', size: 7.5, family: 'mono', tracking: 1 },
  { x: 840, y: 872, text: 'temporal recall', size: 6, color: INK_FAINT, family: 'serif', style: 'italic' },

  // IQ Tracker
  { x: 350, y: 1268, text: '300  IQ TRACKER', size: 9, color: AMBER, family: 'mono', tracking: 1 },
  { x: 350, y: 1284, text: 'self-improvement metrics / learned scoring model', size: 6, color: INK_FAINT, family: 'serif', style: 'italic' },

  // Index-API
  { x: 1140, y: 848, text: '400  INDEX-API', size: 8, family: 'mono', tracking: 1 },
  { x: 1090, y: 905, text: 'TickTick', size: 6, color: INK_LIGHT, family: 'mono' },
  { x: 1170, y: 905, text: 'Notion', size: 6, color: INK_LIGHT, family: 'mono' },
  { x: 1090, y: 975, text: 'Gmail', size: 6, color: INK_LIGHT, family: 'mono' },
  { x: 1170, y: 975, text: 'Calendar', size: 6, color: INK_LIGHT, family: 'mono' },
  { x: 1090, y: 1070, text: 'Wikidata', size: 6, color: INK_LIGHT, family: 'mono' },
  { x: 1170, y: 1070, text: 'MCP', size: 6, color: INK_LIGHT, family: 'mono' },
  { x: 1090, y: 1135, text: 'Todoist', size: 6, color: INK_LIGHT, family: 'mono' },
  { x: 1170, y: 1135, text: 'Linear', size: 6, color: INK_LIGHT, family: 'mono' },

  // The Commons
  { x: 960, y: 1260, text: '500  THE COMMONS', size: 8, family: 'mono', tracking: 1 },
  { x: 960, y: 1276, text: 'domain packs / templates / ontologies', size: 6, color: INK_FAINT, family: 'serif', style: 'italic' },

  // CommonPlace
  { x: 410, y: 1640, text: '600  COMMONPLACE', size: 9, family: 'mono', tracking: 1 },
  { x: 410, y: 1656, text: 'native interface layer', size: 6, color: INK_FAINT, family: 'serif', style: 'italic' },
  { x: 250, y: 1710, text: 'Library', size: 6, color: INK_LIGHT, family: 'mono' },
  { x: 360, y: 1710, text: 'Timeline', size: 6, color: INK_LIGHT, family: 'mono' },
  { x: 470, y: 1710, text: 'Network', size: 6, color: INK_LIGHT, family: 'mono' },
  { x: 580, y: 1710, text: 'Compose', size: 6, color: INK_LIGHT, family: 'mono' },
  { x: 250, y: 1770, text: 'Resurface', size: 6, color: INK_LIGHT, family: 'mono' },
  { x: 400, y: 1770, text: 'Models', size: 6, color: INK_LIGHT, family: 'mono' },
  { x: 530, y: 1770, text: 'Settings', size: 6, color: INK_LIGHT, family: 'mono' },

  // Tier labels
  { x: 160, y: 1910, text: 'T1  PRIVATE', size: 6.5, family: 'mono', color: INK_LIGHT },
  { x: 500, y: 1910, text: 'T2  TELEMETRY (opt-in)', size: 6.5, family: 'mono', color: INK_LIGHT },
  { x: 900, y: 1910, text: 'T3  COMMONS (publish)', size: 6.5, family: 'mono', color: INK_LIGHT },

  // Feedback label
  { x: 950, y: 1600, text: 'IQ signal propagates back through pipeline', size: 7, color: AMBER, family: 'serif', style: 'italic' },
  { x: 1250, y: 960, text: 'FEEDBACK', size: 6.5, color: AMBER, family: 'mono', rotate: -90 },
  { x: 1270, y: 960, text: 'RETURN', size: 6.5, color: AMBER, family: 'mono', rotate: -90 },

  // Dimension line label
  { x: 148, y: 790, text: '7-PASS PIPELINE', size: 5, color: INK_WHISPER, family: 'mono', rotate: -90 },

  // Section markers
  { x: 70, y: 430, text: 'SEC. A', size: 6, color: INK_WHISPER, family: 'mono', rotate: -90 },
  { x: 70, y: 900, text: 'SEC. B', size: 6, color: INK_WHISPER, family: 'mono', rotate: -90 },
  { x: 70, y: 1400, text: 'SEC. C', size: 6, color: INK_WHISPER, family: 'mono', rotate: -90 },
];

// ── Cross-hatch fill regions ──
export interface CrossHatchRegion {
  x: number;
  y: number;
  w: number;
  h: number;
  spacing: number;
  color: string;
  opacity: number;
}

export const CROSS_HATCH_REGIONS: CrossHatchRegion[] = [
  { x: 583, y: 423, w: 334, h: 154, spacing: 6, color: TEAL, opacity: 0.08 },
  { x: 183, y: 1253, w: 334, h: 264, spacing: 7, color: AMBER, opacity: 0.06 },
  { x: 783, y: 643, w: 124, h: 104, spacing: 5, color: TEAL, opacity: 0.06 },
  { x: 803, y: 1243, w: 314, h: 174, spacing: 8, color: INK_GHOST, opacity: 0.05 },
];

// ── Data flow arrow paths ──
export const FLOW_ARROWS: string[] = [
  // Capture to pipeline
  'M700,250 L700,370',
  'M430,370 L430,405',
  // Pipeline sequential
  'M350,490 L350,530',
  'M350,600 L350,640',
  'M350,710 L350,745',
  'M350,820 L350,855',
  'M350,930 L350,965',
  'M350,1060 L350,1095',
  // Pipeline to KG
  'M520,480 L580,480',
  // KG to compose
  'M680,580 L660,640',
  // KG to connection engine
  'M920,490 L960,490',
  // CE back to KG
  'M960,700 L920,580',
  // KG to resurfacer
  'M850,580 L840,840',
  // KG to vector
  'M820,580 L840,640',
];

// Feedback return path (rendered separately, amber)
export const FEEDBACK_ARROW_PATH = 'M520,1440 L720,1440 L720,1580 L1220,1580 L1220,400';

// ── Dimension lines ──
export interface DimensionLine {
  x1: number; y1: number; x2: number; y2: number;
  tickX1?: number; tickY1?: number; tickX2?: number; tickY2?: number;
  tickEndX1?: number; tickEndY1?: number; tickEndX2?: number; tickEndY2?: number;
}

export const DIMENSION_LINES: DimensionLine[] = [
  // Pipeline vertical extent
  {
    x1: 160, y1: 380, x2: 160, y2: 1200,
    tickX1: 155, tickY1: 380, tickX2: 165, tickY2: 380,
    tickEndX1: 155, tickEndY1: 1200, tickEndX2: 165, tickEndY2: 1200,
  },
  // KG vault width (dashed)
  {
    x1: 580, y1: 405, x2: 920, y2: 405,
    tickX1: 580, tickY1: 400, tickX2: 580, tickY2: 410,
    tickEndX1: 920, tickEndY1: 400, tickEndX2: 920, tickEndY2: 410,
  },
];

// ── Graph node positions inside the KG vault ──
export interface GraphNode {
  cx: number;
  cy: number;
  r: number;
}

// Deterministic graph nodes seeded from the PRNG in roughMaze.ts
// (pre-computed so the SVG overlay stays pure)
export const GRAPH_NODES: GraphNode[] = (() => {
  // Simple deterministic positions in the vault region (580-920, 420-580)
  const nodes: GraphNode[] = [];
  for (let i = 0; i < 22; i++) {
    const col = i % 7;
    const row = Math.floor(i / 7);
    nodes.push({
      cx: 600 + col * 46 + ((i * 17 + 3) % 20 - 10),
      cy: 440 + row * 38 + ((i * 13 + 7) % 16 - 8),
      r: 2 + ((i * 7 + 5) % 4),
    });
  }
  return nodes;
})();

// ── Registration marks (corner alignment marks) ──
export const REGISTRATION_MARKS: [number, number][] = [
  [55, 55],
  [MAZE_W - 55, 55],
  [55, MAZE_H - 55],
  [MAZE_W - 55, MAZE_H - 55],
];

// ── Title block text ──
export const TITLE_BLOCK = {
  line1: 'PATENT APPLICATION No. 2026/KRE-001  |  GILBERT, T.  |  MARCH 2026',
  line2: 'SELF-IMPROVING EPISTEMIC ENGINE WITH SEVEN-PASS CONNECTION PIPELINE',
  line3: 'SHEET 1 OF 1  |  CLASS: G06N 5/04  |  INT. CL: KNOWLEDGE REPRESENTATION; REASONING',
  quote1: 'Not only did the mouse find its way through the maze,',
  quote2: 'but the maze learned from the mouse.',
  quoteAttr: 'AFTER C. E. SHANNON, "PRESENTATION OF A MAZE-SOLVING MACHINE," 1952',
};

// Binary stream paths: waypoints through maze corridors (1400x2000 space)
export interface CodePath {
  points: [number, number][];
  speed: number;
  zone: MazeZone;
}

export const BINARY_PATHS: CodePath[] = [
  // Capture entry -> vault
  { points: [[700, 130], [700, 250], [700, 370], [700, 420]], speed: 0.3, zone: 'capture' },
  // Pipeline flow (top to bottom through passes)
  { points: [[350, 370], [350, 490], [350, 600], [350, 710], [350, 820], [350, 930], [350, 1060], [350, 1190]], speed: 0.15, zone: 'pipeline' },
  // Vault internal circulation
  { points: [[610, 440], [700, 480], [820, 500], [750, 540], [640, 560]], speed: 0.12, zone: 'vault' },
  // Connection engine
  { points: [[960, 420], [1020, 500], [1050, 600], [1020, 700], [990, 760]], speed: 0.2, zone: 'engine' },
  // Pipeline to KG crossing
  { points: [[520, 480], [560, 480], [580, 480]], speed: 0.25, zone: 'connectors' },
  // Compose
  { points: [[620, 650], [660, 700], [700, 750], [660, 780]], speed: 0.2, zone: 'compose' },
  // Vector store
  { points: [[800, 660], [850, 690], [890, 720], [850, 740]], speed: 0.2, zone: 'vector' },
  // Feedback return loop
  { points: [[520, 1440], [620, 1440], [720, 1500], [720, 1580], [900, 1580], [1100, 1580], [1220, 1580], [1220, 1000], [1220, 500]], speed: 0.1, zone: 'feedback' },
  // Tension
  { points: [[600, 860], [640, 900], [680, 940], [640, 980]], speed: 0.18, zone: 'tension' },
  // IQ tracker
  { points: [[300, 1280], [400, 1350], [350, 1420], [450, 1490]], speed: 0.1, zone: 'iq' },
  // Resurface
  { points: [[780, 860], [840, 900], [880, 950], [840, 1000]], speed: 0.18, zone: 'resurface' },
];
