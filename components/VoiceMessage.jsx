'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/Icon';

// Playback for a voice-note bubble. peaks is the amplitude envelope
// captured live at recording time (VoiceRecorder) — never decoded here,
// so opening a thread never implies downloading audio (preload="none").
const BAR_COUNT = 40;

function fmt(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export default function VoiceMessage({ url, durationMs, peaks, label }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;
    const onTime = () => setCurrentMs(audio.currentTime * 1000);
    const onEnded = () => {
      setPlaying(false);
      setCurrentMs(0);
    };
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  // play() is async and can reject (format/network error) — setting
  // "playing" unconditionally right after calling it left the button
  // showing pause with nothing audible and the bar never advancing
  // whenever playback actually failed to start.
  async function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    try {
      await audio.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  }

  function seek(e) {
    const audio = audioRef.current;
    if (!audio || !durationMs) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    audio.currentTime = (frac * durationMs) / 1000;
    setCurrentMs(frac * durationMs);
  }

  // Guard: peaks can legitimately be missing if AnalyserNode setup failed
  // client-side while the recording itself still succeeded.
  const bars = peaks && peaks.length ? peaks : new Array(BAR_COUNT).fill(0.15);
  const fraction = durationMs ? Math.min(1, currentMs / durationMs) : 0;
  const playedCount = Math.round(fraction * bars.length);

  return (
    <span className="voice-msg">
      <audio ref={audioRef} src={url} preload="none" />
      <button type="button" className="voice-play-btn" onClick={toggle} aria-label={label}>
        <Icon name={playing ? 'pause' : 'play'} size={22} />
      </button>
      <span className="voice-bars" onClick={seek} role="presentation">
        {bars.map((v, i) => (
          <span key={i} className={`voice-bar${i < playedCount ? ' played' : ''}`} style={{ height: `${4 + Math.round(v * 20)}px` }} />
        ))}
      </span>
      <span className="voice-time">{fmt(currentMs > 0 ? currentMs : durationMs || 0)}</span>
    </span>
  );
}
