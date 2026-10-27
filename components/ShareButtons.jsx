'use client';

import { useState } from 'react';
import Icon from '@/components/Icon';

// Share a listing (most homes in Haiti travel by WhatsApp). The WhatsApp
// button opens WhatsApp with the title, price and link; the link preview
// (photo, title, price) comes from the page's Open Graph tags. "Share"
// uses the phone's own share sheet where there is one, otherwise copies
// the link.
export default function ShareButtons({ url, text, strings }) {
  const [copied, setCopied] = useState(false);
  const wa = `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`;

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title: text, text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // the person closed the share sheet — nothing to do
    }
  }

  return (
    <div className="share-row">
      <a className="btn btn-whatsapp" href={wa} target="_blank" rel="noopener noreferrer">
        <Icon name="chat" /> {strings.shareWhatsApp}
      </a>
      <button type="button" className="btn btn-secondary" onClick={share}>
        <Icon name="share" /> {copied ? strings.linkCopied : strings.shareLink}
      </button>
    </div>
  );
}
