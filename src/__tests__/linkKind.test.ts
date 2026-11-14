import { linkKind, linkKindLabel } from '@/features/links/linkKind';

const label = (url: string) => linkKindLabel(linkKind(url));

describe('linkKind', () => {
  it('recognises app store listings', () => {
    expect(linkKind('https://play.google.com/store/apps/details?id=org.mozilla.firefox&hl=en')).toEqual({
      kind: 'app',
      store: 'Play Store',
      appId: 'org.mozilla.firefox',
    });
    expect(linkKind('https://apps.apple.com/us/app/things-3/id904237743')).toMatchObject({ kind: 'app', store: 'App Store', appId: 'id904237743' });
    expect(linkKind('https://f-droid.org/en/packages/org.fdroid.fdroid/')).toMatchObject({ kind: 'app', store: 'F-Droid', appId: 'org.fdroid.fdroid' });
    expect(label('https://play.google.com/store/apps/details?id=x')).toBe('App · Play Store');
    // Not an app page.
    expect(linkKind('https://play.google.com/store/books/details?id=1').kind).toBe('link');
  });

  it('recognises repositories on code forges', () => {
    expect(linkKind('https://github.com/facebook/react')).toEqual({ kind: 'repo', forge: 'GitHub', owner: 'facebook', name: 'react' });
    expect(label('https://www.github.com/expo/expo/tree/main/packages')).toBe('Repo · expo/expo');
    expect(label('https://github.com/a/b.git')).toBe('Repo · a/b');
    expect(label('https://gitlab.com/group/sub/project/-/issues/3')).toBe('Repo · group/sub/project');
    expect(label('https://codeberg.org/forgejo/forgejo')).toBe('Repo · forgejo/forgejo');
    expect(label('https://git.sr.ht/~sircmpwn/aerc')).toBe('Repo · sircmpwn/aerc');
  });

  it('does not mistake GitHub site pages or profiles for repos', () => {
    expect(linkKind('https://github.com/topics/react').kind).toBe('link');
    expect(linkKind('https://github.com/features/actions').kind).toBe('link');
    expect(linkKind('https://github.com/torvalds').kind).toBe('link');
    expect(linkKind('https://gist.github.com/a/123').kind).toBe('link');
  });

  it('recognises packages', () => {
    expect(label('https://www.npmjs.com/package/@expo/vector-icons')).toBe('Package · @expo/vector-icons');
    expect(label('https://pypi.org/project/requests/')).toBe('Package · requests');
    expect(label('https://crates.io/crates/serde')).toBe('Package · serde');
  });

  it('recognises documentation by host and path', () => {
    expect(label('https://developer.mozilla.org/en-US/docs/Web/CSS/grid')).toBe('Docs · MDN');
    expect(label('https://docs.expo.dev/versions/latest/')).toBe('Docs · expo.dev');
    expect(label('https://developer.android.com/guide')).toBe('Docs · android.com');
    expect(label('https://requests.readthedocs.io/en/latest/')).toBe('Docs · requests');
    expect(label('https://nextjs.org/docs/app')).toBe('Docs · nextjs.org');
    expect(label('https://react.dev/reference/react/useState')).toBe('Docs · react.dev');
    // dev.to is a blog, not docs.
    expect(linkKind('https://dev.to/someone/post').kind).toBe('link');
  });

  it('keeps YouTube as video and everything else as a plain link', () => {
    expect(linkKind('https://www.youtube.com/watch?v=dQw4w9WgXcQ').kind).toBe('video');
    expect(linkKind('https://youtu.be/dQw4w9WgXcQ').kind).toBe('video');
    expect(linkKind('https://www.theverge.com/2026/1/1/story').kind).toBe('link');
    expect(label('https://www.theverge.com/x')).toBeNull();
    expect(linkKind('not a url').kind).toBe('link');
    expect(linkKind(null).kind).toBe('link');
    expect(linkKind('ftp://github.com/a/b').kind).toBe('link');
  });
});
