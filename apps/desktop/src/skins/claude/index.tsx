import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { ReaderSkin, ReaderViewProps } from '@stealth-reader/skin-sdk';
import { useAnchorRestore, useAnchorTracker } from '../../components/reader-core/anchors.js';
import { TypingText, useChapterTyping } from '../../components/reader-core/typing.js';
import { WindowControls } from '../chrome.js';
import './fonts/fonts.css';
import './claude.css';

type IconName =
  | 'menu' | 'sidebar' | 'back' | 'forward' | 'plus' | 'chats' | 'projects' | 'artifacts' | 'code'
  | 'chevronDown' | 'chevronRight' | 'caret' | 'copy' | 'thumbUp' | 'thumbDown' | 'retry'
  | 'mic' | 'wave' | 'enter' | 'close' | 'skip' | 'globe' | 'list' | 'share'
  | 'clip' | 'memory' | 'book' | 'image' | 'doc' | 'artifact'
  | 'search' | 'clock' | 'briefcase' | 'stack' | 'chatSearch' | 'laptop' | 'caretDown';

const thumb = 'M7 10v10H4V10zM7 10l4-7a2 2 0 0 1 3 2l-1 5h6a2 2 0 0 1 2 2.3l-1.3 6A2 2 0 0 1 17.7 20H7';

const ICONS: Record<IconName, ReactNode> = {
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  sidebar: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M9 4v16" /></>,
  back: <path d="m15 6-6 6 6 6" />,
  forward: <path d="m9 6 6 6-6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  chats: <path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H10l-5 4v-4H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />,
  projects: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  artifacts: <><rect x="4" y="4" width="7" height="7" rx="1.5" /><circle cx="17.5" cy="7.5" r="3.5" /><path d="m7.5 14 4 6.5h-8z" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  code: <path d="m8 7-5 5 5 5m8-10 5 5-5 5" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  caret: <path d="M9 7l6 5-6 5z" fill="currentColor" stroke="none" />,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
  thumbUp: <path d={thumb} />,
  thumbDown: <path d={thumb} transform="rotate(180 12 12)" />,
  retry: <path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" />,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></>,
  wave: <path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2" />,
  enter: <path d="M20 5v6a3 3 0 0 1-3 3H5m4-4-4 4 4 4" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  skip: <path d="m5 6 6 6-6 6m8-12 6 6-6 6" />,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18" /></>,
  list: <><rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="M7 9h1m3 0h6M7 12h1m3 0h6M7 15h1m3 0h6" /></>,
  share: <path d="M12 15V3m-5 5 5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />,
  clip: <path d="m20 11-8.5 8.5a5 5 0 0 1-7-7L13 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L14 7" />,
  memory: <><circle cx="12" cy="12" r="8.5" /><path d="M12 3.5v17M12 8c-2 0-3.5-1-4.5-2.5M12 12c-2.5 0-5 0-8.5 0M12 16c-2 0-3.5 1-4.5 2.5" /></>,
  book: <><path d="M5 5a2 2 0 0 1 2-2h12v15H7a2 2 0 0 0-2 2z" /><path d="M5 20a2 2 0 0 0 2 1h12v-3" /></>,
  image: <><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="9" cy="9" r="1.8" /><path d="m4 18 5-5 4 4 3-3 4 4" /></>,
  doc: <><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5M10 13h6m-6 4h6" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  briefcase: <><rect x="3.5" y="7" width="17" height="12.5" rx="2" /><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" /></>,
  stack: <><path d="M5 6.5h14M6.5 4h11" /><rect x="4" y="9" width="16" height="11" rx="2" /></>,
  chatSearch: <><path d="M20 11.5a7.5 7.5 0 1 0-3.2 6.1L20 19l-.9-3.3A7.4 7.4 0 0 0 20 11.5z" /><circle cx="11.5" cy="11.5" r="2.6" /><path d="m13.4 13.4 1.8 1.8" /></>,
  laptop: <><rect x="5" y="5" width="14" height="10" rx="1.5" /><path d="M3 19h18" /></>,
  caretDown: <path d="M7 10l5 5 5-5z" fill="currentColor" stroke="none" />,
  artifact: <><rect x="9" y="3" width="12" height="12" rx="2" /><path d="M15 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h4" /></>,
};

function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return <svg className="cld-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[name]}</svg>;
}

