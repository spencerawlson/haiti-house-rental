'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/Icon';

// Press-and-hold-to-record, release-to-send, slide-left-to-cancel — the
// WhatsApp gesture. Pointer Events (not touch/mouse separately) so the
// same code handles phones, trackpads and mice; setPointerCapture keeps
// move/up events reaching us even if the finger drags off the button.
const MAX_MS = 180000; // hard stop — a voice note is not a podcast
const MIN_MS = 300; // shorter than this = an accidental tap, discard
const CANCEL_PX = 80; // drag-left distance that arms "slide to cancel"
const SAMPLE_MS = 120; // waveform sampling interval while recording
const BAR_COUNT = 40; // bars sent/stored, downsampled from the raw capture

function pickMime() {
  if (typeof MediaRecorder === 'undefined') return null;
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return { mime: 'audio/webm;codecs=opus', ext: '.weba' };
  if (MediaRecorder.isTypeSupported('audio/mp4')) return { mime: 'audio/mp4', ext: '.m4a' };
  return null;
}

// Only at stop time, once the full clip is known, do we reduce the raw
// per-sample capture to a fixed bar count — averaging each bucket, so the
// bars represent the whole clip's envelope rather than being cut off.
function downsample(raw, count) {
  if (raw.length === 0) return new Array(count).fill(0);
  const bucket = Math.max(1, Math.ceil(raw.length / count));
  const out = [];
  for (let i = 0; i < raw.length; i += bucket) {
    const slice = raw.slice(i, i + bucket);
    out.push(slice.reduce((a, b) => a + b, 0) / slice.length);
  }
  return out;
}

