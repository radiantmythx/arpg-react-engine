import { useEffect, useRef } from 'react';

/**
 * MapClearBanner — full-width victory overlay shown when the map boss is killed.
 * Auto-dismisses after 4 seconds via the onDone callback.
 *
 * @param {{ mapName: string, bossName: string, onDone: () => void }} props
 */
export function MapClearBanner({ mapName, bossName, onDone }) {
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const t = setTimeout(() => onDoneRef.current?.(), 4500);
    return () => clearTimeout(t);
  }, [mapName]);

  return (
    <div className="map-clear-banner">
      <div className="map-clear-banner__sub">MAP CLEARED</div>
      <div className="map-clear-banner__name">{mapName}</div>
      {bossName && (
        <div className="map-clear-banner__boss">{bossName} defeated</div>
      )}
    </div>
  );
}
