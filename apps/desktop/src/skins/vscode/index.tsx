import { memo, useMemo, useRef } from 'react';
import type { ReaderViewProps, NeutralViewProps, ReaderSkin } from '@stealth-reader/skin-sdk';
import { fontStyle, useAnchorRestore, useAnchorTracker } from '../../components/reader-core/anchors.js';
import './vscode.css';
import { VSCodeActivityBar, VSCodeChrome } from '../chrome.js';
import { TypingText, useChapterTyping } from '../../components/reader-core/typing.js';
import { moduleFileName } from './aliases.js';

const NEUTRAL_FILE = [
  '/**',
  ' * Metrics collector: validate each incoming event before writing to storage.',
  ' * Keep the runtime schema in sync with the types exported by this module.',
  ' *',
  ' * Invalid batches are rejected before the transaction begins, so consumers',
  ' * never observe partial writes or a mixture of schema versions.',
  ' */',
  'import { z } from "zod";',
  '',
  'export const metricSchema = z.object({',
  '  id: z.string(),',
  '  value: z.number(),',
  '  capturedAt: z.string().datetime(),',
  '});',
  '',
  'export type Metric = z.infer<typeof metricSchema>;',
  '',
  'export function average(rows: Metric[]): number {',
  '  if (rows.length === 0) return 0;',
  '  return rows.reduce((sum, row) => sum + row.value, 0) / rows.length;',
  '}',
  '',
  '/** Builds a summary from a bounded window of captured samples. */',
  'export function summarize(rows: Metric[]) {',
  '  const captured = rows.filter(row => Number.isFinite(row.value));',
  '  const values = captured.map(row => row.value);',
  '',
  '  return {',
  '    count: captured.length,',
  '    mean: average(captured),',
  '    minimum: Math.min(...values),',
  '    maximum: Math.max(...values),',
  '  };',
  '}',
  '',
  'export async function collectSamples(store: MetricStore) {',
  '  const pending = await store.findPending({ limit: 512 });',
  '  const validated = pending.map(row => metricSchema.parse(row));',
  '',
  '  // Persist all validated records in a single transaction.',
  '  // Retry transient connection errors without duplicating existing rows.',
  '  await store.transaction(async tx => {',
  '    for (const record of validated) {',
  '      await tx.upsert(record.id, record);',
  '    }',
  '  });',
  '',
  '  return summarize(validated);',
  '}',
];

