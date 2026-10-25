'use client';

import { useEffect, useState } from 'react';
import { getSession } from '@/lib/account';
import ReportForm from './ReportForm';
import Icon from '@/components/Icon';

// "Report this listing" on a listing page, for signed-in users who are
// not its owner.
export default function ReportListingButton({ listingId, owner, strings }) {
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const session = getSession();
    setVisible(!!session && session.username !== owner);
  }, [owner]);

  if (!visible) return null;
  return (
    <div style={{ marginTop: 16 }}>
      {open ? (
        <ReportForm kind="listing" listingId={listingId} strings={strings} onDone={() => setOpen(false)} />
      ) : (
        <button type="button" className="link-btn" onClick={() => setOpen(true)}><Icon name="flag" /> {strings.reportListing}</button>
      )}
    </div>
  );
}
