import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

export interface MarkdownRendererProps {
  content: string;
  className?: string;
}

function omitNode<T extends { node?: unknown }>(props: T) {
  const cleanProps = { ...props };
  delete cleanProps.node;
  return cleanProps;
}

const components: Components = {
  h1: ({ children, ...props }) => <h1 {...omitNode(props)} className="mb-3 mt-10 font-heading text-[clamp(1.75rem,3vw,2.5rem)] font-bold leading-tight text-foreground first:mt-0">{children}</h1>,
  h2: ({ children, ...props }) => <h2 {...omitNode(props)} className="mb-2 mt-9 font-heading text-2xl font-bold leading-tight text-foreground">{children}</h2>,
  h3: ({ children, ...props }) => <h3 {...omitNode(props)} className="mb-1 mt-6 font-heading text-lg font-bold leading-snug text-foreground">{children}</h3>,
  p: ({ children, ...props }) => <p {...omitNode(props)} className="my-3 text-[15px] leading-[1.75] text-[#314356]">{children}</p>,
  ul: ({ children, ...props }) => <ul {...omitNode(props)} className="my-3 list-disc space-y-1 pl-6 text-[15px] leading-[1.75] text-[#314356] marker:text-primary">{children}</ul>,
  ol: ({ children, ...props }) => <ol {...omitNode(props)} className="my-3 list-decimal space-y-1 pl-6 text-[15px] leading-[1.75] text-[#314356] marker:font-semibold marker:text-primary">{children}</ol>,
  li: ({ children, ...props }) => <li {...omitNode(props)} className="pl-1">{children}</li>,
  a: ({ href, children, ...props }) => {
    const external = href ? /^https?:\/\//i.test(href) : false;
    return <a href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} {...props} className="text-primary underline decoration-primary/35 underline-offset-4 hover:decoration-current">{children}</a>;
  },
  blockquote: ({ children, ...props }) => <blockquote {...omitNode(props)} className="my-4 border-l-[3px] border-secondary bg-slate-50 px-4 py-3 text-foreground">{children}</blockquote>,
  table: ({ children, ...props }) => <div className="my-4 overflow-x-auto border border-border"><table {...omitNode(props)} className="w-full border-collapse text-left text-sm">{children}</table></div>,
  th: ({ children, ...props }) => <th {...omitNode(props)} className="border-b border-border bg-slate-50 px-3 py-2 text-left font-bold text-foreground">{children}</th>,
  td: ({ children, ...props }) => <td {...omitNode(props)} className="border-b border-border px-3 py-2 align-top text-[#314356]">{children}</td>,
  hr: () => <hr className="my-6 border-0 border-t border-border" />,
};

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div className={`text-[15px] leading-[1.75] text-[#314356] ${className ?? ""}`.trim()}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
