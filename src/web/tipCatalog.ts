import type { Lang } from './i18n.ts';
import type { RuleKind } from '../engine/types.ts';

export type TipGroup = 'basics' | 'rules' | 'advanced';
export type ExtraTipId =
  | 'path' | 'areaFull' | 'areaRemainder' | 'fenceRotate' | 'fenceOpen'
  | 'brickyThree' | 'brickyCorner' | 'boxyBounds' | 'shapeFilter'
  | 'towerExtreme' | 'compassCount' | 'roseSeparate'
  | 'sizeChain' | 'combinedArea' | 'parityFence';

export type TipCopy = { title: string; idea: string; premise: string; deduction: string; warning: string };
export type ExtraTip = { id: ExtraTipId; group: TipGroup; rules: readonly RuleKind[]; copy: Record<Lang, TipCopy> };

type CopyTuple = readonly [string, string, string, string, string];
function unpack([title, idea, premise, deduction, warning]: CopyTuple): TipCopy {
  return { title, idea, premise, deduction, warning };
}
function add(id: ExtraTipId, group: TipGroup, rules: RuleKind[], zh: CopyTuple, en: CopyTuple, ko: CopyTuple): ExtraTip {
  return { id, group, rules, copy: { zh: unpack(zh), en: unpack(en), ko: unpack(ko) } };
}

