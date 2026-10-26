import type { Lang } from './i18n.ts';
import type { Puzzle } from '../engine/types.ts';
import { renderTipGallery } from './tipGallery.ts';

export type TipId = 'vertex' | 'parity' | 'exit' | 'border' | 'diagonal';
type Tip = { id: TipId; title: string; idea: string; premise: string; deduction: string; warning: string; example: string };
type Guide = { intro: string; premise: string; deduction: string; warning: string; sources: string; tips: Tip[] };

export const GUIDE: Record<Lang, Guide> = {
  zh: {
    intro: '从局部必然推理到连通性、奇偶染色。示意图仅用于教学，不会透露当前关卡答案。',
    premise: '适用前提', deduction: '推理方法', warning: '不要误用', sources: '延伸阅读',
    tips: [
      { id: 'vertex', title: '01 · 环纹顶点奇偶', idea: '环纹规则要求每个顶点的分界线数量只能是 0、2 或 4。', premise: '本关启用环纹规则，且已明确知道哪些边是分界线。', deduction: '一个顶点已有三条分界线，第四条也必须是分界线；若已知两条、仅剩一条待定，则那条不能是分界线。', warning: '一般环纹允许四条边界十字相交；只有确认全盘恰好两个连通区域时，十字才不可能。', example: '顶点附近：3 条已知边界 → 第 4 条也必须画上。' },
      { id: 'parity', title: '02 · 环纹奇偶染色', idea: '用 0 / 1 为区域临时分组：跨过一条确定的分界线就换组，沿已知连通处不换组。', premise: '启用环纹规则，或另外证明了区域邻接关系能用两组表示。', deduction: '从 0 出发跨过奇数道边界到达 1，跨过偶数道到达 0；相邻同组格必须连通、相邻异组格必须有边界，可据此远距离传播。', warning: '“奇偶”不是格子数的奇偶；两个不相邻的 0 区域也不一定是同一区域。', example: '示意：外圈 0 → 中圈 1 → 中心 0，跨过边界时反转奇偶。' },
      { id: 'exit', title: '03 · 唯一出口与区域面积', idea: '观察已知边界包围出的“小口袋”，数清楚还剩几条可能通向外面的出口。', premise: '已经确定左上 4 格都属于 A 区，A 区至少要有 5 格，而且口袋只剩一个可能出口。', deduction: 'A 区无法仅靠这 4 格满足面积要求，所以唯一出口必须连通。推广时比较区域所需的最小面积与口袋里最多可用的格数。', warning: '只有一个出口并不自动说明口袋中所有格必须同属一区；还需要事先证明内部的连通关系。', example: '示意：A 已占 4 格，要求 ≥5，只有箭头方向可以继续生长。' },
      { id: 'border', title: '04 · 双区域的边界定式', idea: '若无孔棋盘最终只有 A、B 两个连通区域，共同边界不能产生令其中一方断开的交叉或孤立分支。', premise: '必须先证明全盘恰好两个区域；目前只涂了两种颜色不算证明。', deduction: '追踪 A/B 已知分界，判断某种新画法会不会切断 A 或 B。若必然切断就排除；若还包含环纹规则，这条分界不能碰到外框，只能在内部闭合。', warning: '同一行出现多次 A/B 交替未必错误：连续曲折的边界也可能多次穿越同一行。要看全局连通。', example: '示意：弯弯曲曲的 A/B 分界，两边仍然各自连通。' },
      { id: 'diagonal', title: '05 · 双区域的对角定式', idea: '若仅有两个连通区域，2×2 的 A B / B A 对角交错不可能完成。', premise: '必须确认整个棋盘恰好只有 A 和 B 两个连通区域；A/B 是区域身份，不是装饰颜色。', deduction: '若两条对角线分别都是 A、B，那么 A 与 B 想各自连接就必定互相阻隔，因此至少有一个归属假设错误。', warning: '如果允许三个或更多区域，四条边界交叉可能合法；对角接触不能让区域连通。', example: '反例：A B / B A（×），两块无法在平面上同时保持连通。' },
    ],
  },
  en: {
    intro: 'Begin with local certainties, then use connectivity and parity. The examples do not reveal the current puzzle.',
    premise: 'Applies when', deduction: 'Deduction', warning: 'Watch out', sources: 'Further reading',
    tips: [
      { id: 'vertex', title: '01 · Loopy vertex parity', idea: 'Loopy requires 0, 2, or 4 border segments at each vertex.', premise: 'The Loopy rule applies and the incident edges are known.', deduction: 'Three confirmed borders force the fourth border. If two borders are known and one edge is undecided, it must be open.', warning: 'Four-way crossings are legal in general Loopy, but not when the entire board is precisely two connected regions.', example: 'Three known borders around a vertex force the fourth.' },
      { id: 'parity', title: '02 · Loopy two-color parity', idea: 'Temporarily mark regions 0 and 1. Crossing a confirmed border flips parity; crossing a known join preserves it.', premise: 'Loopy is in effect or the region adjacency graph is otherwise proven two-colorable.', deduction: 'Odd numbers of border crossings flip 0 to 1; even crossings return to 0. Equal-parity adjacent cells must join, opposite-parity neighbors must have a border.', warning: 'This is not parity of region area. Separate regions with the same 0 label need not be connected.', example: 'Outer 0 → middle ring 1 → center 0. Each border flips parity.' },
      { id: 'exit', title: '03 · Single exit and minimum area', idea: 'Look for a pocket surrounded by known borders and count remaining ways to reach outside.', premise: 'A known region A contains the four pocket cells, must be at least size five and has only one possible exit.', deduction: 'Four cells are insufficient; the sole exit must be joined to the outside so that A can grow.', warning: 'A pocket with one exit does not by itself prove that all cells inside belong to the same region.', example: 'A has four confirmed cells but needs ≥5, so it must expand through the arrowed edge.' },
      { id: 'border', title: '04 · Two regions: continuous boundary', idea: 'With exactly two connected regions A and B on a hole-free board, their interface cannot branch or break either region apart.', premise: 'First prove exactly two regions. Two display colors do not establish the region count.', deduction: 'Extend known A/B borders and reject any candidate that necessarily disconnects A or B. With Loopy the separating border must stay inside the frame and close.', warning: 'Several A/B transitions in one row can come from a winding continuous interface; they are not automatically wrong.', example: 'A winding boundary can still separate two connected regions.' },
      { id: 'diagonal', title: '05 · Two regions: diagonal trap', idea: 'In a 2×2 block, A B / B A cannot occur if the entire board has only two connected regions.', premise: 'A and B are the two proven region identities, not decorative colors.', deduction: 'The two A cells and two B cells cannot both reconnect without their paths crossing; reject at least one assignment.', warning: 'Four-way meetings may be legal with three or more regions. Diagonal touching is not a join.', example: 'Forbidden arrangement: A B / B A (×).' },
    ],
  },
  ko: {
    intro: '국소 확정 정보에서 연결성, 홀짝 색칠로 확장해 보세요. 그림은 현재 퍼즐의 정답이 아닙니다.',
    premise: '적용 조건', deduction: '추론', warning: '주의', sources: '참고 자료',
    tips: [
      { id: 'vertex', title: '01 · 고리: 꼭짓점의 짝수성', idea: '고리 규칙에서는 한 꼭짓점에 경계선이 0, 2, 4개만 모일 수 있습니다.', premise: '고리 규칙이 있고 해당 변의 상태를 확실히 알 때입니다.', deduction: '세 변이 경계선이면 네 번째도 경계선입니다. 두 변이 경계선이고 하나만 미정이라면 그 변은 연결입니다.', warning: '네 선 교차는 일반 고리 퍼즐에서 가능하지만 전체가 연결된 두 구역뿐이면 불가능합니다.', example: '세 경계선이 결정되면 네 번째도 경계선입니다.' },
      { id: 'parity', title: '02 · 고리: 홀짝 색칠', idea: '구역에 임시로 0 또는 1을 표시하고 경계선을 넘을 때마다 값을 바꿉니다.', premise: '고리 규칙이 있거나 구역의 두 색 분류를 증명했을 때입니다.', deduction: '경계선을 홀수 번 넘으면 1, 짝수 번 넘으면 0입니다. 인접한 같은 값은 연결, 다른 값은 경계선입니다.', warning: '구역 넓이의 홀짝이 아니며 떨어진 두 0 구역이 반드시 같은 구역인 것도 아닙니다.', example: '바깥 0 → 가운데 1 → 중심 0.' },
      { id: 'exit', title: '03 · 유일한 출구와 넓이', idea: '경계선에 둘러싸인 작은 공간에서 밖으로 나갈 수 있는 출구를 세어 보세요.', premise: 'A 구역의 네 칸이 확정되고 최소 다섯 칸이 필요한데 출구가 하나뿐입니다.', deduction: '네 칸으로는 넓이 조건을 채울 수 없으므로 마지막 출구는 반드시 연결해야 합니다.', warning: '출구가 하나뿐이라고 내부의 모든 칸이 같은 구역인 것은 아닙니다.', example: 'A가 최소 5칸이어야 하므로 화살표 방향으로 나갑니다.' },
      { id: 'border', title: '04 · 두 구역의 경계', idea: '구멍 없는 보드가 연결된 A, B 두 구역뿐이라면 경계가 어느 한쪽을 끊을 수 없습니다.', premise: '먼저 구역이 정확히 둘임을 증명하세요. 색을 두 개 쓴 것만으로는 부족합니다.', deduction: '후보 경계가 A나 B를 끊는지 확인해 그런 경우를 제외합니다. 고리 규칙이 함께 있으면 경계가 안쪽에서 닫힙니다.', warning: '한 행에서 A/B가 여러 번 바뀌어도 연속된 구불구불한 경계일 수 있습니다.', example: '구부러진 A/B 경계 양쪽이 각각 연결됩니다.' },
      { id: 'diagonal', title: '05 · 두 구역의 대각선 정식', idea: '2×2 칸이 A B / B A가 되면 두 구역이 동시에 연결될 수 없습니다.', premise: '보드 전체가 연결된 A, B 두 구역뿐임이 증명되어야 합니다.', deduction: '양 대각선의 두 쌍이 서로를 막으므로 제안된 배치 중 적어도 하나를 바꿔야 합니다.', warning: '세 개 이상의 구역에서는 네 선이 교차할 수 있습니다. 대각선 접촉은 연결이 아닙니다.', example: '불가능한 배치: A B / B A (×).' },
    ],
  },
};

