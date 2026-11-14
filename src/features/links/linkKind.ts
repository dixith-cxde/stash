/**
 * What a saved URL points at, from its host and path alone (no network): an app store
 * listing, a code repository, a package, documentation, a video, or an ordinary page.
 * Pure and unit-tested; drives the label and icon on cards and the item page.
 */
import { youtubeId } from '@/features/preview/parseMeta';

export type LinkKind =
  | { kind: 'app'; store: 'Play Store' | 'App Store' | 'F-Droid' | 'Microsoft Store'; appId?: string }
  | { kind: 'repo'; forge: 'GitHub' | 'GitLab' | 'Codeberg' | 'Bitbucket' | 'SourceHut'; owner: string; name: string }
  | { kind: 'package'; registry: 'npm' | 'PyPI' | 'crates.io' | 'pub.dev' | 'Go'; name: string }
  | { kind: 'docs'; site: string }
  | { kind: 'video' }
  | { kind: 'link' };

/** First path segments on github.com that are site pages, not users or orgs. */
const GITHUB_RESERVED = new Set([
  'about', 'apps', 'collections', 'contact', 'customer-stories', 'enterprise', 'events', 'explore',
  'features', 'issues', 'login', 'marketplace', 'new', 'notifications', 'orgs', 'organizations',
  'pricing', 'pulls', 'readme', 'search', 'security', 'settings', 'site', 'sponsors', 'team',
  'topics', 'trending', 'join', 'signup', 'codespaces', 'resources', 'solutions',
]);

const GITLAB_RESERVED = new Set(['explore', 'help', 'users', 'dashboard', 'groups', 'projects', 'search', 'admin', '-']);

/** Path prefixes that mean documentation on any site (nextjs.org/docs, react.dev/reference). */
const DOCS_PATH = new Set(['docs', 'doc', 'documentation', 'reference', 'manual', 'api-reference', 'apidocs', 'handbook']);

/** Hosts that are documentation as a whole. */
const DOCS_HOSTS: Record<string, string> = {
  'developer.mozilla.org': 'MDN',
  'learn.microsoft.com': 'Microsoft Learn',
  'docs.rs': 'docs.rs',
  'devdocs.io': 'DevDocs',
  'docs.python.org': 'Python',
  'kotlinlang.org': 'Kotlin',
  'reactnative.dev': 'React Native',
};

function parse(url: string): URL | null {
  try {
    const u = new URL(url.trim());
    return u.protocol === 'http:' || u.protocol === 'https:' ? u : null;
  } catch {
    return null;
  }
}

const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

const segs = (u: URL) => u.pathname.split('/').filter(Boolean).map(decode);

export function linkKind(url: string | null | undefined): LinkKind {
  if (!url) return { kind: 'link' };
  const u = parse(url);
  if (!u) return { kind: 'link' };
  const host = u.hostname.toLowerCase().replace(/^(www|m)\./, '');
  const p = segs(u);

  if (youtubeId(url)) return { kind: 'video' };

  // --- App stores
  if (host === 'play.google.com' && p[0] === 'store' && p[1] === 'apps') {
    return { kind: 'app', store: 'Play Store', appId: u.searchParams.get('id') ?? undefined };
  }
  if ((host === 'apps.apple.com' || host === 'itunes.apple.com') && p.includes('app')) {
    const id = p.find((s) => /^id\d+$/.test(s));
    return { kind: 'app', store: 'App Store', appId: id };
  }
  if (host === 'f-droid.org') {
    const i = p.indexOf('packages');
    if (i >= 0 && p[i + 1]) return { kind: 'app', store: 'F-Droid', appId: p[i + 1] };
  }
  if (host === 'apps.microsoft.com' && p.includes('detail')) return { kind: 'app', store: 'Microsoft Store' };

  // --- Code forges
  if (host === 'github.com' && p.length >= 2 && !GITHUB_RESERVED.has(p[0].toLowerCase())) {
    return { kind: 'repo', forge: 'GitHub', owner: p[0], name: p[1].replace(/\.git$/, '') };
  }
  if (host === 'gitlab.com' && p.length >= 2 && !GITLAB_RESERVED.has(p[0])) {
    const dash = p.indexOf('-');
    const path = dash >= 0 ? p.slice(0, dash) : p;
    if (path.length >= 2) {
      return { kind: 'repo', forge: 'GitLab', owner: path.slice(0, -1).join('/'), name: path[path.length - 1].replace(/\.git$/, '') };
    }
  }
  if (host === 'codeberg.org' && p.length >= 2 && !['explore', 'user', 'repo', 'org'].includes(p[0])) {
    return { kind: 'repo', forge: 'Codeberg', owner: p[0], name: p[1].replace(/\.git$/, '') };
  }
  if (host === 'bitbucket.org' && p.length >= 2) {
    return { kind: 'repo', forge: 'Bitbucket', owner: p[0], name: p[1].replace(/\.git$/, '') };
  }
  if (host === 'git.sr.ht' && p.length >= 2 && p[0].startsWith('~')) {
    return { kind: 'repo', forge: 'SourceHut', owner: p[0].slice(1), name: p[1] };
  }

  // --- Package registries
  if (host === 'npmjs.com' && p[0] === 'package' && p[1]) {
    return { kind: 'package', registry: 'npm', name: p[1].startsWith('@') && p[2] ? `${p[1]}/${p[2]}` : p[1] };
  }
  if (host === 'pypi.org' && p[0] === 'project' && p[1]) return { kind: 'package', registry: 'PyPI', name: p[1] };
  if (host === 'crates.io' && p[0] === 'crates' && p[1]) return { kind: 'package', registry: 'crates.io', name: p[1] };
  if (host === 'pub.dev' && p[0] === 'packages' && p[1]) return { kind: 'package', registry: 'pub.dev', name: p[1] };
  if (host === 'pkg.go.dev' && p.length) return { kind: 'package', registry: 'Go', name: p.join('/') };

  // --- Documentation
  if (DOCS_HOSTS[host]) return { kind: 'docs', site: DOCS_HOSTS[host] };
  const rtd = host.match(/^([^.]+)\.readthedocs\.(io|org)$/);
  if (rtd) return { kind: 'docs', site: rtd[1] };
  if (/^(docs|developer|developers|devdocs|api-docs|reference)\./.test(host)) {
    return { kind: 'docs', site: host.replace(/^(docs|developer|developers|devdocs|api-docs|reference)\./, '') };
  }
  if (p[0] && DOCS_PATH.has(p[0].toLowerCase())) return { kind: 'docs', site: host };

  return { kind: 'link' };
}

/** "App · Play Store", "Repo · owner/name", "Docs · MDN"; null for videos and plain links. */
export function linkKindLabel(k: LinkKind): string | null {
  switch (k.kind) {
    case 'app':
      return `App · ${k.store}`;
    case 'repo':
      return `Repo · ${k.owner}/${k.name}`;
    case 'package':
      return `Package · ${k.name}`;
    case 'docs':
      return `Docs · ${k.site}`;
    default:
      return null;
  }
}