/** Optional deductions, never uniqueness arguments. A per-tip prerequisite must be proved first. */
export const EXTRA_TIPS: readonly ExtraTip[] = [
  add('path', 'basics', ['rose', 'solitude', 'areaNumber', 'boxy'],
    ['必经通道', '若同一区域的两块确定格之间只有一条可行通道，路径上的格必须同区。', '已经证明 A 两端同属一区，且其他路线都被已知边界或规则排除。', '沿唯一通道逐格连通，若通道不可用则原假设矛盾。', '只知道两个格带有相同装饰颜色还不够；必须证明它们属于同一个区域。'],
    ['Forced connecting path', 'If two confirmed pieces of one region have only one viable corridor, that corridor belongs to the region.', 'Both A endpoints belong to the same region and every alternative path is excluded.', 'Join all cells on the sole corridor; if it is blocked, the assumptions conflict.', 'Matching decorative colors do not prove region identity.'],
    ['필수 연결 통로', '같은 구역으로 확정된 두 부분 사이에 가능한 길이 하나라면 그 길의 칸도 같은 구역입니다.', '양끝이 같은 구역임을 증명했고 다른 길은 모두 막혀야 합니다.', '유일한 통로를 따라 연결합니다. 막혀 있다면 가정이 모순됩니다.', '장식 색이 같다고 같은 구역인 것은 아닙니다.']),
  add('areaFull', 'basics', ['areaNumber', 'range', 'polyomino'],
    ['面积饱和', '区域已经达到精确面积或最大面积，就不能再接纳其他格。', 'A 的上限确定为 4，已知 A 有 4 格且这些格连通。', '把 A 与其它未确定格相接的边全部画为边界。', '“至少 4 格”只是下界，不能据此封边。'],
    ['Area saturation', 'Once a region reaches its exact size or maximum size, it cannot grow.', 'The known connected A region has four cells and its upper bound is four.', 'Mark every remaining neighboring edge of A as a border.', 'A minimum of four is not a maximum; do not close the region in that case.'],
    ['넓이 포화', '구역이 정확한 넓이나 최대 넓이에 도달하면 더 커질 수 없습니다.', 'A의 최대 넓이가 4이고 이어진 네 칸이 A로 확정됐습니다.', 'A 주변의 남은 경계선을 모두 긋습니다.', '최소 4칸만 알려졌다면 닫을 수 없습니다.']),
  add('areaRemainder', 'basics', ['range', 'shapeBank', 'match'],
    ['封闭口袋的面积余数', '完全封闭的一块棋盘必须能被允许的区域面积组合填满。', '全盘每个区域都恰好为 3 格，而口袋内有 8 个有效格、不能连到外侧。', '8 不能写成若干个 3 的和，所以“口袋已封闭”必然错误；至少有一条封边需要改。', '只有全盘统一的固定面积（或已证明口袋的所有区域面积集合）时才能使用；普通数字题不能直接按 3 整除。'],
    ['Sealed-pocket remainder', 'A completely sealed pocket must be tileable by the permitted region sizes.', 'Every region has exactly three cells and an eight-cell pocket cannot reach outside.', 'Eight is not a multiple of three. The proposed seal is impossible.', 'A numbered region does not mean every region has the same size. Prove the global size restriction first.'],
    ['닫힌 공간의 넓이 나머지', '완전히 닫힌 공간은 허용된 구역 넓이들의 합으로 채워져야 합니다.', '모든 구역이 정확히 3칸인데 완전히 닫힌 공간은 8칸입니다.', '8은 3의 배수가 아니므로 닫힌 경계가 불가능합니다.', '숫자 하나만 보고 모든 구역이 3칸이라고 가정하지 마세요.']),
  add('fenceRotate', 'rules', ['fenceShape'],
    ['围栏旋转与镜像排除', '逐个列出围栏符号可旋转或镜像的边界形态，利用已知边筛选。', '围栏形状符号给出同一种四边界图案；外框和缺口一律视为边界。', '假设 L 形边界恰好两条相邻边；若北侧已确认连通，删去所有含北边界的方向，继续用东侧等信息锁定唯一朝向。', '官方围栏图案允许旋转/镜像，且只有形状匹配才成立；不要误用在固定朝向的“定向围栏”。'],
    ['Rotate / reflect a fence', 'Try every rotated or reflected boundary pattern and discard candidates inconsistent with known edges.', 'The fence symbol specifies the boundary pattern around its cell; outer frame and holes count as borders.', 'For an L-shaped fence, a known open north edge excludes every north-facing boundary candidate. Other edges narrow it to one.', 'This applies to the rotatable Fence Shape rule, not the fixed-direction Palisade clue.'],
    ['울타리 회전·대칭 제거', '울타리 무늬를 회전·반사시킨 후보 중 알려진 변과 맞지 않는 것을 제외합니다.', '외곽과 구멍도 경계선이며 울타리는 중심 칸의 경계 형태를 정합니다.', 'L자 울타리에서 북쪽이 연결이라면 북쪽 경계가 있는 후보는 제외합니다.', '고정 방향 울타리와 혼동하지 마세요.']),
  add('fenceOpen', 'rules', ['fenceShape', 'palisade'],
    ['围栏的非边界信息', '围栏规定“有线”的边，也同时规定“无线”的边。', '某围栏只要求相对两边为边界，另两边无边界。', '若确定南北两侧是分界线，那么东西两侧必须连通；反过来，若北侧已连通，只能采用东西为边界的方向。', '若遇棋盘外框，外框天然是边界，候选方向还要额外满足它。'],
    ['Open edges of fences', 'A fence tells you where borders are absent as well as where they are present.', 'Its pattern has two opposite boundary edges and two open edges.', 'Known north/south borders force open east/west edges; a known open north edge forces an east/west border orientation.', 'A board-frame edge is always a border and further restricts possibilities.'],
    ['울타리의 열린 변', '울타리 기호는 경계선뿐 아니라 연결되는 변도 알려 줍니다.', '서로 마주 보는 두 변만 경계선인 무늬입니다.', '남북이 경계선이면 동서는 연결이고, 북쪽이 연결이면 동서가 경계선입니다.', '보드의 바깥 변은 언제나 경계선입니다.']),
  add('brickyThree', 'rules', ['bricky'],
    ['砖纹：三边定式', '砖纹禁止某个内部顶点四条分界线同时汇聚。', '一个内部顶点已有三条确定的分界线、第四边待定。', '剩余第四条必须连通，而不是画边界；与环纹的“3 推 4”恰好相反。', '只讨论有四条内部格边的顶点；别把外框线算入四条。'],
    ['Bricky: three-edge rule', 'Bricky forbids a vertex from having four meeting borders.', 'At an interior vertex three borders are confirmed, one edge unknown.', 'The last edge must be open — the opposite of the Loopy deduction.', 'Count only actual interior cell-to-cell edges, not frame lines.'],
    ['벽돌: 세 경계선', '벽돌 규칙은 한 꼭짓점에 경계선 네 개가 만나는 것을 금지합니다.', '내부 꼭짓점에서 세 변이 이미 경계선입니다.', '나머지 하나는 반드시 연결입니다. 고리 규칙과 반대입니다.', '바깥 테두리를 네 변에 세지 마세요.']),
  add('brickyCorner', 'rules', ['bricky'],
    ['砖纹：避免四线角接触', '有些局部角接触会逼出四条分界线的十字，这种候选画法必须排除。', '两组待连接边界在同一个内部顶点会凑成四条分界线。', '如果已有三条边界，阻止第四条封闭；推理应落到具体顶点，不能笼统禁止所有对角接触。', '两个不同区域只在对角相接并不总违反砖纹；只有产生四条分界线的顶点才违例。'],
    ['Bricky: avoid four-line corners', 'Some corner-to-corner boundaries would create a forbidden four-way crossing.', 'The proposed configuration puts four borders around the same interior vertex.', 'Reject the last proposed border once three others are already fixed.', 'Not every diagonal meeting is forbidden. The actual four-border intersection is the violation.'],
    ['벽돌: 네 선의 모서리 교차 방지', '어떤 대각 모서리 배치는 금지된 네 갈래 경계를 만듭니다.', '내부 꼭짓점에 경계선 네 개가 모이는 상황입니다.', '이미 세 선이 있다면 네 번째를 막아야 합니다.', '모든 대각 만남이 금지된 것은 아닙니다.']),
  add('boxyBounds', 'rules', ['boxy'],
    ['矩形外接框补全', '确定两个格同属一个矩形区域后，两点之间的轴对齐矩形也都属于该区域。', '本关要求每个区域是矩形，A 两格已被证明属于同一区。', '把两格的行列范围构成最小矩形，将其内部所有格标为 A。若穿过已知分界线，则假设矛盾。', '若两格只是颜色一样但未证明连通，不能强行补成矩形。'],
    ['Boxy: bounding rectangle', 'Two known cells in one rectangular region force every cell of their minimum bounding rectangle.', 'Boxy is active and both A cells belong to one region.', 'Fill the entire axis-aligned rectangle between them with A. A known wall inside disproves the assumption.', 'Matching colors alone do not prove the cells share a region.'],
    ['사각형: 바깥 사각형 채우기', '같은 직사각형 구역의 두 칸을 알면 두 칸을 감싸는 최소 직사각형이 모두 같은 구역입니다.', '사각형 규칙이며 두 A가 같은 구역으로 확정됐습니다.', '두 칸 사이의 직사각형을 A로 채웁니다.', '색이 같다는 이유만으로 같은 구역이라고 할 수는 없습니다.']),
  add('shapeFilter', 'rules', ['shapeBank', 'polyomino', 'match', 'mismatch', 'gemini', 'delta'],
    ['形状库候选排除', '用面积、外接框、固定边界和已知连通格逐步筛掉形状。', '已知某区域必须从指定形状库选择，形状允许按该规则旋转和翻转。', '先用面积排除，再检查候选是否能覆盖所有 A 格且避开已知边界；只有一个候选时可推出其它格边。', '不能只按屏幕上的形状朝向比较；要考虑规则允许的旋转和镜像。'],
    ['Shape-bank elimination', 'Filter candidate shapes by area, bounding box, fixed borders, and known joined cells.', 'The region is restricted to a shape bank; rotations/reflections are allowed by the shape rule.', 'Eliminate by area, then test whether each candidate covers all known A cells without crossing fixed walls.', 'Do not assume the on-screen orientation is fixed.'],
    ['도형 후보 제거', '넓이·외접 사각형·경계·연결 칸으로 후보 도형을 제거합니다.', '구역에 허용된 도형 목록이 있으며 회전과 반사를 고려합니다.', '먼저 넓이로 거르고 A 칸과 알려진 경계를 모두 만족하는지 확인합니다.', '화면에 보이는 방향만 비교하지 마세요.']),
  add('towerExtreme', 'rules', ['watchtower'],
    ['瞭望塔的 1 与最大值', '塔旁围着的有效格中，数字 1 要求全都同区；数字等于有效格数则要求全都不同区。', '瞭望塔标在格点上，只统计该格点周围实际存在的格子。', '内部塔标 1 → 四格全连通；内部塔标 4 → 四格互不同区，交汇内边均为分界线。', '靠边或挖空时不足四格，最大值是实际有效格数；只沿角相碰不代表连通。'],
    ['Watchtower extremes', 'A 1 at a vertex means its incident cells share one region; the maximum count means all distinct regions.', 'Count only active cells touching that vertex.', 'Interior tower 1 joins all four cells; interior tower 4 separates each pair of neighbors.', 'On borders or holes fewer than four cells may touch the tower.'],
    ['감시탑의 최솟값과 최댓값', '꼭짓점 주위 1은 모든 칸이 같은 구역, 최댓값은 모두 다른 구역을 뜻합니다.', '실제로 꼭짓점에 닿는 유효 칸만 세세요.', '내부의 1은 네 칸 연결, 4는 네 칸 모두 다른 구역입니다.', '가장자리나 구멍 근처에는 네 칸보다 적을 수 있습니다.']),
  add('compassCount', 'rules', ['compass'],
    ['罗盘：四向计数分解', '罗盘计算整个区域里位于标记格上/下/左/右的格数，而非仅统计相邻格。', '已确定某些格与罗盘格同区，并且对应方向数字非负。', '分别统计各方向，同一对角格可同时计入竖向和横向；方向为 0 就不能再有该方向的同区格。', '不要把四个数字相加当作区域面积减一，因为斜向格可能重复计数。'],
    ['Compass: directional counts', 'Compass clues count every cell in the same region above/below/left/right of the clue, not just neighbors.', 'You know the compass cell’s region and a nonnegative constraint for a direction.', 'Count across all rows/columns; diagonal-offset cells can count once vertically and once horizontally. A zero forbids that direction.', 'Do not sum all four arrows to get area minus one: some cells contribute to two directions.'],
    ['나침반: 네 방향 개수', '나침반은 인접한 칸뿐 아니라 같은 구역의 모든 위·아래·왼쪽·오른쪽 칸을 셉니다.', '같은 구역의 칸과 해당 방향의 제한을 알고 있습니다.', '대각 위치의 칸은 세로와 가로에 동시에 셀 수 있습니다. 0인 방향은 같은 구역 칸이 없습니다.', '네 수의 합을 구역 넓이보다 하나 적은 값으로 보지 마세요.']),
  add('roseSeparate', 'rules', ['rose', 'solitude'],
    ['玫瑰窗与独一符号分离', '同一个玫瑰窗符号不能重复出现在同一区域；一个区域缺必需符号就不能封闭。', '玫瑰窗要求每种符号恰好一个；独居规则则要求每区域恰好一个被计入的符号。', '相邻的同种玫瑰符号之间必须有边界；缺少所需符号的区域必须保持可通达。独居时相邻两个不同符号也必须分开。', '不同符号在玫瑰窗中往往必须同区配齐，但在独居规则下不能同区；先看当前是哪种规则。'],
    ['Rose / Solitude symbol separation', 'A Rose region cannot repeat a symbol, nor close before collecting each required symbol.', 'Rose requires one of each kind; Solitude requires exactly one counted symbol per region.', 'Separate adjacent repeated Rose symbols and keep missing symbols reachable. Solitude separates any two adjacent counted clues.', 'Rose combines distinct symbol kinds, while Solitude separates counted clues: they are different rules.'],
    ['장미창과 유일 기호 분리', '장미창은 같은 기호가 한 구역에 두 개 있을 수 없으며 필요한 기호 없이 닫을 수도 없습니다.', '장미창은 각 기호 하나씩, 유일 규칙은 구역마다 기호 하나입니다.', '인접한 같은 장미창 기호는 분리합니다. 기호가 부족한 구역은 열어 두세요.', '서로 다른 기호를 모으는 장미창과 기호를 분리하는 유일 규칙을 혼동하지 마세요.']),
  add('sizeChain', 'advanced', ['inequality', 'difference', 'sizeSeparation'],
    ['面积不等式与差值链', '已确定相邻区域的严格大小关系可以沿链传递出面积下界或上界。', '已确定三个不同区域 A、B、C，且 A > B、B > C，面积都是正整数。', '从 C ≥ 1 得 B ≥ 2、A ≥ 3；若还有 A ≤ 2，则这条候选关系矛盾。差值规则则可直接累加等式限制。', '仅仅相邻面积“不能相等”并不表示可推出某个大小方向；差值 0 也不能当成严格大于。'],
    ['Area inequality / difference chains', 'Known strict size relationships between regions can be chained into area bounds.', 'A, B, and C are distinct with A > B > C and positive integer sizes.', 'C ≥ 1 gives B ≥ 2 and A ≥ 3. If A ≤ 2, the assumptions contradict. Exact differences give stronger constraints.', 'Size Separation only means unequal, not a known greater-than direction. Difference 0 is equality.'],
    ['넓이 부등식·차이 연쇄', '서로 다른 구역 간 엄격한 크기 관계를 연결하면 넓이 하한·상한을 얻습니다.', '서로 다른 A > B > C이고 넓이는 양의 정수입니다.', 'C ≥ 1이면 B ≥ 2, A ≥ 3입니다. A ≤ 2라면 모순입니다.', '서로 넓이가 다르다는 조건은 어느 쪽이 큰지 정하지 않습니다.']),
  add('combinedArea', 'advanced', ['areaNumber', 'range', 'rose', 'solitude'],
    ['面积与出口组合推理', '很多“看似要连通”的格边，只有加入面积或必需符号后才能得出必然结论。', '一个口袋目前确认 4 格同属 A、唯一出口尚未决定。', '先观察：仅凭唯一出口无法推理；再加入“ A 至少 5 格”，排除封住出口，于是该边必须连通。', '不要把“高度可能的区域形状”冒充确定连通；始终标出新增的规则前提。'],
    ['Combining area with an exit', 'A single-exit pattern becomes forced only when an extra size or symbol requirement makes growth necessary.', 'Four joined A cells have one unknown exit.', 'Without a lower bound the exit is undecidable; add A ≥ 5 and its only exit must be open.', 'A likely-looking region outline is not a proof: cite the extra constraint.'],
    ['넓이와 출구 결합', '유일한 출구는 넓이나 기호 요구가 더해질 때 비로소 필수가 됩니다.', 'A의 네 칸이 연결됐고 출구가 하나 남았습니다.', '넓이 조건 없이 미정이지만 A ≥ 5가 되면 출구가 연결됩니다.', '그럴듯해 보이는 형태만으로 결론 내리지 마세요.']),
  add('parityFence', 'advanced', ['loopy', 'fenceShape'],
    ['环纹染色与围栏联动', '把环纹的奇偶标记和围栏四边形状结合，可以远距离锁定围栏朝向。', '环纹与可旋转围栏规则同时成立，某围栏格的奇偶组已知。', '假设中心是 0，若围栏在南北两侧要求边界，则南北邻格为 1、东西邻格为 0；已知任一邻格的奇偶可筛去不匹配的旋转候选。', '围栏方向必须先由图案形状允许；只有“染色已确定”的格子才可传播。'],
    ['Loopy parity + fence', 'Combine Loopy parity labels with fence edge patterns to constrain possible fence orientations.', 'Both Loopy and rotatable Fence Shape are active, and the center parity is established.', 'Center 0 with north/south borders forces north/south neighbors to 1 and east/west to 0; compare with known neighbor parity.', 'Check the pattern supports that orientation; do not guess unknown parity.'],
    ['고리 홀짝과 울타리 결합', '고리의 홀짝 색칠과 울타리 무늬를 결합해 방향을 결정합니다.', '고리와 회전 가능한 울타리가 함께 있고 중심 칸의 홀짝이 결정됐습니다.', '중심 0에 남북 경계가 있으면 남북은 1, 동서는 0입니다. 이로써 후보를 제거합니다.', '가능한 울타리 방향과 이미 확정된 홀짝만 사용하세요.']),
];

