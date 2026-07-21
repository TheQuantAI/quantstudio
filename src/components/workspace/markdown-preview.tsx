// Copyright 2026 TheQuantAI
// STUDIO-018: rendered Markdown preview for .md tabs. Sanitization strategy:
// react-markdown without rehype-raw — raw HTML in the document is rendered as
// text, so no user-supplied markup ever executes.

"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function MarkdownPreview({ value }: { value: string }) {
  return (
    <div className="h-full overflow-y-auto bg-background px-8 py-6">
      <div
        className="mx-auto max-w-3xl text-sm leading-6 text-foreground
          [&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:text-2xl [&_h1]:font-bold
          [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold
          [&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold
          [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6
          [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-0.5
          [&_code]:rounded [&_code]:bg-accent [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]
          [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-accent [&_pre]:p-3
          [&_pre_code]:bg-transparent [&_pre_code]:p-0
          [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-quantum [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground
          [&_a]:text-quantum [&_a]:underline
          [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse
          [&_th]:border [&_th]:border-border [&_th]:bg-accent [&_th]:px-2 [&_th]:py-1 [&_th]:text-left
          [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1
          [&_hr]:my-4 [&_hr]:border-border"
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
      </div>
    </div>
  );
}