/** Generic radial spark used as the assistant mark. */
function Spark({ busy = false, size = 22 }: { busy?: boolean; size?: number }) {
  return <svg className={`cld-spark ${busy ? 'is-busy' : ''}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    {Array.from({ length: 12 }, (_, i) => <line key={i} x1="12" y1="12" x2="12" y2={i % 2 ? 5 : 2.5} transform={`rotate(${i * 30} 12 12)`} />)}
  </svg>;
}

const OUTPUT_DOCS = [
  { title: 'Project overview — implementation notes', lines: 'Module boundaries, data layer and integration points for the next release.' },
  { title: 'Review summary — changes and next steps', lines: 'Checklist of interface updates, validation steps and open questions.' },
];
const OUTPUT_FILES: [IconName, string, string][] = [
  ['artifact', 'Project notes', 'Artifact'], ['image', 'Architecture overview', 'PNG'], ['image', 'Module diagram', 'PNG'],
  ['image', 'Data flow', 'PNG'], ['image', 'Integration map', 'PNG'], ['image', 'Release timeline', 'PNG'], ['doc', 'Review checklist', 'MD'],
];
const SESSION_ROWS: [IconName, string, string, string][] = [
  ['clip', 'Uploads', 'requirements_v2.pdf, notes.md, schema.sql', '+12'],
  ['globe', 'Web search', '', '+8'],
  ['memory', 'Memory', '', 'Read · Workspace'],
  ['book', 'Skills', '', 'docs'],
  ['clip', 'Uploads', 'Release plan — milestones and owners', '+4'],
  ['globe', 'Web search', '', '+5'],
  ['memory', 'Memory', '', 'Read · Workspace'],
  ['book', 'Skills', '', 'docs'],
];

function ProgressPanel({ onClose }: { onClose: () => void }) {
  return <aside className="cld-panel">
    <div className="cld-panel-title"><span>Progress <Icon name="chevronRight" size={13} /></span><button className="cld-icon-btn" aria-label="Close progress" onClick={onClose}><Icon name="close" size={18} /></button></div>
    <div className="cld-panel-label">Outputs</div>
    <div className="cld-output-cards">
      {OUTPUT_DOCS.map(doc => <div className="cld-output-card" key={doc.title}>
        <div className="cld-output-thumb"><strong>{doc.title}</strong><i>{doc.lines}</i><i className="is-short">Status · In review</i><i>{doc.lines}</i></div>
        <div className="cld-output-name">{doc.title}</div><small>Claude Docs</small>
      </div>)}
    </div>
    <div className="cld-panel-files">
      {OUTPUT_FILES.map(([icon, name, type]) => <div className="cld-panel-row" key={name}><Icon name={icon} /><span className="cld-row-name">{name}</span><small>{type}</small></div>)}
    </div>
    <div className="cld-panel-label cld-panel-sep">Used in this session</div>
    {SESSION_ROWS.map(([icon, name, detail, meta], i) => <div className="cld-panel-row" key={i}>
      <Icon name={icon} /><span className="cld-row-name cld-row-fixed">{name}</span>
      {icon === 'globe' ? <span className="cld-favicons"><b style={{ background: '#e5484d' }} /><b style={{ background: '#3e9b4f' }} /><b style={{ background: '#e8a33d' }} /></span> : <span className="cld-row-detail">{detail}</span>}
      <small>{meta}</small>
    </div>)}
  </aside>;
}

const SIDEBAR_PROJECTS: { name: string; chats: [string, boolean, boolean][]; more?: boolean }[] = [
  { name: 'Workspace', chats: [['Rà soát giao diện ứng dụng', true, true]] },
  { name: 'platform-core', more: true, chats: [
    ['Quy trình phát hành 2.0', true, false], ['Drawer thêm cấu hình thông báo', false, false], ['Layout trang báo cáo tổng hợp', false, false],
    ['Thiết kế database dịch vụ', true, false], ['Kịch bản kiểm thử màn hình 4', false, false], ['Container không khởi động', false, false],
    ['Đồng bộ dữ liệu kho miền Trung', false, false], ['Layout hồ sơ truy xuất', false, false], ['Trang trống và chuyển đổi ngôn ngữ', false, false], ['Dọn kịch bản PostgreSQL', false, false]] },
  { name: 'image-pipeline', more: true, chats: [['Báo cáo pipeline xử lý ảnh', true, false]] },
  { name: 'payments-2.0', more: true, chats: [['Tích hợp SDK thanh toán', true, false], ['Tìm nguyên nhân lỗi đồng bộ', false, false]] },
];

function ClaudeFrame({ title, children, controls, onReply }: { title: string; children: ReactNode; controls?: ReactNode; onReply?: (text: string) => boolean }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [reply, setReply] = useState('');
  const [replyError, setReplyError] = useState(false);
  const submitReply = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
    event.preventDefault();
    const text = reply.trim();
    if (!text) return;
    if (onReply?.(text)) { setReply(''); setReplyError(false); }
    else { setReplyError(true); window.setTimeout(() => setReplyError(false), 700); }
  };
  const [panelOpen, setPanelOpen] = useState(true);
  return <div className={`cld ${sidebarOpen ? '' : 'cld-sidebar-hidden'} ${panelOpen ? 'cld-panel-open' : ''}`}>
    <header className="cld-titlebar" data-tauri-drag-region>
      <div className="cld-titlebar-left">
        <button className="cld-icon-btn" aria-label="Menu" tabIndex={-1}><Icon name="menu" /></button>
        <button className="cld-icon-btn" aria-label="Toggle sidebar" onClick={() => setSidebarOpen(v => !v)}><Icon name="sidebar" /></button>
        <button className="cld-icon-btn" aria-label="Back" tabIndex={-1}><Icon name="back" /></button>
        <button className="cld-icon-btn is-dim" aria-label="Forward" tabIndex={-1}><Icon name="forward" /></button>
        <span className="cld-modes" aria-hidden="true"><span className="is-on"><Icon name="chatSearch" size={16} /></span><span><Icon name="code" size={16} /></span></span>
      </div>
      <div className="cld-chat-title" data-tauri-drag-region><span className="cld-crumb">Workspace</span><span className="cld-crumb-sep">/</span><span className="cld-chat-name">{title}</span><Icon name="chevronDown" size={13} /></div>
      <div className="cld-titlebar-drag" data-tauri-drag-region />
      <div className="cld-titlebar-right">
        <span className="cld-icon-btn cld-device" aria-hidden="true"><Icon name="laptop" size={17} /></span>
        <button className={`cld-pill ${panelOpen ? 'is-on' : ''}`} aria-label="Toggle progress" onClick={() => setPanelOpen(v => !v)}><Icon name="list" size={16} />11</button>
        <span className="cld-share"><Icon name="share" size={16} />Share</span>
      </div>
      <WindowControls />
    </header>

    {sidebarOpen && <aside className="cld-sidebar">
      <div className="cld-nav">
        {([['plus', 'New'], ['search', 'Search'], ['stack', 'Projects'], ['artifacts', 'Artifacts'], ['clock', 'Scheduled'], ['briefcase', 'Customize']] as const).map(([icon, label]) =>
          <div className="cld-nav-item" key={label}><Icon name={icon} size={17} />{label}</div>)}
      </div>
      <div className="cld-sidebar-scroll">
        <div className="cld-section-label">Pinned <Icon name="caretDown" size={12} /></div>
        {SIDEBAR_PROJECTS.map(project => <div className="cld-project" key={project.name}>
          <div className="cld-item cld-project-name"><Icon name="stack" size={17} /><span>{project.name}</span></div>
          {project.chats.map(([chat, doc, active]) => <div className={`cld-item cld-chat ${active ? 'is-active' : ''}`} key={chat}><span>{chat}</span>{doc && <Icon name="doc" size={14} />}</div>)}
          {project.more && <div className="cld-item cld-chat cld-view-all">View all</div>}
        </div>)}
      </div>
      <footer className="cld-account">
        <span className="cld-avatar">W</span>
        <div className="cld-account-text"><b>Workspace</b><small>· Pro</small><Icon name="chevronDown" size={13} /></div>
        <span className="cld-icon-btn" aria-hidden="true"><Icon name="laptop" size={17} /></span>
      </footer>
    </aside>}

    <main className="cld-main">
      {children}
      <div className="cld-composer-wrap">
        <label className={`cld-reply ${replyError ? 'is-error' : ''}`}><input className="cld-reply-input" aria-label="Reply" placeholder="Reply" value={reply} onChange={event => setReply(event.target.value)} onKeyDown={submitReply} spellCheck={false} autoComplete="off" /><Icon name="enter" size={18} /></label>
        <div className="cld-composer-tools">
          <div className="cld-composer-left">
            <span className="cld-tool" aria-hidden="true"><Icon name="plus" size={17} /></span>
            <span className="cld-tool" aria-hidden="true"><Icon name="mic" size={17} /></span>
            <span className="cld-tool cld-tool-wide" aria-hidden="true"><Icon name="wave" size={16} /><Icon name="chevronDown" size={11} /></span>
            {controls}
          </div>
          <small className="cld-disclaimer">Claude is AI and can make mistakes.</small>
          <div className="cld-composer-right">
            <span className="cld-model">Opus 5.5 <span>Medium</span></span>
            <span className="cld-model">Auto</span>
          </div>
        </div>
      </div>
    </main>

    {panelOpen && <ProgressPanel onClose={() => setPanelOpen(false)} />}
  </div>;
}

function ResponseFooter({ busy }: { busy: boolean }) {
  return <div className="cld-response-footer">
    <Spark busy={busy} />
    {!busy && <div className="cld-actions" aria-hidden="true">
      {(['copy', 'thumbUp', 'thumbDown', 'retry'] as const).map(name => <span key={name} className="cld-action"><Icon name={name} size={15} /></span>)}
    </div>}
  </div>;
}

function Artifact({ name }: { name: string }) {
  return <div className="cld-artifact"><span className="cld-artifact-icon"><Icon name="artifact" size={18} /></span><div>{name}<small>Artifact</small></div></div>;
}

const THINKING_MS = 2000;

function ThinkingIndicator() {
  return <div className="cld-thinking" role="status" aria-label="Thinking"><Spark busy size={20} /><span className="cld-thinking-text">Thinking…</span></div>;
}

function ClaudeReader(props: ReaderViewProps) {
  const { chapter, anchor, onAnchorChange, settings, chapters, onSelectChapter, onStepChapter } = props;
  const rootRef = useRef<HTMLDivElement>(null);
  const typing = useChapterTyping({ chapter, anchor, enabled: settings.chapterTypingEnabled, reducedMotion: settings.reducedMotion, holdMs: THINKING_MS });
  useAnchorTracker({ rootRef, bookId: chapter.bookId, chapterId: chapter.id, onAnchorChange, enabled: !typing.isTyping });
  useAnchorRestore({ rootRef, anchor, chapterId: chapter.id });
  const jumpToChapter = (text: string): boolean => {
    if (!/^\d{1,6}$/.test(text)) return false;
    const n = Number(text);
    const byTitle = chapters.find(c => Number(c.title.match(/\d+/)?.[0]) === n);
    const target = byTitle ?? chapters[n - 1];
    if (!target) return false;
    onSelectChapter(target.id);
    return true;
  };
  const controls = <div className="cld-chapter-controls">
    <button className="cld-tool" aria-label="Previous chapter" onClick={() => onStepChapter(-1)}><Icon name="back" size={17} /></button>
    {typing.isTyping && <button className="cld-tool" aria-label="Finish typing" onClick={typing.finish}><Icon name="skip" size={17} /></button>}
    <button className="cld-tool" aria-label="Next chapter" onClick={() => onStepChapter(1)}><Icon name="forward" size={17} /></button>
  </div>;
  return <ClaudeFrame title={chapter.title} controls={controls} onReply={jumpToChapter}>
    <div className="cld-scroll" ref={rootRef} tabIndex={0} aria-busy={typing.isTyping} onWheel={typing.finish} onKeyDown={event => { if (event.key === 'Escape') typing.finish(); }}>
      <article className="cld-conversation">
        <div className="cld-user-row"><div className="cld-user-message">Continue the project review</div></div>
        <div className="cld-response">
          <div className="cld-thought-row">
            {typing.isThinking ? <ThinkingIndicator /> : <div className="cld-thought">Used project context, ran a command <Icon name="caret" size={12} /></div>}
          </div>
          <div className={typing.isThinking ? 'cld-pending' : undefined}><Artifact name="Project notes" /></div>
          {chapter.paragraphs.map((p, i) => <p key={p.id} data-paragraph-id={p.id}><TypingText text={p.content} visible={typing.visibleText(i)} cursor={typing.isTyping && !typing.isThinking && typing.cursorIndex === i} /></p>)}
          {!typing.isThinking && <ResponseFooter busy={typing.isTyping} />}
        </div>
      </article>
    </div>
  </ClaudeFrame>;
}

function ClaudeNeutral() {
  return <ClaudeFrame title="Project review">
    <div className="cld-scroll">
      <article className="cld-conversation">
        <div className="cld-user-row"><div className="cld-user-message">Review the implementation plan</div></div>
        <div className="cld-response">
          <div className="cld-thought">Used project context <Icon name="caret" size={12} /></div>
          <p>The project structure is ready for review. The implementation is organized around a shared data layer and a small set of focused modules.</p>
          <p>Before the next release:</p>
          <ul><li>Review the updated interface.</li><li>Validate the integration points.</li><li>Confirm the release checklist.</li></ul>
          <Artifact name="Implementation plan" />
          <p>The next step is to verify the changes and collect feedback from the team.</p>
          <ResponseFooter busy={false} />
        </div>
      </article>
    </div>
  </ClaudeFrame>;
}

export const claudeSkin: ReaderSkin = { id: 'claude', displayName: 'Claude', description: 'Dark Claude desktop workspace with recents sidebar, composer and progress panel.', ReaderView: ClaudeReader, NeutralView: ClaudeNeutral };
