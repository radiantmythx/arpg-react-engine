import { useEffect, useRef } from 'react';

/**
 * BossAnnouncement — full-width dramatic overlay that appears when a boss spawns.
 * Auto-dismisses after 4 seconds via the onDone callback.
 *
 * @param {{ bossName: string, onDone: () => void }} props
 */
export function BossAnnouncement({ bossName, onDone }) {
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const t = setTimeout(() => onDoneRef.current?.(), 4000);
    return () => clearTimeout(t);
  }, [bossName]);

  return (
    <div className="boss-announcement">
      <div className="boss-announcement-sub">A POWERFUL ENEMY APPROACHES</div>
      <div className="boss-announcement-name">{bossName}</div>
    </div>
  );
}
