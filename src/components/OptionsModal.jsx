import { useState, useEffect } from 'react';
import { AudioManager } from '../game/AudioManager.js';
import '../styles/OptionsModal.css';

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
export function OptionsModal({ onClose, engine }) {
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

        <button className="btn btn-primary options-close-btn" onClick={onClose}>
          CLOSE
        </button>
      </div>
    </div>
  );
}
