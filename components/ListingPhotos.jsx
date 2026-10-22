'use client';

import { useEffect, useRef, useState } from 'react';

// Listing photos with a zoomable lightbox: tap any photo to open it
// full-screen, then pinch (touch), scroll (mouse wheel) or use the
// + / − buttons to zoom in and out, and drag to pan while zoomed.
// Double-tap toggles between fit and 2×. Escape closes, arrows move
// between photos.
export default function ListingPhotos({ photos, placeholder }) {
  const [openIndex, setOpenIndex] = useState(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const scaleRef = useRef(1);
  const pointers = useRef(new Map());
  const lastPinch = useRef(null);
  const lastTap = useRef(0);
  const stageRef = useRef(null);

  function applyScale(next) {
    const clamped = Math.min(4, Math.max(1, next));
    scaleRef.current = clamped;
    setScale(clamped);
    if (clamped === 1) setPan({ x: 0, y: 0 });
  }

  function open(i) {
    setOpenIndex(i);
    applyScale(1);
    setPan({ x: 0, y: 0 });
  }

  function step(dir) {
    setOpenIndex((i) => (i + dir + photos.length) % photos.length);
    applyScale(1);
    setPan({ x: 0, y: 0 });
  }

  // Wheel zoom needs a non-passive listener (React's onWheel cannot
  // preventDefault), and Escape/arrows close or move between photos.
  useEffect(() => {
    if (openIndex === null) return;
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (e) => {
      e.preventDefault();
      applyScale(scaleRef.current * (e.deltaY < 0 ? 1.15 : 0.87));
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpenIndex(null);
      if (e.key === 'ArrowLeft' && photos.length > 1) step(-1);
      if (e.key === 'ArrowRight' && photos.length > 1) step(1);
    };
    stage.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      stage.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openIndex]);

  function onPointerDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    lastPinch.current = null;
  }

  function onPointerMove(e) {
    if (!pointers.current.has(e.pointerId)) return;
    const prev = pointers.current.get(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length === 2) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      if (lastPinch.current && lastPinch.current.dist > 0) {
        applyScale(scaleRef.current * (dist / lastPinch.current.dist));
        setPan((p) => ({ x: p.x + (mid.x - lastPinch.current.mid.x), y: p.y + (mid.y - lastPinch.current.mid.y) }));
      }
      lastPinch.current = { dist, mid };
    } else if (pts.length === 1 && scaleRef.current > 1) {
      setPan((p) => ({ x: p.x + (e.clientX - prev.x), y: p.y + (e.clientY - prev.y) }));
    }
  }

  function onPointerUp(e) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) lastPinch.current = null;
    const now = Date.now();
    if (now - lastTap.current < 300) {
      applyScale(scaleRef.current > 1 ? 1 : 2);
      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  }

  if (!photos || photos.length === 0) {
    return (
      <div className="house-art" style={{ borderRadius: 16, marginTop: 16, height: 200 }}>{placeholder}</div>
    );
  }

  return (
    <>
      <img
        src={photos[0]}
        alt=""
        onClick={() => open(0)}
        style={{ width: '100%', height: 260, objectFit: 'cover', borderRadius: 16, marginTop: 16, display: 'block', cursor: 'zoom-in' }}
      />
      {photos.length > 1 && (
        <div className="gallery">
          {photos.slice(1).map((src, i) => (
            <img key={src} src={src} alt="" onClick={() => open(i + 1)} style={{ cursor: 'zoom-in' }} />
          ))}
        </div>
      )}
      {openIndex !== null && (
        <div
          ref={stageRef}
          onClick={() => setOpenIndex(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'none' }}
        >
          <button
            type="button"
            onClick={() => setOpenIndex(null)}
            aria-label="Close"
            style={{ position: 'absolute', top: 16, right: 16, zIndex: 2, width: 44, height: 44, borderRadius: 999, border: 'none', background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 22, cursor: 'pointer' }}
          >
            ✕
          </button>
          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); step(-1); }}
                aria-label="Previous photo"
                style={{ position: 'absolute', left: 12, zIndex: 2, width: 44, height: 44, borderRadius: 999, border: 'none', background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 22, cursor: 'pointer' }}
              >
                ‹
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); step(1); }}
                aria-label="Next photo"
                style={{ position: 'absolute', right: 12, zIndex: 2, width: 44, height: 44, borderRadius: 999, border: 'none', background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 22, cursor: 'pointer' }}
              >
                ›
              </button>
            </>
          )}
          <div
            onClick={(e) => e.stopPropagation()}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            style={{ touchAction: 'none', maxWidth: '100%', maxHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <img
              src={photos[openIndex]}
              alt=""
              draggable={false}
              style={{
                maxWidth: '100vw',
                maxHeight: '100vh',
                objectFit: 'contain',
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                userSelect: 'none',
                cursor: scale > 1 ? 'grab' : 'zoom-in',
              }}
            />
          </div>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8, alignItems: 'center', zIndex: 2 }}
          >
            <button type="button" onClick={() => applyScale(scaleRef.current / 1.4)} aria-label="Zoom out" style={{ width: 44, height: 44, borderRadius: 999, border: 'none', background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 22, cursor: 'pointer' }}>−</button>
            <span style={{ color: '#fff', fontWeight: 700, minWidth: 56, textAlign: 'center' }}>{Math.round(scale * 100)}%</span>
            <button type="button" onClick={() => applyScale(scaleRef.current * 1.4)} aria-label="Zoom in" style={{ width: 44, height: 44, borderRadius: 999, border: 'none', background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 22, cursor: 'pointer' }}>+</button>
            <button type="button" onClick={() => applyScale(1)} aria-label="Reset zoom" style={{ height: 44, padding: '0 16px', borderRadius: 999, border: 'none', background: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Reset</button>
          </div>
        </div>
      )}
    </>
  );
}
