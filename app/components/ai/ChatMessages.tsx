import { useEffect, useRef } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link } from "react-router";
import { ToolCallRow, UsageDetails } from "./UsageDetails";
import { MentionedText, mentionify } from "./MentionedText";
import type { ChatMessage, ChatRecord } from "~/lib/ai/types";
import type { PromptSuggestion } from "~/lib/ai/suggestions";

export function ChatMessages({
  chat,
  suggestions = [],
  onPick,
}: {
  chat: ChatRecord;
  suggestions?: PromptSuggestion[];
  onPick?: (prompt: string) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const last = chat.messages[chat.messages.length - 1];

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [chat.messages.length, last?.content, last?.toolActivities?.length]);

  if (chat.messages.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col justify-end px-4 py-5">
        <p className="ui-eyebrow">Study chat</p>
        <h2 className="mt-1 text-base font-medium text-ink">Ask about this page</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-3">
          Mention an entry with @, or pick a prompt and edit it before sending.
        </p>
        {suggestions.length > 0 && onPick ? (
          <ul className="mt-4 space-y-2">
            {suggestions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onPick(s.prompt)}
                  className="ui-touch ui-card ui-card-interactive flex w-full items-center px-3 text-left text-sm text-ink"
                >
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-ink-3">
            Try <code className="rounded bg-sunk px-1">@/hanzi/好</code> or type{" "}
            <code className="rounded bg-sunk px-1">@我</code>.
          </p>
        )}
      </div>
    );
  }

  return (
    <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
      <ol className="flex flex-col gap-3">
        {chat.messages.map((m) => (
          <li key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <MessageBubble message={m} />
          </li>
        ))}
      </ol>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-accent-soft px-3.5 py-2.5 text-sm leading-relaxed text-ink">
        <p className="whitespace-pre-wrap wrap-break-word">
          <MentionedText text={message.content} tone="user" />
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[92%] rounded-2xl rounded-bl-md bg-surface px-3.5 py-2.5 text-sm text-ink ring-1 ring-line ring-inset">
      {message.toolActivities && message.toolActivities.length > 0 && (
        <div className="mb-2 space-y-1">
          {message.toolActivities.map((t) => (
            <ToolCallRow key={t.id} name={t.name} status={t.status} preview={t.resultPreview} />
          ))}
        </div>
      )}
      {message.content ? (
        <div className="chat-md max-w-none wrap-break-word">
          <Markdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ href, children }) =>
                href?.startsWith("/") ? (
                  <Link to={href} className="text-accent underline underline-offset-2">
                    {children}
                  </Link>
                ) : (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent underline underline-offset-2"
                  >
                    {children}
                  </a>
                ),
              p: ({ children }) => <p>{mentionify(children)}</p>,
              li: ({ children }) => <li>{mentionify(children)}</li>,
              h1: ({ children }) => <h1>{mentionify(children)}</h1>,
              h2: ({ children }) => <h2>{mentionify(children)}</h2>,
              h3: ({ children }) => <h3>{mentionify(children)}</h3>,
              blockquote: ({ children }) => <blockquote>{mentionify(children)}</blockquote>,
              em: ({ children }) => <em>{mentionify(children)}</em>,
              strong: ({ children }) => <strong>{mentionify(children)}</strong>,
              td: ({ children }) => <td>{mentionify(children)}</td>,
              th: ({ children }) => <th>{mentionify(children)}</th>,
            }}
          >
            {message.content}
          </Markdown>
        </div>
      ) : !message.error ? (
        <p className="text-ink-3">Thinking…</p>
      ) : null}
      {message.citations && message.citations.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs">
          {message.citations.map((c) => (
            <li key={c.url}>
              <a
                href={c.url}
                target="_blank"
                rel="noreferrer"
                className="text-accent underline underline-offset-2"
              >
                {c.title || c.url}
              </a>
            </li>
          ))}
        </ul>
      )}
      {message.usage ? <UsageDetails usage={message.usage} /> : null}
      {message.error ? <p className="mt-2 text-xs text-accent">{message.error}</p> : null}
    </div>
  );
}
