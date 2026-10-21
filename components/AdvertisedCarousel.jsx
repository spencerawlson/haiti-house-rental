'use client';

import { useEffect, useRef } from 'react';

// The advertised-houses carousel flows on its own — nobody should have to
// drag it. It advances one card every 3 seconds and loops back to the
// start. A finger (or mouse) on it pauses the flow; it resumes a few
// seconds after the user lets go. Stays still for reduced-motion users,
// and does nothing when everything already fits on screen.
export default function AdvertisedCarousel({ children }) {
  const ref = useRef(null);
  const paused = useRef(false);
  const resumeTimer = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (el.scrollWidth <= el.clientWidth + 8) return;

    function step() {
      if (paused.current || document.hidden) return;
      const card = el.firstElementChild;
      const gap = parseInt(getComputedStyle(el).gap, 10) || 16;
      const advance = (card ? card.offsetWidth : 280) + gap;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 10;
      el.scrollBy({ left: atEnd ? -el.scrollLeft : advance, behavior: 'smooth' });
    }
    const id = setInterval(step, 3000);

    function pause() {
      paused.current = true;
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    }
    function resume() {
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
      resumeTimer.current = setTimeout(() => { paused.current = false; }, 5000);
    }
    el.addEventListener('pointerdown', pause);
    el.addEventListener('pointerup', resume);
    el.addEventListener('mouseenter', pause);
    el.addEventListener('mouseleave', resume);
    return () => {
      clearInterval(id);
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
      el.removeEventListener('pointerdown', pause);
      el.removeEventListener('pointerup', resume);
      el.removeEventListener('mouseenter', pause);
      el.removeEventListener('mouseleave', resume);
    };
  }, []);

  return (
    <div className="carousel" ref={ref}>
      {children}
    </div>
  );
}
