import type { ExtraTipId } from './tipCatalog.ts';
import type { TipId } from './beginnerTips.ts';

/** Cell-based teaching stages, entirely detached from current puzzle state.
 * Borders are internal cell edges: row,column,R or row,column,D.
 * An "open" edge is a confirmed join. "focus" lists highlighted row,column cells.
 * Distinct steps are intentionally redrawn, not screenshots or solution reveals.
 */
export type Scene = {
  grid: readonly string[];
  walls?: readonly string[];
  open?: readonly string[];
  focus?: readonly string[];
  vertex?: string;
  invalid?: boolean;
};
export type LessonId = TipId | ExtraTipId;
export type LessonScenes = readonly [Scene, Scene, Scene];
const frame = (grid: string[], walls: string[] = [], open: string[] = [], focus: string[] = [], vertex?: string, invalid?: boolean): Scene =>
  ({ grid, walls, open, focus, vertex, invalid });
const v = (...s: string[]) => s;
export const SCENES: Record<LessonId, LessonScenes> = {
  vertex: [
    frame(v('..','..'), v('0,0,R','0,0,D','0,1,D')),
    frame(v('..','..'), v('0,0,R','0,0,D','0,1,D'), [], ['1,1']),
    frame(v('..','..'), v('0,0,R','0,0,D','0,1,D','1,0,R'), [], ['1,0','1,1']),
  ],
  parity: [
    frame(v('00000','0...0','0...0','0...0','00000'), [], [], ['0,0','4,4']),
    frame(v('00000','01110','01.10','01110','00000'), [], [], ['1,1','3,3']),
    frame(v('00000','01110','01010','01110','00000'), [], [], ['2,2']),
  ],
  exit: [
    frame(v('AA..','AA..','....'),v('0,1,R','1,0,D','1,1,D'),[],['0,0','1,1']),
    frame(v('AA..','AA..','....'),v('0,1,R','1,0,D','1,1,D'),[],['1,1','1,2']),
    frame(v('AA..','AAA.','....'),v('0,1,R','1,0,D','1,1,D'),v('1,1,R'),['1,2']),
  ],
  border: [
    frame(v('AAAB','AAAB','AABB','ABBB')),
    frame(v('AAAB','AAAB','AABB','ABBB'),[],[],['1,2','2,1']),
    frame(v('AAAB','AAAB','AABB','ABBB'),[],[],['2,1','2,2']),
  ],
  diagonal: [
    frame(v('AB','B.'),[],[],['1,1']),
    frame(v('AB','BA'),[],[],['0,0','1,1']),
    frame(v('AB','BA'),[],[],['0,0','1,1'],undefined,true),
  ],
  path: [
    frame(v('#####','A...A','#####'),[],[],['1,0','1,4']),
    frame(v('#####','A...A','#####'),[],[],['1,1','1,2','1,3']),
    frame(v('#####','AAAAA','#####'),[],v('1,0,R','1,1,R','1,2,R','1,3,R'),['1,2']),
  ],
  areaFull: [
    frame(v('AA.','AA.','...'),[],[],['0,0','1,1']),
    frame(v('AA.','AA.','...'),[],[],['0,1','1,0']),
    frame(v('AA.','AA.','...'),v('0,1,R','1,1,R','1,0,D','1,1,D'),[],['1,1']),
  ],
  areaRemainder: [
    frame(v('....','....'),[],[],['0,0','1,3']),
    frame(v('....','....'),[],[],['0,0','1,3']),
    frame(v('....','....'),[],[],['0,0','1,3'],undefined,true),
  ],
  fenceRotate: [
    frame(v('...','.◇.','...'),[],[],['1,1']),
    frame(v('...','.◇.','...'),v('1,1,R'),v('0,1,D'),['1,1']),
    frame(v('...','.◇.','...'),v('1,1,R','1,1,D'),v('0,1,D','1,0,R'),['1,1']),
  ],
  fenceOpen: [
    frame(v('...','.◇.','...'),[],[],['1,1']),
    frame(v('...','.◇.','...'),v('0,1,D','1,1,D'),[],['1,1']),
    frame(v('...','.◇.','...'),v('0,1,D','1,1,D'),v('1,0,R','1,1,R'),['1,0','1,2']),
  ],
  brickyThree: [
    frame(v('..','..'),v('0,0,R','0,0,D','0,1,D')),
    frame(v('..','..'),v('0,0,R','0,0,D','0,1,D'),[],['1,1']),
    frame(v('..','..'),v('0,0,R','0,0,D','0,1,D'),v('1,0,R'),['1,0','1,1']),
  ],
  brickyCorner: [
    frame(v('..','..'),v('0,0,R','0,0,D')),
    frame(v('..','..'),v('0,0,R','0,0,D','0,1,D'),[],['1,1']),
    frame(v('..','..'),v('0,0,R','0,0,D','0,1,D','1,0,R'),[],['1,1'],undefined,true),
  ],
  boxyBounds: [
    frame(v('A..','...','..A'),[],[],['0,0','2,2']),
    frame(v('A..','...','..A'),[],[],['0,0','2,2']),
    frame(v('AAA','AAA','AAA'),[],[],['1,1','1,2','2,1']),
  ],
  shapeFilter: [
    frame(v('LTI','A..','A..'),[],[],['0,0','0,1','0,2']),
    frame(v('L××','A..','A..'),[],[],['0,1','0,2']),
    frame(v('L××','AA.','A..'),[],v('1,0,R'),['1,1']),
  ],
  towerExtreme: [
    frame(v('..','..'),[],[],[],'1'),
    frame(v('AA','AA'),[],[],['0,0','1,1'],'1'),
    frame(v('AB','CD'),v('0,0,R','0,0,D','0,1,D','1,0,R'),[],['0,0','1,1'],'4'),
  ],
  compassCount: [
    frame(v('...','.⊕.','...'),[],[],['1,1']),
    frame(v('AAA','A⊕A','AAA'),[],[],['0,0','0,2','2,0','2,2']),
    frame(v('AAA','A⊕A','AAA'),[],[],['0,0','0,2','2,0','2,2']),
  ],
  roseSeparate: [
    frame(v('●●.','...'),[],[],['0,0','0,1']),
    frame(v('●●.','...'),[],[],['0,0','0,1']),
    frame(v('●●.','...'),v('0,0,R'),[],['0,0','0,1']),
  ],
  sizeChain: [
    frame(v('ABC'),v('0,0,R','0,1,R'),[],['0,0','0,1','0,2']),
    frame(v('ABC'),v('0,0,R','0,1,R'),[],['0,1','0,2']),
    frame(v('ABC'),v('0,0,R','0,1,R'),[],['0,0']),
  ],
  combinedArea: [
    frame(v('AA.','AA.','...'),v('0,1,R','1,0,D','1,1,D'),[],['1,1']),
    frame(v('AA.','AA.','...'),v('0,1,R','1,0,D','1,1,D'),[],['1,2']),
    frame(v('AA.','AAA','...'),v('0,1,R','1,0,D','1,1,D'),v('1,1,R'),['1,2']),
  ],
  parityFence: [
    frame(v('.1.','0◇0','.1.'),[],[],['1,1']),
    frame(v('.1.','0◇0','.1.'),v('0,1,D','1,1,D'),[],['0,1','2,1']),
    frame(v('.1.','0◇0','.1.'),v('0,1,D','1,1,D'),v('1,0,R','1,1,R'),['1,0','1,2']),
  ],
};

/** The renderer validates diagrams before constructing DOM; also testable without DOM. */
export function validateScenes(): boolean {
  return Object.values(SCENES).every((scenes) => scenes.length === 3 && scenes.every((scene) => {
    const rows = scene.grid;
    if (!rows.length || !rows[0].length || rows.some(row => row.length !== rows[0].length)) return false;
    const cells = (scene.focus || []).map(x => x.split(',').map(Number));
    if (cells.some(([r,c]) => r < 0 || c < 0 || r >= rows.length || c >= rows[0].length)) return false;
    for (const e of [...(scene.walls || []), ...(scene.open || [])]) {
      const match = /^(\d+),(\d+),([RD])$/.exec(e);
      if (!match) return false;
      const r = Number(match[1]), c = Number(match[2]);
      if (r < 0 || c < 0 || r >= rows.length || c >= rows[0].length ||
          (match[3] === 'R' && c + 1 >= rows[0].length) ||
          (match[3] === 'D' && r + 1 >= rows.length)) return false;
    }
    return true;
  }));
}
