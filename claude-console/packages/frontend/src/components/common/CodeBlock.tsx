import React, { useState } from 'react';
import { Highlight, themes } from 'prism-react-renderer';
import { Check, Copy, FileCode } from 'lucide-react';
import { cn, copyToClipboard, getFileName } from '@/utils';
import { IconButton } from './IconButton';

interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
  showLineNumbers?: boolean;
  className?: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  language = 'text',
  filename,
  showLineNumbers = true,
  className,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const success = await copyToClipboard(code);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Normalize language name
  const normalizedLanguage = language.toLowerCase().replace(/^language-/, '');

  return (
    <div className={cn('code-block overflow-hidden', className)}>
      {/* Header */}
      <div className="code-header">
        <div className="flex items-center gap-2">
          <FileCode size={14} />
          <span>{filename ? getFileName(filename) : normalizedLanguage}</span>
        </div>
        <IconButton
          size="sm"
          variant="ghost"
          onClick={handleCopy}
          tooltip={copied ? 'Copied!' : 'Copy code'}
        >
          {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
        </IconButton>
      </div>

      {/* Code */}
      <Highlight
        theme={themes.vsDark}
        code={code.trim()}
        language={normalizedLanguage}
      >
        {({ className: highlightClassName, style, tokens, getLineProps, getTokenProps }) => (
          <pre
            className={cn(
              highlightClassName,
              'overflow-x-auto p-4 text-sm leading-relaxed'
            )}
            style={{ ...style, backgroundColor: 'transparent', margin: 0 }}
          >
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })} className="table-row">
                {showLineNumbers && (
                  <span className="table-cell pr-4 text-right text-dark-600 select-none w-8">
                    {i + 1}
                  </span>
                )}
                <span className="table-cell">
                  {line.map((token, key) => (
                    <span key={key} {...getTokenProps({ token })} />
                  ))}
                </span>
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    </div>
  );
};
