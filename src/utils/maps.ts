import { Capacitor } from '@capacitor/core';

/** Build a Maps search string from listing fields — never force USA. */
export function buildBusinessMapQuery(business: {
  name?: string;
  address?: string;
  area?: string;
  city?: string;
}): string {
  const name = String(business.name || '').trim();
  const address = String(business.address || '').trim();
  const area = String(business.area || '').trim();
  const city = String(business.city || '').trim();

  const addrBlob = `${address} ${area}`.toLowerCase();
  const nonUsHint =
    /karachi|lahore|islamabad|rawalpindi|faisalabad|pakistan|dubai|abu dhabi|uae|london|toronto|delhi|mumbai|india|bangladesh|uk|canada/i.test(
      addrBlob,
    );
  const usCityOnly = /^(new york|los angeles|chicago|houston|miami)$/i.test(city);

  const parts: string[] = [];
  if (address) parts.push(address);
  if (area && !addrBlob.includes(area.toLowerCase())) parts.push(area);
  if (city && !addrBlob.includes(city.toLowerCase())) {
    if (!(nonUsHint && usCityOnly)) parts.push(city);
  }

  const location = parts.join(', ');
  return [name, location].filter(Boolean).join(', ');
}

export function googleMapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Embeddable preview (no API key). */
export function googleMapsEmbedUrl(query: string): string {
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=16&output=embed`;
}

/** Open Maps app / browser — works in Capacitor WebView where window.open is often blocked. */
export function openBusinessInMaps(query: string): void {
  const q = String(query || '').trim();
  if (!q) return;

  const encoded = encodeURIComponent(q);
  const webUrl = googleMapsSearchUrl(q);
  const platform = Capacitor.getPlatform();

  if (Capacitor.isNativePlatform()) {
    if (platform === 'android') {
      // Launches Google Maps / default maps via Android intent
      window.location.href = `geo:0,0?q=${encoded}`;
      return;
    }
    if (platform === 'ios') {
      window.location.href = `maps:0,0?q=${encoded}`;
      return;
    }
  }

  const opened = window.open(webUrl, '_blank', 'noopener,noreferrer');
  if (!opened) {
    const a = document.createElement('a');
    a.href = webUrl;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}

export function openExternalUrl(url: string): void {
  if (!url) return;
  if (url.startsWith('tel:') || url.startsWith('mailto:')) {
    window.location.href = url;
    return;
  }
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (!opened) {
    if (Capacitor.isNativePlatform()) {
      window.location.href = url;
      return;
    }
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}
