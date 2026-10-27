'use client';

import { useState } from 'react';
import Link from 'next/link';

// Mobile landing menu (<900px): the header links that used to wrap under
// the logo now live behind a hamburger button. Order is deliberate:
// account/sign-in first, post-home second, how-it-works LAST. The menu
// stays in the DOM when closed (CSS hides it) so the links still resolve
// without JavaScript and stay checkable in served HTML.
export default function LandingNavMenu({ accountHref, accountLabel, postHref, postLabel, howHref, howLabel }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="lp-menu-wrap">
      <button type="button" className="lp-burger" aria-expanded={open} aria-controls="lp-menu" aria-label="Menu" onClick={() => setOpen((v) => !v)}>
        {'\u2630'}
      </button>
      <div id="lp-menu" className={open ? 'lp-menu open' : 'lp-menu'}>
        <Link className="lp-menu-link" href={accountHref} onClick={() => setOpen(false)}>{accountLabel}</Link>
        <Link className="btn lp-menu-post" href={postHref} onClick={() => setOpen(false)}>{postLabel}</Link>
        <Link className="lp-menu-link" href={howHref} onClick={() => setOpen(false)}>{howLabel}</Link>
      </div>
    </div>
  );
}
