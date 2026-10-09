import { memo, useRef } from 'react';
import type { NeutralViewProps, ReaderSkin, ReaderViewProps } from '@stealth-reader/skin-sdk';
import { fontStyle, useAnchorRestore, useAnchorTracker } from '../../components/reader-core/anchors.js';
import './terminal.css';
import { TerminalChrome } from '../chrome.js';
import { TypingText, useChapterTyping } from '../../components/reader-core/typing.js';

const NEUTRAL_LOG = [
  'Microsoft Windows [Version 10.0.26100.6899]',
  '(c) Microsoft Corporation. All rights reserved.',
  '',
  'C:\\Workspace\\metrics-service>pnpm dev',
  '$ vite',
  '',
  '  VITE ready in 174 ms',
  '',
  '  ➜  Local:   http://localhost:3000/',
  '  ➜  Network: use --host to expose',
  '',
  '    Checking metrics-service v1.0.0 (C:\\Workspace\\metrics-service)',
  '    Finished dev profile [unoptimized + debuginfo] target(s) in 2.61s',
  '',
  '10:45:52 AM [vite] (client) hmr update /src/modules/metrics/schema.ts',
  '10:45:52 AM [vite] (client) hmr update /src/modules/metrics/aggregate.ts',
  '10:45:53 AM [vite] (client) page reload src/server.ts',
];

function TerminalReaderView({
  chapter,
  anchor,
  onAnchorChange,
  chapters,
  onSelectChapter,
  onStepChapter,
  settings,
}: ReaderViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const typing = useChapterTyping({ chapter, anchor, enabled: settings.chapterTypingEnabled, reducedMotion: settings.reducedMotion });
  useAnchorTracker({
    rootRef: scrollRef,
    bookId: chapter.bookId,
    chapterId: chapter.id,
    onAnchorChange,
    enabled: !typing.isTyping,
  });
  useAnchorRestore({ rootRef: scrollRef, anchor, chapterId: chapter.id });

  return (
    <div className="term" style={fontStyle(settings)}>
      <TerminalChrome>
        <details className="term-chapters">
          <summary>Chapters ⌄</summary>
          <nav className="term-tabs" aria-label="Chapters">
            {chapters.map(c => <button key={c.id} type="button" className={`term-tab ${c.id === chapter.id ? 'is-active' : ''}`} onClick={() => onSelectChapter(c.id)} aria-current={c.id === chapter.id}>{c.ordinal + 1}: {c.title}</button>)}
          </nav>
        </details>
        <span className="term-nav">
          {typing.isTyping && <button type="button" onClick={typing.finish} aria-label="Finish typing">»</button>}
          <button type="button" onClick={() => onStepChapter(-1)} aria-label="Previous chapter">
            ‹ Previous
          </button>
          <button type="button" onClick={() => onStepChapter(1)} aria-label="Next chapter">
            Next ›
          </button>
        </span>
      </TerminalChrome>

      <div className="term-body" ref={scrollRef} tabIndex={0} onWheel={typing.finish} onKeyDown={event => { if (event.key === 'Escape') typing.finish(); }} aria-busy={typing.isTyping}>
        <div className="term-prompt">
          <span className="term-shell-path">C:\Workspace\reports&gt;</span>type {`batch-${String(chapter.ordinal + 1).padStart(3, '0')}.log`}
        </div>
        <div className="term-output-heading"><span className="term-success">[ready]</span> Loaded output stream.</div>
        {chapter.paragraphs.map((paragraph, index) => <LogParagraph key={paragraph.id} id={paragraph.id} text={paragraph.content} index={index} visible={typing.visibleText(index)} cursor={typing.isTyping && typing.cursorIndex === index} />)}
        {!typing.isTyping && <div className="term-prompt term-bottom-prompt"><span className="term-shell-path">C:\Workspace\reports&gt;</span><span className="term-caret" aria-hidden="true" /></div>}
      </div>

    </div>
  );
}

const LogParagraph = memo(function LogParagraph({ id, text, index, visible, cursor }: {
  id: string; text: string; index: number; visible: string; cursor: boolean;
}) {
  return <>
    {index % 6 === 0 && <div className="term-batch-heading term-dim" aria-hidden="true">Processing task-{String(Math.floor(index / 6) + 1).padStart(3, '0')}</div>}
    <div className="term-line term-record" data-paragraph-id={id}>
      <span aria-hidden="true" className={`term-record-level ${index % 5 === 0 ? 'term-warning' : index % 3 === 0 ? 'term-link' : 'term-success'} ${visible.length === 0 && text.length > 0 && !cursor ? 'typing-pending' : ''}`}>{index % 5 === 0 ? '[WARN]' : index % 3 === 0 ? '[DEBUG]' : '[INFO]'}</span>
      <span className="term-text term-record-message"><TypingText text={text} visible={visible} cursor={cursor} /></span>
    </div>
  </>;
});

function TerminalNeutralView(_props: NeutralViewProps) {
  return (
    <div className="term term-neutral">
      <TerminalChrome />
      <div className="term-body">
        {NEUTRAL_LOG.map((line, index) => (
          <div key={index} className="term-line">
            <span className={`term-text ${line.includes('VITE') ? 'term-success' : line.includes('http://') ? 'term-link' : line.includes('Checking') || line.includes('Finished') ? 'term-success' : line.startsWith('10:') || line.startsWith('$') ? 'term-dim' : ''}`}>{line || '\u00a0'}</span>
          </div>
        ))}
        <div className="term-prompt term-bottom-prompt"><span className="term-shell-path">C:\Workspace\metrics-service&gt;</span><span className="term-caret" aria-hidden="true" /></div>
      </div>
    </div>
  );
}

export const terminalSkin: ReaderSkin = {
  id: 'terminal',
  displayName: 'Terminal',
  description: 'Windows Terminal with a CMD tab and compact console output.',
  ReaderView: TerminalReaderView,
  NeutralView: TerminalNeutralView,
};
