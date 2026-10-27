# Community Workshop picks / 社区精选

Pane-by-Pane has a **discovery-only** Community Workshop tab in **Levels** with
20 actual `The Artisan of Glimmith` Steam Workshop submissions. Each item links
to the original Steam page and credits its creator. The list was reviewed on
2026-10-27; online listings may later be changed, removed or made private.

## How to use

1. Open **Levels → Workshop picks**.
2. Browse Favorites, Logic Challenges or Funny & Artistic, or search by title/creator.
3. **View on Steam** opens the real Workshop page. Subscribe and play that
   community creation in the original game; a Steam subscription does **not**
   make it playable in Pane-by-Pane.
4. To play a separately obtained, authorized and converted puzzle in
   Pane-by-Pane, choose **Import a compatible JSON pack**. The existing pack
   validator checks supported rules, board dimensions and the complete solution,
   then stores the pack locally. Imported puzzles appear under the personal pack
   in **Playable levels**, with their own stable progress IDs.

## Format and limitations

The import format is the standard `PresetPack` in `src/presets.ts`:
`{ "version": 1, "name": "...", "levels": [...] }`. Each level must include
`id`, `title`, `puzzle`, `solution`, `stars` and `difficulty`. See
`public/presets/glimmith.json` for a minimal example. This is **not** the native
Steam Workshop format. The application currently does not auto-download Steam
items, convert opaque Workshop episodes, or synchronize Steam subscriptions.

### Respecting authors and maintaining quality

The Workshop pages identify creators, but do **not** provide blanket permission
to redistribute their puzzle data. For that reason, no third-party playable files
or screenshots are copied into the public repository or Android package in this
change. Before adding any Workshop puzzle to a public playable bundle:

- obtain creator permission / a redistributable license (and check game rights);
- obtain the actual puzzle and solution in an authorized way;
- convert supported rules explicitly, rejecting unsupported fields;
- validate its solution and uniqueness with the engine;
- retain attribution, Workshop ID and links;
- keep stable IDs so local completion data survives reorders.

The current curated list lives in `src/web/communityCatalog.ts`. It is not a
rating leaderboard or a verified set of twenty playable levels.

## 验收

在关卡页可切换「可玩关卡 / 社区精选」，搜索作品或作者并跳转到 Steam
创意工坊。可以导入**合法取得且转换完成**的本地 JSON，在「可玩关卡」
中游玩并保存进度。社区精选仅提供作品发现，不假装下载或内置 Steam 题目。
