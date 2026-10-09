import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { ReaderSkin, ReaderViewProps, NeutralViewProps } from '@stealth-reader/skin-sdk';
import { fontStyle, useAnchorRestore, useAnchorTracker } from '../../components/reader-core/anchors.js';
import './excel.css';
import { ExcelChrome } from '../chrome.js';
import { TypingText, useChapterTyping } from '../../components/reader-core/typing.js';

const NEUTRAL_ROWS: Array<[string, string, string]> = [
  ['1042', 'Northwind Traders', 'Shipped'],
  ['1043', 'Contoso Ltd', 'Pending'],
  ['1044', 'Adventure Works', 'Shipped'],
  ['1045', 'Fabrikam Inc', 'Backorder'],
  ['1046', 'Litware Corp', 'Shipped'],
  ['1047', 'Proseware Inc', 'Pending'],
];

function ExcelReaderView({
  chapter,
  anchor,
  onAnchorChange,
  chapters,
  onSelectChapter,
  onStepChapter,
  settings,
  book,
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

  const rowVirtualizer = useVirtualizer({
    count: chapter.paragraphs.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 30,
    overscan: 8,
  });

  const activeIndex = anchor.paragraphId
    ? chapter.paragraphs.findIndex((p) => p.id === anchor.paragraphId)
    : 0;
  const activeParagraph = chapter.paragraphs[activeIndex >= 0 ? activeIndex : 0];

  return (
    <div className="xls" style={fontStyle(settings)}>
      <ExcelChrome title={book.title} />
      <div className="xls-formula">
        <span className="xls-cellref">{`B${(activeIndex >= 0 ? activeIndex : 0) + 1}`} <small>⌄</small></span>
        <span className="xls-formula-tools" aria-hidden="true">×　✓</span>
        <span className="xls-fx" aria-hidden="true">
          fx
        </span>
        <span className="xls-formula-value"><TypingText text={activeParagraph?.content ?? ''} visible={typing.visibleText(activeIndex >= 0 ? activeIndex : 0)} cursor={typing.isTyping} /></span>
        {typing.isTyping && <button type="button" className="xls-sheet-nav" onClick={typing.finish} aria-label="Finish typing">»</button>}
      </div>

      <div className="xls-grid" ref={scrollRef} tabIndex={0} onWheel={typing.finish} onKeyDown={event => { if (event.key === 'Escape') typing.finish(); }} aria-busy={typing.isTyping}>
        <div className="xls-header-row" role="row">
          <div className="xls-head-cell xls-col-index" role="columnheader">
            ◢
          </div>
          <div className="xls-head-cell xls-col-id" role="columnheader">A</div>
          <div className="xls-head-cell xls-col-content" role="columnheader">
            B
          </div>
          <div className="xls-head-cell xls-col-status" role="columnheader">
            C
          </div>
          <div className="xls-head-cell xls-col-empty" role="columnheader">D</div>
          <div className="xls-head-cell xls-col-empty" role="columnheader">E</div>
        </div>

        <div className="xls-body" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const paragraph = chapter.paragraphs[virtualRow.index];
            if (!paragraph) return null;
            return (
              <div
                key={paragraph.id}
                ref={rowVirtualizer.measureElement}
                data-index={virtualRow.index}
                data-paragraph-id={paragraph.id}
                className={`xls-row ${paragraph.id === anchor.paragraphId ? 'is-active' : ''}`}
                style={{ transform: `translateY(${virtualRow.start}px)` }}
                role="row"
              >
                <div className="xls-cell xls-col-index" role="gridcell">
                  {virtualRow.index + 1}
                </div>
                <div className="xls-cell xls-col-id" role="gridcell">{String(virtualRow.index + 1).padStart(3, '0')}</div>
                <div className="xls-cell xls-col-content" role="gridcell">
                  <TypingText text={paragraph.content} visible={typing.visibleText(virtualRow.index)} cursor={typing.isTyping && typing.cursorIndex === virtualRow.index} />
                </div>
                <div className="xls-cell xls-col-status" role="gridcell">
                  {paragraph.id === anchor.paragraphId ? '●' : ''}
                </div>
                <div className="xls-cell xls-col-empty" role="gridcell" />
                <div className="xls-cell xls-col-empty" role="gridcell" />
              </div>
            );
          })}
        </div>
      </div>

      <div className="xls-sheets" role="tablist">
        <button
          type="button"
          className="xls-sheet-nav"
          onClick={() => onStepChapter(-1)}
          aria-label="Previous sheet"
        >
          ‹
        </button>
        {chapters.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={c.id === chapter.id}
            className={`xls-sheet ${c.id === chapter.id ? 'is-active' : ''}`}
            onClick={() => onSelectChapter(c.id)}
          >
            {c.title}
          </button>
        ))}
        <button
          type="button"
          className="xls-sheet-nav"
          onClick={() => onStepChapter(1)}
          aria-label="Next sheet"
        >
          ›
        </button>
      </div>

      <div className="xls-statusbar">
        <span>Ready</span>
        <span>
          {chapter.paragraphs.length} rows · {chapters.length} sheets
        </span>
        <span className="xls-zoom" aria-hidden="true">▦　▤　▥　 − ━━━●━━ +　100%</span>
      </div>
    </div>
  );
}

