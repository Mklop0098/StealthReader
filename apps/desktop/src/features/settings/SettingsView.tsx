import { useMemo, useState } from 'react';
import type { AppSettings, ReaderAction, SkinId } from '@stealth-reader/shared-types';
import type { AppStore } from '../../app/store.js';
import { acceleratorsConflict } from '../../app/keys.js';
import { readerSkins } from '../../skins/registry.js';
import { ChromeIcon } from '../../skins/chrome.js';

interface SettingsViewProps {
  store: AppStore;
}

const FONT_FAMILIES: Array<{ id: string; label: string }> = [
  { id: 'reader-skin', label: 'Match skin (Excel / VS Code / Terminal)' },
  { id: 'reader-serif', label: 'Serif' },
  { id: 'reader-sans', label: 'Sans serif' },
  { id: 'reader-mono', label: 'Monospace' },
];

export function SettingsView({ store }: SettingsViewProps) {
  const settings = store((s) => s.settings);
  const saveSettings = store((s) => s.saveSettings);
  const goToLibrary = store((s) => s.goToLibrary);

  const [hotkeyError, setHotkeyError] = useState<string | null>(null);

  const quickSwitch = settings.hotkeys.find((h) => h.action === 'quickSwitch');
  const restoreReading = settings.hotkeys.find((h) => h.action === 'restoreReading');

  const updateHotkey = async (action: ReaderAction, accelerator: string): Promise<void> => {
    const trimmed = accelerator.trim();
    const other = action === 'quickSwitch' ? restoreReading : quickSwitch;
    if (other && acceleratorsConflict(trimmed, other.accelerator)) {
      setHotkeyError('That accelerator is already used by another action.');
      return;
    }
    if (trimmed.length === 0) {
      setHotkeyError('An accelerator is required; the default will be restored.');
    } else {
      setHotkeyError(null);
    }
    const hotkeys = settings.hotkeys.map((binding) =>
      binding.action === action ? { ...binding, accelerator: trimmed } : binding,
    );
    await saveSettings({ hotkeys });
  };

  const patch = useMemo(
    () => ({
      setFont: (font: Partial<AppSettings['font']>) =>
        void saveSettings({ font: { ...settings.font, ...font } }),
      setPrivacy: (privacy: Partial<AppSettings['privacy']>) =>
        void saveSettings({ privacy: { ...settings.privacy, ...privacy } }),
    }),
    [saveSettings, settings.font, settings.privacy],
  );

  return (
    <div className="settings">
      <header className="settings-header">
        <h1>Settings</h1>
        <button type="button" className="button" onClick={goToLibrary}>
          Back to library
        </button>
      </header>

      <section className="settings-section">
        <h2>Skin</h2>
        <div className="option-row">
          {readerSkins.map((skin) => (
            <button
              key={skin.id}
              type="button"
              className={`option-card ${settings.activeSkin === skin.id ? 'is-active' : ''}`}
              onClick={() => void saveSettings({ activeSkin: skin.id as SkinId })}
              aria-pressed={settings.activeSkin === skin.id}
            >
              <span className={`skin-swatch skin-swatch-${skin.id}`} aria-hidden="true">
                <span className="skin-swatch-top"><ChromeIcon name={skin.id === 'excel' ? 'sheet' : skin.id === 'terminal' ? 'terminal' : skin.id === 'claude' ? 'files' : 'code'} />{skin.displayName}</span>
                <span className="skin-swatch-body"><i /><i /><i /><i /><i /></span>
              </span>
              <span className="option-title">{skin.displayName}</span>
              <span className="option-sub">{skin.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h2>Typography</h2>
        <label className="field">
          <span>Font family (Excel; code and terminal use monospace)</span>
          <select
            className="text-input"
            value={settings.font.family}
            onChange={(event) => patch.setFont({ family: event.target.value })}
          >
            {FONT_FAMILIES.map((family) => (
              <option key={family.id} value={family.id}>
                {family.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Font size ({Math.round(settings.font.size)} px)</span>
          <input
            type="range"
            min={12}
            max={40}
            step={1}
            value={settings.font.size}
            onChange={(event) => patch.setFont({ size: Number(event.target.value) })}
          />
        </label>
        <label className="field">
          <span>Line height ({settings.font.lineHeight.toFixed(2)})</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={settings.font.lineHeight}
            onChange={(event) => patch.setFont({ lineHeight: Number(event.target.value) })}
          />
        </label>
        <label className="field">
          <span>Reading width ({Math.round(settings.font.width)} px)</span>
          <input
            type="range"
            min={480}
            max={1600}
            step={20}
            value={settings.font.width}
            onChange={(event) => patch.setFont({ width: Number(event.target.value) })}
          />
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={settings.lineNumbers}
            onChange={(event) => void saveSettings({ lineNumbers: event.target.checked })}
          />
          Show line numbers in the editor skin
        </label>
      </section>

      <section className="settings-section">
        <h2>Motion and reading</h2>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={settings.chapterTypingEnabled}
            onChange={(event) => void saveSettings({ chapterTypingEnabled: event.target.checked })}
          />
          Type text when opening a chapter (all skins)
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={settings.reducedMotion}
            onChange={(event) => void saveSettings({ reducedMotion: event.target.checked })}
          />
          Reduce motion
        </label>
      </section>

      <section className="settings-section">
        <h2>Privacy</h2>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={settings.privacy.hideRecentBooks}
            onChange={(event) => patch.setPrivacy({ hideRecentBooks: event.target.checked })}
          />
          Hide recently opened books on the library screen
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={settings.privacy.launchInNeutral}
            onChange={(event) => patch.setPrivacy({ launchInNeutral: event.target.checked })}
          />
          Start in the neutral workspace
        </label>
      </section>

      <section className="settings-section">
        <h2>Shortcuts</h2>
        <p className="muted">
          Use Tauri accelerator syntax, for example <code>CommandOrControl+Alt+Shift+Q</code>.
          Global shortcuts are best effort; the same keys always work inside the app.
        </p>
        {quickSwitch && (
          <label className="field">
            <span>Quick switch</span>
            <input
              className="text-input"
              defaultValue={quickSwitch.accelerator}
              onBlur={(event) => void updateHotkey('quickSwitch', event.target.value)}
              aria-label="Quick switch accelerator"
            />
          </label>
        )}
        {restoreReading && (
          <label className="field">
            <span>Restore reading</span>
            <input
              className="text-input"
              defaultValue={restoreReading.accelerator}
              onBlur={(event) => void updateHotkey('restoreReading', event.target.value)}
              aria-label="Restore reading accelerator"
            />
          </label>
        )}
        {hotkeyError && (
          <div className="banner warning" role="alert">
            {hotkeyError}
          </div>
        )}
      </section>
    </div>
  );
}
