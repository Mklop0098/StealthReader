import type { ReactNode } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

export function WindowControls() {
  const act = (action: 'minimize' | 'toggleMaximize' | 'close') => {
    void getCurrentWindow()[action]().catch(() => {});
  };
  return <div className="window-controls">
    <button type="button" aria-label="Minimize window" onClick={() => act('minimize')}><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M1 6h10" /></svg></button>
    <button type="button" aria-label="Maximize or restore window" onClick={() => act('toggleMaximize')}><svg viewBox="0 0 12 12" aria-hidden="true"><rect x="2" y="2" width="8" height="8" /></svg></button>
    <button type="button" aria-label="Close window" className="window-close" onClick={() => act('close')}><svg viewBox="0 0 12 12" aria-hidden="true"><path d="m2 2 8 8m0-8-8 8" /></svg></button>
  </div>;
}

export function AppWindowBar() {
  return <div className="app-windowbar" data-tauri-drag-region><span data-tauri-drag-region>Analytics Console</span><WindowControls /></div>;
}

/** Small, local outline icons matching desktop application chrome. */
export function ChromeIcon({ name }: { name: 'files' | 'search' | 'branch' | 'run' | 'extensions' | 'settings' | 'terminal' | 'sheet' | 'code' }) {
  const paths = {
    files: <><path d="M8 3h9l4 4v14H8z" /><path d="M17 3v5h4M4 7v14h1" /></>,
    search: <><circle cx="10" cy="10" r="6" /><path d="m15 15 6 6" /></>,
    branch: <><circle cx="6" cy="5" r="2" /><circle cx="6" cy="19" r="2" /><circle cx="18" cy="6" r="2" /><path d="M6 7v10m0-4h5a7 7 0 0 0 7-5" /></>,
    run: <><path d="m9 4 12 8-12 8zM3 6v12" /></>,
    extensions: <><path d="M3 3h7v7H3zm0 11h7v7H3zm11 0h7v7h-7zM15 2l7 3-3 7-7-3z" /></>,
    settings: <><circle cx="12" cy="12" r="4" /><path d="m10 2 4 0 1 3 3 1 3 2-1 4 1 4-3 2-3 1-1 3h-4l-1-3-3-1-3-2 1-4-1-4 3-2 3-1z" /></>,
    terminal: <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m6 9 3 3-3 3m6 0h6" /></>,
    sheet: <><rect x="3" y="3" width="18" height="18" rx="1" /><path d="M3 9h18M9 3v18M3 15h18" /></>,
    code: <><path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18" /></>,
  };
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export function ExcelChrome({ title = 'Quarterly report' }: { title?: string }) {
  return <div className="xls-chrome">
    <div className="xls-titlebar" data-tauri-drag-region><span className="xls-app-icon">X</span><span className="xls-autosave">AutoSave <b>Off</b></span><span className="xls-quick-tools">▣　↶　↷</span><span className="xls-workbook-title" data-tauri-drag-region>{title} — Excel</span><span className="xls-search" data-tauri-drag-region>⌕　Search</span><span className="xls-avatar">SR</span><WindowControls /></div>
    <div className="xls-ribbon-tabs"><span>File</span><span className="is-active">Home</span><span>Insert</span><span>Page Layout</span><span>Formulas</span><span>Data</span><span>Review</span><span>View</span><span>Help</span></div>
    <div className="xls-ribbon">
      <div className="xls-ribbon-group"><div className="xls-paste">▣ <small>Paste⌄</small></div><div className="xls-ribbon-stack"><span>✂ Cut</span><span>▱ Copy</span><span>▧ Format Painter</span></div><label>Clipboard</label></div>
      <div className="xls-ribbon-group"><div className="xls-ribbon-stack"><span className="xls-font-box">Aptos Narrow <i>⌄</i>　11 ⌄</span><span className="xls-font-tools"><b>B</b>　<i>I</i>　<u>U</u>　▦　<span className="xls-font-color">A</span></span></div><label>Font</label></div>
      <div className="xls-ribbon-group"><div className="xls-ribbon-stack"><span>≡　≡　≡　↵ Wrap Text</span><span>⇤　≡　⇥　▦ Merge & Center</span></div><label>Alignment</label></div>
      <div className="xls-ribbon-group"><div className="xls-ribbon-stack"><span className="xls-font-box">General <i>⌄</i></span><span>$　%　,　.00</span></div><label>Number</label></div>
      <div className="xls-ribbon-group xls-ribbon-styles"><div className="xls-ribbon-stack"><span>▦ Conditional Formatting</span><span>▦ Format as Table</span></div><label>Styles</label></div>
    </div>
  </div>;
}

export function VSCodeChrome({ title = 'metrics-service' }: { title?: string }) {
  return <header className="vsc-titlebar" data-tauri-drag-region><span className="vsc-app-icon"><svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="m10 2 7 4-7 4-7-4zm-7 5 6 4v7l-6-4zm8 4 6-4v7l-6 4z" /></svg></span><nav className="vsc-menu" aria-label="Application menu">{['File', 'Edit', 'Selection', 'View', 'Go', 'Run', 'Terminal', 'Help'].map(label => <span key={label}>{label}</span>)}</nav><span className="vsc-menu-layout" aria-hidden="true"><svg viewBox="0 0 20 20"><rect x="3" y="4" width="14" height="12" rx="1"/><path d="M8 4v12"/></svg></span><div className="vsc-command-group" data-tauri-drag-region><span className="vsc-history" aria-hidden="true">← <span>→</span></span><span className="vsc-command-center" data-tauri-drag-region><ChromeIcon name="search" />{title}</span></div><span className="vsc-layout-icons" aria-hidden="true"><svg viewBox="0 0 20 20"><rect x="3" y="4" width="14" height="12" rx="1"/><path d="M3 12h14"/></svg><ChromeIcon name="settings" /></span><WindowControls /></header>;
}

export function VSCodeActivityBar() {
  return <aside className="vsc-activitybar" aria-hidden="true"><span className="is-active"><ChromeIcon name="files" /></span><span><ChromeIcon name="branch" /></span><span><ChromeIcon name="run" /></span><span><ChromeIcon name="extensions" /></span><span className="vsc-activity-spacer" /><span>⌄</span></aside>;
}

export function TerminalChrome({ children }: { children?: ReactNode }) {
  return <header className="term-titlebar" data-tauri-drag-region><div className="term-shell-tab" data-tauri-drag-region><span className="term-cmd-icon" aria-hidden="true">C:\_</span><span data-tauri-drag-region>C:\WINDOWS\system32\cmd.exe</span><span aria-hidden="true">×</span></div><span className="term-new-tab" aria-hidden="true">＋　⌄</span>{children}<WindowControls /></header>;
}
