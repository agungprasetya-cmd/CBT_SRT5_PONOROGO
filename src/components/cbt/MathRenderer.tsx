import katex from 'katex';
import React from 'react';

interface MathRendererProps {
  content: string;
  className?: string;
}

/**
 * Merender teks campuran bahasa alami, baris baru, dan rumus LaTeX ($...$ atau $$...$$)
 * menggunakan KaTeX secara cepat dan aman tanpa dangerouslySetInnerHTML global.
 */
export const MathRenderer: React.FC<MathRendererProps> = ({ content, className = '' }) => {
  if (!content) return null;

  // Split by display math $$...$$ first, then inline math $...$
  const tokens = content.split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g);

  return (
    <div className={`leading-relaxed whitespace-pre-wrap break-words ${className}`}>
      {tokens.map((token, idx) => {
        if (token.startsWith('$$') && token.endsWith('$$') && token.length > 4) {
          const tex = token.slice(2, -2).trim();
          try {
            const html = katex.renderToString(tex, {
              displayMode: true,
              throwOnError: false,
              strict: false,
            });
            return (
              <span
                key={idx}
                className="block my-3 overflow-x-auto py-1"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            );
          } catch {
            return (
              <code key={idx} className="block my-2 text-rose-600 font-mono text-sm">
                {token}
              </code>
            );
          }
        }

        if (token.startsWith('$') && token.endsWith('$') && token.length > 2) {
          const tex = token.slice(1, -1).trim();
          try {
            const html = katex.renderToString(tex, {
              displayMode: false,
              throwOnError: false,
              strict: false,
            });
            return (
              <span
                key={idx}
                className="inline-block align-middle mx-0.5"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            );
          } catch {
            return (
              <code key={idx} className="text-rose-600 font-mono text-sm">
                {token}
              </code>
            );
          }
        }

        return <React.Fragment key={idx}>{token}</React.Fragment>;
      })}
    </div>
  );
};
