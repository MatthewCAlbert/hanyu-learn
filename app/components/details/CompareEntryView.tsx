import { HanziDetailContent } from "./HanziDetailContent";
import { WordDetailContent } from "./WordDetailContent";
import { RadicalDetailContent } from "./RadicalDetailContent";
import { PhoneticDetailContent } from "./PhoneticDetailContent";
import { TopicDetailContent } from "./TopicDetailContent";
import type { CompareEntry } from "~/lib/detail-data";

export function CompareEntryView({ entry }: { entry: CompareEntry }) {
  switch (entry.kind) {
    case "hanzi":
      return <HanziDetailContent data={entry.data} />;
    case "word":
      return <WordDetailContent data={entry.data} />;
    case "radical":
      return <RadicalDetailContent data={entry.data} />;
    case "phonetic":
      return <PhoneticDetailContent data={entry.data} />;
    case "topic":
      return <TopicDetailContent data={entry.data} />;
  }
}