function VSCodeReaderView({
  chapter,
  anchor,
  onAnchorChange,
  chapters,
  onSelectChapter,
  onStepChapter,
  settings,
}: ReaderViewProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const typing = useChapterTyping({ chapter, anchor, enabled: settings.chapterTypingEnabled, reducedMotion: settings.reducedMotion });
  useAnchorTracker({
    rootRef: editorRef,
    bookId: chapter.bookId,
    chapterId: chapter.id,
    onAnchorChange,
    enabled: !typing.isTyping,
  });
  useAnchorRestore({ rootRef: editorRef, anchor, chapterId: chapter.id });

  const paragraphOrdinal = useMemo(() => {
    if (!anchor.paragraphId) return 1;
    const index = chapter.paragraphs.findIndex((p) => p.id === anchor.paragraphId);
    return index >= 0 ? index + 1 : 1;
  }, [anchor.paragraphId, chapter.paragraphs]);

  return (
    <div className="vsc" style={fontStyle(settings)}>
      <VSCodeChrome title="metrics-service" />
      <VSCodeActivityBar />
      <aside className="vsc-sidebar" aria-label="Explorer">
        <div className="vsc-sidebar-title">EXPLORER</div>
        <ExplorerHeader />
        <div className="vsc-sticky-folders">
        <div className="vsc-folder">⌄　<span>▾</span> src</div>
        <div className="vsc-folder vsc-folder-nested">⌄　<span>▾</span> modules</div>
        <div className="vsc-folder vsc-folder-deep">⌄　<span>▾</span> metrics</div>
        </div>
        <ul className="vsc-file-list">
          {chapters.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className={`vsc-file ${c.id === chapter.id ? 'is-active' : ''}`}
                onClick={() => onSelectChapter(c.id)}
                aria-current={c.id === chapter.id}
              >
                <span className="vsc-file-icon" aria-hidden="true">
                  TS
                </span>
                <span className="vsc-file-name">{moduleFileName(c.ordinal)}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="vsc-folder vsc-folder-nested">›　services</div><div className="vsc-folder">›　test</div><div className="vsc-folder">›　node_modules</div><div className="vsc-folder"><span className="vsc-file-icon">JS</span>　app.js</div><div className="vsc-folder"><span className="vsc-file-icon">JS</span>　server.js</div><div className="vsc-folder">◇　package.json</div>
      </aside>

      <section className="vsc-main">
        <div className="vsc-tabs" role="tablist">
          <div className="vsc-open-tabs">
            {chapters.slice(Math.max(0, chapters.findIndex(c => c.id === chapter.id) - 2), Math.max(0, chapters.findIndex(c => c.id === chapter.id) - 2) + 6).map(c => (
              <button key={c.id} type="button" className={`vsc-tab ${c.id === chapter.id ? 'is-active' : ''}`} role="tab" aria-selected={c.id === chapter.id} onClick={() => onSelectChapter(c.id)}>
                <span className="vsc-file-icon" aria-hidden="true">TS</span> {moduleFileName(c.ordinal)} {c.id === chapter.id && <span className="vsc-tab-close" aria-hidden="true">×</span>}
              </button>
            ))}
          </div>
          <div className="vsc-toolbar">
            {typing.isTyping && <button type="button" onClick={typing.finish} aria-label="Finish typing" title="Finish typing">»</button>}
            <button type="button" onClick={() => onStepChapter(-1)} aria-label="Previous chapter">
              ‹
            </button>
            <button type="button" onClick={() => onStepChapter(1)} aria-label="Next chapter">
              ›
            </button>
          </div>
        </div>
        <CodeBreadcrumbs file={moduleFileName(chapter.ordinal)} symbol="buildSamples" />

        <div className="vsc-editor" ref={editorRef} tabIndex={0} onWheel={typing.finish} onKeyDown={event => { if (event.key === 'Escape') typing.finish(); }} aria-busy={typing.isTyping}>
          <div className="vsc-editor-inner">
            <div className="vsc-line" aria-hidden="true">{settings.lineNumbers && <span className="vsc-gutter">1</span>}<span className="vsc-text"><HighlightedCode line={'import { z } from "zod";'} /></span></div>
            <div className="vsc-line" aria-hidden="true">{settings.lineNumbers && <span className="vsc-gutter">2</span>}<span className="vsc-text"> </span></div>
            <CodeScaffold line="export function buildSamples(enabled = true) {" number={3} lineNumbers={settings.lineNumbers} indent={0} />
            {chapter.paragraphs.map((paragraph, index) => <CodeParagraph key={paragraph.id} id={paragraph.id} text={paragraph.content} index={index} last={index === chapter.paragraphs.length - 1} lineNumbers={settings.lineNumbers} active={paragraph.id === anchor.paragraphId} visible={typing.visibleText(index)} cursor={typing.isTyping && typing.cursorIndex === index} />)}
            <CodeScaffold line="}" number={endOfSamples(chapter.paragraphs.length)} lineNumbers={settings.lineNumbers} indent={0} />
            <CodeScaffold line="export {};" number={endOfSamples(chapter.paragraphs.length) + 1} lineNumbers={settings.lineNumbers} indent={0} />
          </div>
          <div className="vsc-minimap" aria-hidden="true">{chapter.paragraphs.slice(0, 90).map((p, index) => <i key={p.id} style={{ width: `${25 + (p.content.length % 65)}%`, opacity: index < 12 ? 0.8 : 0.35 }} />)}</div>
        </div>

        <footer className="vsc-statusbar">
          <span aria-hidden="true">⤨ main*　 ⟳　⊗ 0　△ 0</span>
          <span>Ln {sampleLineNumber(paragraphOrdinal - 1)}, Col 1</span>
          <span>{typing.isTyping ? 'Editing' : '✓'}</span>
          <span className="vsc-statusbar-spacer" />
          <span>Spaces: 4</span><span>UTF-8</span><span>CRLF</span>
          <span>TypeScript</span>
        </footer>
      </section>
    </div>
  );
}

function VSCodeNeutralView({ elapsedMs = 0 }: NeutralViewProps) {
  const seconds = Math.floor(elapsedMs / 1000);
  return (
    <div className="vsc vsc-neutral">
      <VSCodeChrome />
      <VSCodeActivityBar />
      <aside className="vsc-sidebar" aria-label="Explorer">
        <div className="vsc-sidebar-title">EXPLORER</div>
        <ExplorerHeader />
        <div className="vsc-folder">⌄　<span>▾</span> src</div>
        <div className="vsc-folder vsc-folder-nested">⌄　<span>▾</span> modules</div><div className="vsc-folder vsc-folder-deep">⌄　<span>▾</span> metrics</div>
        <ul className="vsc-file-list">
          <li>
            <span className="vsc-file is-active">
              <span className="vsc-file-icon" aria-hidden="true">
                TS
              </span>
              schema.ts
            </span>
          </li>
          <li>
            <span className="vsc-file">
              <span className="vsc-file-icon" aria-hidden="true">
                TS
              </span>
              aggregate.ts
            </span>
          </li>
        </ul>
        <div className="vsc-folder">›　▸ node_modules</div><div className="vsc-folder">◇　package.json</div><div className="vsc-folder">◇　tsconfig.json</div>
      </aside>
      <section className="vsc-main">
        <div className="vsc-tabs" role="tablist">
          <div className="vsc-open-tabs">
          <div className="vsc-tab" role="tab" aria-selected="false"><span className="vsc-file-icon">TS</span> index.ts</div>
          <div className="vsc-tab is-active" role="tab">
            <span className="vsc-file-icon">TS</span> schema.ts <span className="vsc-tab-close">×</span>
          </div>
          <div className="vsc-tab" role="tab" aria-selected="false"><span className="vsc-file-icon">TS</span> aggregate.ts</div><div className="vsc-tab" role="tab" aria-selected="false">◇ package.json</div>
          </div>
        </div>
        <CodeBreadcrumbs file="schema.ts" symbol="metricSchema" />
        <div className="vsc-editor" aria-hidden="true">
          <div className="vsc-editor-inner">
            {NEUTRAL_FILE.map((line, index) => (
              <CodeScaffold key={index} line={line.trimStart()} number={index + 1} lineNumbers indent={line.length - line.trimStart().length} />
            ))}
          </div>
        </div>
        <footer className="vsc-statusbar">
          <span>⤨ main　 ⟳　⊗ 0　△ 0</span>
          <span className="vsc-statusbar-spacer" />
          <span>Build {seconds}s</span>
          <span>Ln 1, Col 1</span>
          <span>Spaces: 2</span><span>UTF-8</span><span>TypeScript</span>
        </footer>
      </section>
    </div>
  );
}

function ExplorerHeader() {
  return <div className="vsc-project"><span className="vsc-project-name">⌄　METRICS-SERVICE</span><span className="vsc-explorer-actions" aria-hidden="true">
    <svg viewBox="0 0 16 16"><path d="M9 14H3V2h6l3 3v3M9 2v4h3m0 4v6m-3-3h6" /></svg>
    <svg viewBox="0 0 16 16"><path d="M9 13H2V3h5l2 2h5v3m-2 2v6m-3-3h6" /></svg>
    <svg viewBox="0 0 16 16"><path d="M13 6a5 5 0 1 0 0 5M13 2v4H9" /></svg>
    <svg viewBox="0 0 16 16"><path d="M6 2h8v8M2 6h8v8H2zm2 4h4" /></svg>
  </span></div>;
}

function CodeBreadcrumbs({ file, symbol }: { file: string; symbol: string }) {
  const chevron = <svg className="vsc-breadcrumb-chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m6 4 4 4-4 4" /></svg>;
  return <nav className="vsc-breadcrumbs" aria-label="File path">
    {['metrics-service', 'src', 'modules', 'metrics'].map(part => <span className="vsc-breadcrumb-part" key={part}>{part}{chevron}</span>)}
    <span className="vsc-breadcrumb-part"><span className="vsc-file-icon">TS</span>{file}{chevron}</span>
    <span className="vsc-breadcrumb-part"><svg className="vsc-breadcrumb-symbol" viewBox="0 0 16 16" aria-hidden="true"><path d="m8 1 6 3v8l-6 3-6-3V4zm-6 3 6 4 6-4M8 8v7" /></svg>exports{chevron}</span>
    <span className="vsc-breadcrumb-part"><svg className="vsc-breadcrumb-function" viewBox="0 0 16 16" aria-hidden="true"><path d="M10 2a4 4 0 0 0-4 5L1 12l3 3 5-5a4 4 0 0 0 5-4l-3 2-3-3z" /></svg>{symbol}</span>
  </nav>;
}

function sampleLineNumber(index: number): number {
  return 4 + Math.floor(index / 3) * 5 + (index % 3 === 0 ? 0 : index % 3 + 1);
}

function endOfSamples(count: number): number {
  return 4 + Math.floor(count / 3) * 5 + (count % 3 === 0 ? 0 : count % 3 === 1 ? 1 : 4);
}

function CodeScaffold({ line, number, lineNumbers, indent }: {
  line: string; number: number; lineNumbers: boolean; indent: number;
}) {
  return <div className="vsc-line" aria-hidden="true">
    {lineNumbers && <span className="vsc-gutter">{number}</span>}
    <span className="vsc-text vsc-code-content" style={{ paddingInlineStart: `${indent}ch` }} data-indent={indent}><HighlightedCode line={line || ' '} /></span>
  </div>;
}

const CodeParagraph = memo(function CodeParagraph({ id, text, index, last, lineNumbers, active, visible, cursor }: {
  id: string; text: string; index: number; last: boolean; lineNumbers: boolean; active: boolean; visible: string; cursor: boolean;
}) {
  const comment = index % 3 === 0;
  const number = sampleLineNumber(index);
  const indent = comment ? 4 : 8;
  return <>
    {index % 3 === 1 && <CodeScaffold line="if (enabled) {" number={number - 1} lineNumbers={lineNumbers} indent={4} />}
    <div className={`vsc-line ${active ? 'is-active' : ''}`} data-paragraph-id={id}>
    {lineNumbers && <span className="vsc-gutter" aria-hidden="true">{number}</span>}
    <span className={`vsc-text vsc-code-content ${comment ? 'vsc-code-comment' : 'vsc-token-string'}`} style={{ paddingInlineStart: `${indent}ch` }} data-indent={indent}>
      <span aria-hidden="true" className={visible.length === 0 && text.length > 0 && !cursor ? 'typing-pending' : undefined}>{comment ? '// ' : <><span className="vsc-token-declaration">const </span><span className="vsc-token-variable">{`sample${String(index + 1).padStart(3, '0')}`}</span><span className="vsc-token-operator"> = </span>{'`'}</>}</span>
      <TypingText text={text} visible={visible} cursor={cursor} />
      {!comment && <span aria-hidden="true" className={`vsc-token-operator ${visible.length < text.length ? 'typing-pending' : ''}`}>{'`;'} </span>}
    </span>
    </div>
    {(index % 3 === 2 || (last && !comment)) && <CodeScaffold line="}" number={number + 1} lineNumbers={lineNumbers} indent={4} />}
  </>;
});

function HighlightedCode({ line }: { line: string }) {
  if (/^(\*|\/\/|\/\*\*)/.test(line.trim())) return <span className="vsc-code-comment">{line}</span>;
  const parts = line.split(/("[^"]*"|'[^']*'|\b[A-Za-z_$][\w$]*\b|\b\d+\b|[{}()[\]])/g);
  return <>{parts.map((part, index) => {
    const token = /^['"]/.test(part) ? 'string' : /^(import|from|export|type|typeof|if|return|async|await)$/.test(part) ? 'keyword' : /^(const|let|function|number)$/.test(part) ? 'declaration' : /^\d+$/.test(part) ? 'number' : /^[{}()[\]]$/.test(part) ? 'bracket' : /^[A-Z]/.test(part) ? 'type' : /^[A-Za-z_$]/.test(part) ? (parts[index + 1]?.trim().startsWith('(') ? 'function' : 'variable') : undefined;
    return <span key={index} className={token ? `vsc-token-${token}` : undefined}>{part}</span>;
  })}</>;
}

export const vscodeSkin: ReaderSkin = {
  id: 'vscode',
  displayName: 'VS Code',
  description: 'Compact code editor with a horizontal activity bar and TypeScript comments.',
  ReaderView: VSCodeReaderView,
  NeutralView: VSCodeNeutralView,
};