function fmt(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function VoiceRecorder({ listingId, tenant, onSend, strings }) {
  const [state, setState] = useState('idle'); // idle | recording | uploading
  const [canceling, setCanceling] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState('');
  // Feature-detected after mount only (client-only globals), so the first
  // render matches on server and client and there's no hydration mismatch.
  const [available, setAvailable] = useState(true);

  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const audioCtxRef = useRef(null);
  const rawPeaksRef = useRef([]);
  const sampleTimerRef = useRef(null);
  const timerRef = useRef(null);
  const startXRef = useRef(0);
  const startAtRef = useRef(0);
  const extRef = useRef('.weba');
  const canceledRef = useRef(false);
  const pointerIdRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.PointerEvent || !pickMime()) setAvailable(false);
  }, []);

  function cleanupStream() {
    if (sampleTimerRef.current) { clearInterval(sampleTimerRef.current); sampleTimerRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    recorderRef.current = null;
  }

  function discard() {
    cleanupStream();
    chunksRef.current = [];
    rawPeaksRef.current = [];
    setState('idle');
    setCanceling(false);
    setElapsedMs(0);
  }

  async function finish(forced) {
    const recorder = recorderRef.current;
    const heldMs = Date.now() - startAtRef.current;
    const wasCanceled = canceledRef.current;
    if (!recorder || recorder.state === 'inactive') {
      discard();
      return;
    }
    const stopped = new Promise((resolve) => { recorder.onstop = resolve; });
    recorder.stop();
    await stopped;
    if (wasCanceled || heldMs < MIN_MS || forced) {
      discard();
      return;
    }
    const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
    const peaks = downsample(rawPeaksRef.current, BAR_COUNT);
    const ext = extRef.current;
    cleanupStream();
    chunksRef.current = [];
    rawPeaksRef.current = [];
    setState('uploading');
    try {
      const form = new FormData();
      form.append('file', blob, `voice${ext}`);
      form.append('listingId', listingId);
      if (tenant !== null) form.append('tenant', tenant);
      const res = await fetch('/api/chat/upload-audio', { method: 'POST', body: form });
      if (!res.ok) throw new Error('upload failed');
      const data = await res.json();
      await onSend(data.url, heldMs, peaks);
    } catch {
      setError(strings.chatSendError);
    } finally {
      setState('idle');
      setCanceling(false);
      setElapsedMs(0);
    }
  }

  async function start(e) {
    if (state !== 'idle') return;
    const picked = pickMime();
    if (!picked) {
      setAvailable(false);
      return;
    }
    e.preventDefault();
    // Captured before the await below: a SyntheticEvent's fields are not
    // safe to read after an async gap (currentTarget in particular is
    // only valid during dispatch, per native DOM semantics React mirrors).
    const target = e.currentTarget;
    const pointerId = e.pointerId;
    const clientX = e.clientX;
    setError('');
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError(strings.micError);
      return;
    }
    streamRef.current = stream;
    extRef.current = picked.ext;
    canceledRef.current = false;
    chunksRef.current = [];
    rawPeaksRef.current = [];
    startXRef.current = clientX;
    startAtRef.current = Date.now();
    pointerIdRef.current = pointerId;
    try {
      target.setPointerCapture(pointerId);
    } catch {
      // unsupported — move/up still work as long as the pointer stays on the button
    }

    // The OS can kill the mic stream outright (tab/app backgrounded mid
    // hold) — treat that as an immediate forced stop, not a silent hang.
    // finish() already no-ops safely if called more than once.
    stream.getAudioTracks()[0]?.addEventListener('ended', () => finish(true));

    const recorder = new MediaRecorder(stream, { mimeType: picked.mime });
    recorderRef.current = recorder;
    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
    };

    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      audioCtxRef.current = ctx;
      const data = new Uint8Array(analyser.frequencyBinCount);
      sampleTimerRef.current = setInterval(() => {
        analyser.getByteTimeDomainData(data);
        let maxDev = 0;
        for (let i = 0; i < data.length; i += 1) {
          const dev = Math.abs(data[i] - 128);
          if (dev > maxDev) maxDev = dev;
        }
        rawPeaksRef.current.push(Math.min(1, maxDev / 128));
      }, SAMPLE_MS);
    } catch {
      // No waveform if AudioContext setup fails — recording still works;
      // VoiceMessage falls back to a flat bar row when peaks is empty.
    }

    recorder.start();
    setState('recording');
    setElapsedMs(0);
    timerRef.current = setInterval(() => {
      const ms = Date.now() - startAtRef.current;
      setElapsedMs(ms);
      if (ms >= MAX_MS) finish(false);
    }, 200);
  }

  function move(e) {
    if (state !== 'recording') return;
    const dx = e.clientX - startXRef.current;
    const now = dx < -CANCEL_PX;
    canceledRef.current = now;
    setCanceling(now);
  }

  function end(e) {
    if (state !== 'recording') return;
    try {
      if (pointerIdRef.current != null) e.currentTarget.releasePointerCapture(pointerIdRef.current);
    } catch {
      // already released
    }
    finish(false);
  }

  function cancelPointer() {
    if (state !== 'recording') return;
    canceledRef.current = true;
    finish(false);
  }

  return (
    <>
      {/* display:contents in the idle/uploading case so the wrapper never
          affects composer layout; the same button element (key="mic-btn")
          persists across the idle <-> recording transition, so pointer
          capture taken on pointerdown survives the state change. */}
      <div className={state === 'recording' ? `wa-recording-row${canceling ? ' canceling' : ''}` : undefined} style={state === 'recording' ? undefined : { display: 'contents' }}>
        {state === 'recording' && (
          <>
            <span className="rec-dot" aria-hidden="true" />
            <span className="rec-timer">{fmt(elapsedMs)}</span>
            <span className="rec-hint">{canceling ? strings.slideToCancel : `◁ ${strings.slideToCancel}`}</span>
          </>
        )}
        <button
          key="mic-btn"
          type="button"
          className="wa-send"
          disabled={state === 'uploading' || !available}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={cancelPointer}
          aria-label={strings.voiceMessage}
          // Stop iOS Safari's long-press callout/selection and the page's
          // own scroll gesture from hijacking the hold before pointerdown
          // registers — inline since it's specific to this one gesture.
          style={{ touchAction: 'none', WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' }}
        >
          <Icon name="mic" />
        </button>
      </div>
      {error && <p className="wa-foot-note" style={{ color: '#b91c1c' }}>{error}</p>}
    </>
  );
}
