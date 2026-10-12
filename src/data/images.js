// Cloudinary image helper for the website (C-20261012-WEBBEAUTY).
// All site photos are our own pieces, staged in the approved luxury look (R-074/R-076/R-077/R-088).
// Images are served resized and in modern formats (f_auto,q_auto) so pages stay fast.
const CLOUD = 'https://res.cloudinary.com/rknejib2/image/upload/';

/** Cloudinary URL for a public id at a width and aspect ratio (e.g. '4:5'). */
export function img(publicId, width, ar = '4:5') {
  return `${CLOUD}c_fill,ar_${ar},w_${width},g_auto,f_auto,q_auto/${publicId}`;
}

/** srcset string for responsive images. */
export function srcset(publicId, widths = [400, 640, 900, 1200], ar = '4:5') {
  return widths.map((w) => `${img(publicId, w, ar)} ${w}w`).join(', ');
}
