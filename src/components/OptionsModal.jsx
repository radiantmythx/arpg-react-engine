import { useState, useEffect } from 'react';
import { AudioManager } from '../game/AudioManager.js';
import '../styles/OptionsModal.css';

const PERF_CHOICES = [
  { id: 'quality', label: 'Quality', note: 'Full effects and a 60 FPS cap.' },
  { id: 'balanced', label: 'Balanced', note: 'Trimmed effects for steadier mobile play.' },
  { id: 'battery', label: 'Battery', note: '30 FPS cap with reduced particles and lighter rendering.' },
];

/**
 * OptionsModal — volume control overlay.
 *
 * Works in two modes:
 *   • In-game: pass `engine` prop — reads/writes engine.audio directly.
 *   • Main menu: no `engine` — reads/writes localStorage via AudioManager static key.
 *
 * Props:
 *   onClose()  — close the modal
 *   engine?    — GameEngine instance (optional)
 */
export function OptionsModal({ onClose, engine, mobileMode = false, perfSettings = { preset: 'quality' }, onPerfChange }) {
  const [volume, setVolume] = useState(() => {
    if (engine) return engine.audio.volume;
    return AudioManager._loadVolume();
  });

  // Sync slider → audio in real time
  useEffect(() => {
    if (engine) {
      engine.audio.setVolume(volume);
    } else {
      // Persist without an active engine instance
      localStorage.setItem(AudioManager.STORAGE_KEY, String(volume));
    }
  }, [volume, engine]);

  const pct = Math.round(volume * 100);
  const perfPreset = perfSettings?.preset ?? 'quality';
  const perfNote = PERF_CHOICES.find((choice) => choice.id === perfPreset)?.note ?? PERF_CHOICES[0].note;

  return (
    <div className="options-backdrop" onClick={onClose}>
      <div className="options-box" onClick={(e) => e.stopPropagation()}>
        <h2 className="options-title">OPTIONS</h2>

        <div className="options-row">
          <label className="options-label" htmlFor="vol-slider">
            MASTER VOLUME
          </label>
          <div className="options-slider-row">
            <input
              id="vol-slider"
              className="options-slider"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
            />
            <span className="options-vol-pct">{pct}%</span>
          </div>
        </div>

        <div className="options-row">
          <label className="options-label">PERFORMANCE MODE</label>
          <div className="options-pill-row">
            {PERF_CHOICES.map((choice) => (
              <button
                key={choice.id}
                type="button"
                className={`options-pill${perfPreset === choice.id ? ' options-pill--active' : ''}`}
                onClick={() => onPerfChange?.(choice.id)}
              >
                {choice.label}
              </button>
            ))}
          </div>
          <div className="options-helper">
            {perfNote}{mobileMode ? ' Auto-pause protection is enabled while backgrounding or rotating the device.' : ''}
          </div>
        </div>

        <button className="btn btn-primary options-close-btn" onClick={onClose}>
          CLOSE
        </button>
      </div>
    </div>
  );
}
