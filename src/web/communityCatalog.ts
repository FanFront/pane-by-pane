/**
 * A reviewed discovery list, not redistributed Workshop files.
 * Item IDs, titles and creators were checked against Steam's Glimmith Workshop
 * on 2026-10-27. A Workshop listing does not grant reuse permission.
 */
export type CommunityCategory = 'favorites' | 'logic' | 'art';
export interface CommunityPick {
  id: string;
  title: string;
  creator: string;
  category: CommunityCategory;
  description: string;
}

export const COMMUNITY_GROUPS: readonly {id: CommunityCategory; zh: string; en: string; ko: string}[] = [
  {id: 'favorites', zh: '人气精选', en: 'Community favorites', ko: '인기 추천'},
  {id: 'logic', zh: '巧妙逻辑', en: 'Logic challenges', ko: '논리 도전'},
  {id: 'art', zh: '趣味与艺术', en: 'Funny & artistic', ko: '재미와 예술'},
];

export const COMMUNITY_PICKS: readonly CommunityPick[] = [
  {id:'3783351588',title:"Alien's Rocks",creator:'DiIdoBike',category:'favorites',description:'An intricate Match and symmetry challenge.'},
  {id:'3753416728',title:'Parquet',creator:'Perpetual',category:'favorites',description:'An acclaimed puzzle full of structural deductions.'},
  {id:'3779441182',title:'No Pentomino Left Behind',creator:'nono',category:'favorites',description:'Region shapes and pentomino reasoning.'},
  {id:'3762428803',title:'Precise Palisades',creator:'nono',category:'favorites',description:'A challenge built around palisade constraints.'},
  {id:'3766923607',title:'Cutting Corners',creator:'SS_Edgeworth',category:'favorites',description:'A geometric partitioning puzzle.'},
  {id:'3732700253',title:'lunchbox',creator:'tanoc-ne',category:'favorites',description:'A playful puzzle with a unique solution, according to its creator.'},
  {id:'3773395637',title:'nitt the mantis',creator:'nittneuk',category:'favorites',description:'A distinctive community-made board.'},
  {id:'3722627394',title:'wayblocker',creator:'tanoc-ne',category:'logic',description:'A blocked passage changes the possibilities.'},
  {id:'3731120439',title:'imperfect square',creator:'tanoc-ne',category:'logic',description:'An unusual take on square geometry.'},
  {id:'3755077477',title:'Seviper',creator:'Fafrd',category:'logic',description:'An animal-shaped Workshop challenge.'},
  {id:'3817094224',title:'Bat-tle of rose windows',creator:'Babaisyoo',category:'logic',description:'A seasonal twist on the Rose Window rule.'},
  {id:'3820664078',title:'The Pumpkin of Glimmith',creator:'Fabri_JJX',category:'art',description:'A pumpkin-themed stained-glass puzzle.'},
  {id:'3817987002',title:'Haunting Houses is Hard',creator:'JamesIsStillSane',category:'art',description:'A haunted-house partitioning challenge.'},
  {id:'3817211386',title:'Ghostenstein',creator:'Zingoss',category:'art',description:'A spooky community creation.'},
  {id:'3817180912',title:'Sp-loopy Spooder',creator:'IAmDeviant',category:'art',description:'A spider-themed Loopy challenge.'},
  {id:'3824164658',title:'Skully',creator:'Acheron',category:'art',description:'A skull-shaped seasonal design.'},
  {id:'3820421215',title:"A Witch's Broom",creator:'birisi',category:'art',description:'A witchy themed board.'},
  {id:'3817647755',title:'Happy Skull',creator:'GM Alexandria',category:'art',description:'A playful skull-themed puzzle.'},
  {id:'3817597514',title:"WILL O' WISP",creator:'palidisci',category:'art',description:'A luminous Halloween-style design.'},
  {id:'3823370879',title:'A Ghostly Message',creator:'Awesome Phoenix',category:'art',description:'A mystery message to uncover after solving.'},
];

/** Construct URLs only from our verified numeric IDs; never use untrusted URLs. */
export function workshopUrl(pick: CommunityPick): string {
  if (!/^\d{8,20}$/.test(pick.id)) throw new Error('Invalid Steam Workshop item ID');
  return 'https://steamcommunity.com/sharedfiles/filedetails/?id=' + pick.id;
}
