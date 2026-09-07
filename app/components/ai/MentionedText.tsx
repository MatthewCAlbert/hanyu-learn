import { Children, Fragment, cloneElement, isValidElement, type ReactNode } from "react";
import { DetailLink } from "~/components/DetailLink";
import clsx from "clsx";
import { entryPath } from "~/lib/compare";
import { segmentMentions } from "~/lib/ai/mentions";

export function MentionedText({
  text,
  tone = "assistant",
}: {
  text: string;
  tone?: "user" | "assistant";
}) {
  const segments = segmentMentions(text);
  if (segments.every((s) => s.kind === "plain")) return <>{text}</>;
  return (
    <>
      {segments.map((seg, i) =>
        seg.kind === "mention" && seg.mention ? (
          <DetailLink
            key={i}
            to={entryPath(seg.mention)}
            className={clsx("chat-mention", tone === "user" && "chat-mention-on-accent")}
          >
            {seg.text}
          </DetailLink>
        ) : (
          <Fragment key={i}>{seg.text}</Fragment>
        ),
      )}
    </>
  );
}

/** Highlight complete mentions in Markdown prose; skip code, pre, and existing links. */
export function mentionify(node: ReactNode): ReactNode {
  return Children.map(node, (child) => {
    if (typeof child === "string") return <MentionedText text={child} />;
    if (!isValidElement<{ children?: ReactNode }>(child)) return child;
    const tag = typeof child.type === "string" ? child.type : "";
    if (tag === "code" || tag === "pre" || tag === "a") return child;
    if (child.props.children == null) return child;
    return cloneElement(child, undefined, mentionify(child.props.children));
  });
}
