import { displayRatio, isTinyImage, readerImageUrl, sameImage } from '@/features/reader/images';

const BASE = 'https://news.example.com/2026/11/story.html';

describe('readerImageUrl', () => {
  it('resolves relative URLs against the article URL', () => {
    expect(readerImageUrl('/media/a.jpg', BASE)).toBe('https://news.example.com/media/a.jpg');
    expect(readerImageUrl('img/b.png', BASE)).toBe('https://news.example.com/2026/11/img/b.png');
    expect(readerImageUrl('../c.webp', BASE)).toBe('https://news.example.com/2026/c.webp');
    expect(readerImageUrl('//cdn.example.com/d.jpg', BASE)).toBe('https://cdn.example.com/d.jpg');
    expect(readerImageUrl('https://cdn.example.com/e.jpg', null)).toBe('https://cdn.example.com/e.jpg');
    expect(readerImageUrl('a b.jpg', BASE)).toBe('https://news.example.com/2026/11/a%20b.jpg');
  });
  it('skips data URIs, trackers and icons', () => {
    expect(readerImageUrl('data:image/gif;base64,R0lGOD', BASE)).toBeNull();
    expect(readerImageUrl('https://t.example.com/pixel.gif?u=1', BASE)).toBeNull();
    expect(readerImageUrl('https://feeds.feedburner.com/~r/x/~4/abc', BASE)).toBeNull();
    expect(readerImageUrl('https://s.w.org/images/core/emoji/15.0/72x72/1f600.png', BASE)).toBeNull();
    expect(readerImageUrl('https://x.example.com/img/logo-32x32.png', BASE)).toBeNull();
    expect(readerImageUrl('https://x.example.com/img/photo.jpg?w=40', BASE)).toBeNull();
    expect(readerImageUrl('https://x.example.com/img/photo-1200x628.jpg', BASE)).toBe('https://x.example.com/img/photo-1200x628.jpg');
    expect(readerImageUrl('', BASE)).toBeNull();
    expect(readerImageUrl('relative.jpg', null)).toBeNull();
  });
});

describe('image sizing', () => {
  it('keeps the natural ratio inside a readable band', () => {
    expect(displayRatio(1200, 600)).toEqual({ ratio: 2, clamped: false });
    expect(displayRatio(400, 2000)).toEqual({ ratio: 0.6, clamped: true });
    expect(displayRatio(0, 0)).toEqual({ ratio: 16 / 9, clamped: false });
  });
  it('treats icon-sized images as tiny', () => {
    expect(isTinyImage(32, 32)).toBe(true);
    expect(isTinyImage(32, 400)).toBe(false);
  });
  it('matches the same image across sizes and protocols', () => {
    expect(sameImage('https://tpucdn.com/img/abc.jpg', 'http://tpucdn.com/img/abc_thm.jpg')).toBe(true);
    expect(sameImage('https://x.com/a.jpg?w=800', 'https://www.x.com/a.jpg')).toBe(true);
    expect(sameImage('https://x.com/a.jpg', 'https://x.com/b.jpg')).toBe(false);
  });
});
