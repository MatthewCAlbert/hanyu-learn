import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),

  // Level-scoped browsing. `:level` is a comma list — "1", "2" or "1,2" — so a
  // multi-level selection stays in the path and stays bookmarkable.
  route("hsk/:level", "routes/level.tsx", [
    route("hanzi", "routes/level.hanzi.tsx"),
    route("words", "routes/level.words.tsx"),
    route("topics", "routes/level.topics.tsx"),
    route("radicals", "routes/level.radicals.tsx"),
    route("phonetics", "routes/level.phonetics.tsx"),
  ]),

  route("credits", "routes/credits.tsx"),
  route("settings", "routes/settings.tsx"),
  route("compare", "routes/compare.tsx"),
  route("translate", "routes/translate.tsx"),
  route("songs", "routes/songs.tsx"),
  route("songs/:songId", "routes/songs.$songId.tsx"),

  // Detail pages are level-independent: 好 is one character with one page.
  route("hanzi/:char", "routes/hanzi.$char.tsx"),
  route("words/:word", "routes/words.$word.tsx"),
  route("radicals/:radical", "routes/radicals.$radical.tsx"),
  route("phonetic/:component", "routes/phonetic.$component.tsx"),
  route("topics/:topic", "routes/topics.$topic.tsx"),
  route("lexemes/:form", "routes/lexemes.$form.tsx"),
] satisfies RouteConfig;