function ExcelNeutralView({ elapsedMs = 0 }: NeutralViewProps) {
  return (
    <div className="xls xls-neutral">
      <ExcelChrome />
      <div className="xls-formula">
        <span className="xls-cellref">B2 <small>⌄</small></span>
        <span className="xls-formula-tools" aria-hidden="true">×　✓</span>
        <span className="xls-fx" aria-hidden="true">
          fx
        </span>
        <span className="xls-formula-value">Northwind Traders</span>
      </div>
      <div className="xls-grid">
        <div className="xls-header-row" role="row">
          <div className="xls-head-cell xls-col-index">◢</div>
          <div className="xls-head-cell xls-col-id">A</div>
          <div className="xls-head-cell xls-col-content">B</div>
          <div className="xls-head-cell xls-col-status">C</div>
          <div className="xls-head-cell xls-col-empty">D</div>
          <div className="xls-head-cell xls-col-empty">E</div>
        </div>
        <div className="xls-body xls-neutral-body">
          <div className="xls-row xls-data-heading"><div className="xls-cell xls-col-index">1</div><div className="xls-cell xls-col-id">Order ID</div><div className="xls-cell xls-col-content">Customer</div><div className="xls-cell xls-col-status">Status</div><div className="xls-cell xls-col-empty">Region</div><div className="xls-cell xls-col-empty">Total</div></div>
          {NEUTRAL_ROWS.map(([id, customer, status], index) => (
            <div key={id} className="xls-row" role="row">
              <div className="xls-cell xls-col-index">{index + 2}</div>
              <div className="xls-cell xls-col-id">{id}</div>
              <div className="xls-cell xls-col-content">{customer}</div>
              <div className="xls-cell xls-col-status">{status}</div>
              <div className="xls-cell xls-col-empty">{index % 2 ? 'West' : 'East'}</div>
              <div className="xls-cell xls-col-empty">{(1250 + index * 285).toLocaleString('en-US')}</div>
            </div>
          ))}
          {Array.from({ length: 35 }, (_, index) => <div key={`empty-${index}`} className="xls-row"><div className="xls-cell xls-col-index">{index + 8}</div><div className="xls-cell xls-col-id" /><div className="xls-cell xls-col-content" /><div className="xls-cell xls-col-status" /><div className="xls-cell xls-col-empty" /><div className="xls-cell xls-col-empty" /></div>)}
        </div>
      </div>
      <div className="xls-sheets">
        <button type="button" className="xls-sheet is-active" role="tab" aria-selected="true">
          Orders
        </button>
        <button type="button" className="xls-sheet" role="tab" aria-selected="false">
          Summary
        </button>
      </div>
      <div className="xls-statusbar">
        <span>Ready</span>
        <span>Last calculated {Math.floor(elapsedMs / 1000)}s ago</span>
        <span className="xls-zoom" aria-hidden="true">▦　▤　▥　 − ━━━●━━ +　100%</span>
      </div>
    </div>
  );
}

export const excelSkin: ReaderSkin = {
  id: 'excel',
  displayName: 'Excel',
  description: 'Office ribbon, formula bar, cell grid and worksheet tabs.',
  ReaderView: ExcelReaderView,
  NeutralView: ExcelNeutralView,
};