export const ORIGINAL_METADATA = {
  vertex: { group: 'basics', rules: ['loopy'] },
  parity: { group: 'basics', rules: ['loopy'] },
  exit: { group: 'basics', rules: ['areaNumber', 'range', 'rose'] },
  border: { group: 'advanced', rules: ['rose', 'solitude', 'loopy'] },
  diagonal: { group: 'advanced', rules: ['rose', 'solitude'] },
} as const satisfies Record<string, { group: TipGroup; rules: readonly RuleKind[] }>;

export const GROUPS: Record<Lang, Record<TipGroup, string>> = {
  zh: { basics: '基础技巧', rules: '规则专题', advanced: '进阶组合' },
  en: { basics: 'Foundations', rules: 'Rule-specific', advanced: 'Advanced combinations' },
  ko: { basics: '기초 추론', rules: '규칙별 요령', advanced: '심화 조합' },
};

export const TOOL_LABELS: Record<Lang, { all: string; relevant: string; next: string; previous: string; step: string; note: string; empty: string }> = {
  zh: { all: '全部技巧', relevant: '适用本关', next: '下一步 →', previous: '← 上一步', step: '步骤', note: '只在已证明前提时使用，不以“题目只有唯一解”为理由推理。', empty: '本关没有直接对应的专题；可切换“全部技巧”。' },
  en: { all: 'All tips', relevant: 'For this level', next: 'Next step →', previous: '← Previous', step: 'Step', note: 'Use deductions only after proving their premises; never assume uniqueness as a shortcut.', empty: 'No directly matching techniques. Switch to All tips.' },
  ko: { all: '전체 요령', relevant: '현재 퍼즐에 맞게', next: '다음 단계 →', previous: '← 이전 단계', step: '단계', note: '전제를 증명한 뒤 적용하고 유일해 보인다는 이유만으로 추론하지 마세요.', empty: '직접 연결되는 팁이 없습니다. 전체 요령을 확인하세요.' },
};
