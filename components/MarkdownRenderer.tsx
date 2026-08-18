import React, { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  variant?: 'editorial' | 'compact';
}

const markdownRenderer = new marked.Renderer();
markdownRenderer.html = () => '';

const SAFE_MARKDOWN_TAGS = [
  'a',
  'blockquote',
  'br',
  'code',
  'del',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'img',
  'li',
  'ol',
  'p',
  'pre',
  'strong',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'ul',
];

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className, variant = 'editorial' }) => {
  const htmlContent = useMemo(() => {
    if (!content) return '';
    const rendered = marked.parse(content, {
      breaks: true,
      async: false,
      renderer: markdownRenderer,
    }) as string;

    return DOMPurify.sanitize(rendered, {
      ALLOWED_TAGS: SAFE_MARKDOWN_TAGS,
      ALLOWED_ATTR: ['alt', 'height', 'href', 'loading', 'rel', 'src', 'target', 'title', 'width'],
      FORBID_ATTR: ['style', 'srcset'],
      ALLOW_UNKNOWN_PROTOCOLS: false,
    });
  }, [content]);

  return (
    <div
      className={`${variant === 'compact' ? 'compact-prose' : 'editorial-prose'} max-w-none ${className || ''}`}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
};

export default MarkdownRenderer;