const EXAMPLES: Record<TipId, readonly string[]> = {
  vertex: ['AB', 'CD'],
  parity: ['00000', '01110', '01010', '01110', '00000'],
  exit: ['AA..', 'AA..', '....', '....'],
  border: ['AAAB', 'AAAB', 'AABB', 'ABBB'],
  diagonal: ['AB', 'BA'],
};

export function tipExample(id: TipId): readonly string[] {
  return EXAMPLES[id];
}

function makeExample(id: TipId, label: string): HTMLElement {
  const rows = EXAMPLES[id];
  const figure = document.createElement('figure');
  figure.className = 'tip-example';
  const board = document.createElement('div');
  board.className = 'tip-board';
  board.style.gridTemplateColumns = 'repeat(' + rows[0].length + ', 32px)';
  board.setAttribute('role', 'img');
  board.setAttribute('aria-label', label);
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[0].length; x++) {
      const value = rows[y][x];
      const cell = document.createElement('span');
      cell.className = 'tip-cell tip-cell-' + (value === '.' ? 'blank' : value);
      cell.textContent = id === 'exit' && x === 1 && y === 1 ? 'A→' : value === '.' ? '' : value;
      if (x < rows[0].length - 1 && value !== rows[y][x + 1] &&
          !(id === 'exit' && x === 1 && y === 1)) {
        cell.classList.add('tip-wall-right');
        if (id === 'vertex' && x === 0 && y === 1) cell.classList.add('tip-forced-wall');
      }
      if (y < rows.length - 1 && value !== rows[y + 1][x]) cell.classList.add('tip-wall-bottom');
      board.append(cell);
    }
  }
  figure.append(board);
  const caption = document.createElement('figcaption');
  caption.textContent = label;
  figure.append(caption);
  return figure;
}

function note(title: string, body: string, css: string): HTMLElement {
  const p = document.createElement('p');
  p.className = css;
  const b = document.createElement('strong');
  b.textContent = title + '：';
  p.append(b, document.createTextNode(body));
  return p;
}

export function renderBeginnerTips(container: HTMLElement, lang: Lang, puzzle?: Puzzle): void {
  renderTipGallery(container, lang, puzzle);
}
