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
    // Ad counting (0019): a view is a card actually shown, a click is a
    // tap on the card's link. Views report at most once per card per
    // browser session, so a refresh does not burn the budget; clicks
    // report every tap. Both posts are fire-and-forget and never return
    // counts — budgets stay hidden from everyone but the admin.
    const seenKey = (id) => `kay-ad-seen:${id}`;
    function report(path, id) {
      try {
        fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ listingId: id }), keepalive: true });
      } catch { /* counting must never break navigation */ }
    }
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const id = entry.target.getAttribute('data-ad-card');
        if (!id || sessionStorage.getItem(seenKey(id))) continue;
        sessionStorage.setItem(seenKey(id), '1');
        report('/api/ads/impression', id);
      }
    }, { threshold: 0.5 });
    el.querySelectorAll('[data-ad-card]').forEach((card) => observer.observe(card));
    function onClick(e) {
      const card = e.target.closest?.('[data-ad-card]');
      const link = e.target.closest?.('a');
      if (card && link && card.contains(link)) report('/api/ads/click', card.getAttribute('data-ad-card'));
    }
    el.addEventListener('click', onClick);
    return () => {
      observer.disconnect();
      el.removeEventListener('click', onClick);
    };
  }, []);

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
