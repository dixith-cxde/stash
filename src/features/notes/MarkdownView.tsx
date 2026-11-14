import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { Lexer, type Token, type Tokens } from 'marked';
import { Image } from 'expo-image';
import { createContext, Fragment, use, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, type TextStyle, View } from 'react-native';

import { resolveUrl } from '@/features/feeds/parse';
import { fitColumns, tableColumnWidths } from '@/features/notes/table';
import { readerImageUrl } from '@/features/reader/images';
import { ReaderImage } from '@/features/reader/ReaderImage';
import { useAppTheme } from '@/theme/AppTheme';
import { MONO_FAMILY } from '@/theme/type';
import { CheckboxRow } from '@/ui/Checkbox';
import { Ico } from '@/ui/Ico';
import { PressableSurface } from '@/ui/PressableSurface';
import { ProgressBar } from '@/ui/ProgressBar';
import { Text } from '@/ui/Text';

type Props = {
  markdown: string;
  /** Toggle the n-th task (document order). Omit to render read-only boxes. */
  onToggleTask?: (index: number) => void;
  /** Resolves a [[wiki link]] title to a bookmark id (open on tap). */
  resolveLink?: (title: string) => string | undefined;
  /** Makes [links](url) tappable (articles open them in the browser). */
  onOpenLink?: (url: string) => void;
  /** Long-form reading: larger, justified body text, figures with captions (feed articles). */
  reading?: boolean;
  /** Small text and tight spacing, for comments under an article. */
  compact?: boolean;
  /** Page URL that relative links and images resolve against (reading / compact). */
  baseUrl?: string | null;
};

type Ctx = { onOpenLink?: (url: string) => void; reading: boolean; compact: boolean; baseUrl: string | null };
const ReadingContext = createContext<Ctx>({ reading: false, compact: false, baseUrl: null });

/**
 * Justified long-form paragraphs. Android breaks lines with the high-quality strategy and
 * hyphenates, so justified lines do not open wide gaps between words.
 */
const JUSTIFIED: TextStyle = { textAlign: 'justify' };
const justifyProps =
  Platform.OS === 'android' ? ({ textBreakStrategy: 'highQuality', android_hyphenationFrequency: 'full' } as const) : {};

/** A paragraph that is only an italic run: a figure caption (the extractor writes figcaptions so). */
const isCaption = (t: Token | undefined): t is Tokens.Paragraph =>
  t?.type === 'paragraph' && (t as Tokens.Paragraph).tokens?.length === 1 && (t as Tokens.Paragraph).tokens[0].type === 'em';

const plainOf = (tokens: Token[] | undefined): string =>
  (tokens ?? []).map((x) => ('tokens' in x && x.tokens ? plainOf(x.tokens) : 'text' in x ? String(x.text) : '')).join('');

const isImageOnly = (inline: Token[]) =>
  inline.some((x) => x.type === 'image') &&
  inline.every((x) => x.type === 'image' || x.type === 'br' || (x.type === 'text' && !x.raw.trim()));

/** One rendered block: the token, the next non-space token, and a figure caption it absorbed. */
type Item = { t: Token; next?: Token; caption?: string };

/** Pairs each token with the next non-space one (linear), and folds figure captions into images. */
function layout(tokens: Token[], figures: boolean): Item[] {
  const items: Item[] = [];
  let next: Token | undefined;
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i];
    if (t.type === 'space') continue;
    items.push({ t, next });
    next = t;
  }
  items.reverse();
  if (!figures) return items;
  const out: Item[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const inline = it.t.type === 'paragraph' ? ((it.t as Tokens.Paragraph).tokens ?? []) : [];
    if (inline.length && isImageOnly(inline) && isCaption(items[i + 1]?.t)) {
      out.push({ ...it, next: items[i + 1].next, caption: plainOf((items[i + 1].t as Tokens.Paragraph).tokens).trim() });
      i++;
    } else out.push(it);
  }
  return out;
}

/** An image block that keeps its own aspect ratio once loaded (articles). */
function MdImage({ src, alt }: { src: string; alt: string }) {
  const { colors } = useAppTheme();
  const [ratio, setRatio] = useState(16 / 9);
  return (
    <Image
      source={src}
      accessibilityLabel={alt || undefined}
      onLoad={(e) => {
        if (e.source.width && e.source.height) setRatio(e.source.width / e.source.height);
      }}
      style={{
        width: '100%',
        aspectRatio: Math.max(0.5, Math.min(ratio, 3)),
        borderRadius: 20,
        marginTop: 16,
        backgroundColor: colors.surfaceContainerHigh,
      }}
      contentFit="cover"
      transition={150}
    />
  );
}

/**
 * Renders a Markdown note with Stash components (design: Note artboard): headings, quote
 * cards, checklists with progress, code blocks with Copy, inline bold/italic/code/links and
 * [[saved item]] links.
 */
export function MarkdownView({ markdown, onToggleTask, resolveLink, onOpenLink, reading = false, compact = false, baseUrl = null }: Props) {
  const figures = reading || compact;
  const items = useMemo(() => layout(Lexer.lex(markdown, { gfm: true }), figures), [markdown, figures]);
  const ctx = useMemo(() => ({ onOpenLink, reading, compact, baseUrl }), [onOpenLink, reading, compact, baseUrl]);
  let task = 0;
  const nextTask = () => task++;

  return (
    <ReadingContext value={ctx}>
      <View style={compact ? { marginTop: -8 } : undefined}>
        {items.map((it, i) => (
          <Fragment key={i}>
            <Block t={it.t} next={it.next} caption={it.caption} nextTask={nextTask} onToggleTask={onToggleTask} resolveLink={resolveLink} />
          </Fragment>
        ))}
      </View>
    </ReadingContext>
  );
}

type BlockProps = {
  t: Token;
  next?: Token;
  caption?: string;
  nextTask: () => number;
  onToggleTask?: (i: number) => void;
  resolveLink?: (title: string) => string | undefined;
};

function Block(props: BlockProps) {
  const { reading, compact } = use(ReadingContext);
  return reading || compact ? <ReaderBlock {...props} /> : <NoteBlock {...props} />;
}

function NoteBlock({ t, next, nextTask, onToggleTask, resolveLink }: BlockProps) {
  const { colors } = useAppTheme();
  switch (t.type) {
    case 'heading': {
      const h = t as Tokens.Heading;
      const tasks = next?.type === 'list' ? (next as Tokens.List).items.filter((it) => it.task) : [];
      const done = tasks.filter((it) => it.checked).length;
      return (
        <View style={{ marginTop: 26, marginBottom: tasks.length ? 0 : 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <Text variant={h.depth <= 2 ? 'titleLargeEmphasized' : 'titleMediumEmphasized'} accessibilityRole="header" style={{ flex: 1 }}>
              <Inline tokens={h.tokens} resolveLink={resolveLink} />
            </Text>
            {tasks.length > 0 && (
              <Text variant="labelLarge" color="onSurfaceVariant" style={{ fontWeight: '700' }}>
                {`${done} of ${tasks.length} done`}
              </Text>
            )}
          </View>
          {tasks.length > 0 && (
            <View style={{ marginTop: 10, marginBottom: 12 }}>
              <ProgressBar value={done / tasks.length} height={6} trackColor={colors.surfaceContainerHighest} />
            </View>
          )}
        </View>
      );
    }
    case 'paragraph': {
      const inline = (t as Tokens.Paragraph).tokens ?? [];
      const images = inline.filter((x) => x.type === 'image') as Tokens.Image[];
      // A paragraph that is only images (articles) renders them as blocks.
      const onlyImages = inline.every((x) => x.type === 'image' || x.type === 'br' || (x.type === 'text' && !x.raw.trim()));
      if (images.length && onlyImages) {
        return (
          <>
            {images.map((img, i) => (
              <MdImage key={i} src={img.href} alt={img.text} />
            ))}
          </>
        );
      }
      return <Paragraph tokens={inline} resolveLink={resolveLink} />;
    }
    case 'blockquote':
      return <QuoteBlock q={t as Tokens.Blockquote} resolveLink={resolveLink} />;
    case 'table':
      return <TableBlock t={t as Tokens.Table} resolveLink={resolveLink} />;
    case 'html':
      return <HtmlBlock html={(t as Tokens.HTML).text} />;
    case 'list': {
      const l = t as Tokens.List;
      return (
        <View style={{ gap: 4, marginTop: l.items.some((it) => it.task) ? 0 : 12 }}>
          {l.items.map((it, i) => {
            if (it.task) {
              const index = nextTask();
              const label = it.text.replace(/^\[[ xX]\]\s*/, '');
              return (
                <CheckboxRow
                  key={i}
                  checked={!!it.checked}
                  label={label.replace(/\[\[([^\]]+)\]\]/g, '$1')}
                  onChange={() => onToggleTask?.(index)}
                />
              );
            }
            return (
              <View key={i} style={{ flexDirection: 'row', gap: 10, paddingLeft: 4 }}>
                <Text variant="bodyLarge" color="primary">
                  {l.ordered ? `${Number(l.start || 1) + i}.` : '•'}
                </Text>
                <Text variant="bodyLarge" style={{ flex: 1 }}>
                  <Inline tokens={(it.tokens[0] as Tokens.Text)?.tokens ?? it.tokens} resolveLink={resolveLink} />
                </Text>
              </View>
            );
          })}
        </View>
      );
    }
    case 'code':
      return <CodeBlock code={(t as Tokens.Code).text} lang={(t as Tokens.Code).lang} />;
    case 'hr':
      return <View style={{ height: 1, backgroundColor: colors.outlineVariant, marginVertical: 20 }} />;
    default:
      return null;
  }
}

/** Article and comment blocks: justified reading text, figures with captions, compact comments. */
function ReaderBlock({ t, caption, resolveLink }: BlockProps) {
  const { colors } = useAppTheme();
  const { compact, baseUrl } = use(ReadingContext);
  switch (t.type) {
    case 'heading': {
      const h = t as Tokens.Heading;
      if (compact) {
        return (
          <Text variant="bodyMedium" style={{ marginTop: 8, fontWeight: '700' }}>
            <Inline tokens={h.tokens} resolveLink={resolveLink} />
          </Text>
        );
      }
      return (
        <Text
          variant={h.depth <= 2 ? 'titleLargeEmphasized' : 'titleMediumEmphasized'}
          accessibilityRole="header"
          selectable
          style={{ marginTop: h.depth <= 2 ? 32 : 26, marginBottom: 2 }}
        >
          <Inline tokens={h.tokens} resolveLink={resolveLink} />
        </Text>
      );
    }
    case 'paragraph': {
      const inline = (t as Tokens.Paragraph).tokens ?? [];
      const images = (inline.filter((x) => x.type === 'image') as Tokens.Image[])
        .map((img) => ({ uri: readerImageUrl(img.href, baseUrl), alt: img.text?.trim() || null, title: img.title?.trim() || null }))
        .filter((img): img is { uri: string; alt: string | null; title: string | null } => !!img.uri);
      const figures = images.map((img, i) => (
        <ReaderImage
          key={img.uri}
          uri={img.uri}
          alt={img.alt}
          caption={i === images.length - 1 ? (caption ?? img.title ?? img.alt) : (img.title ?? img.alt)}
          corner={compact ? 16 : 24}
          style={compact ? { marginTop: 10 } : undefined}
        />
      ));
      if (isImageOnly(inline)) return <>{figures}</>;
      return (
        <>
          <Paragraph tokens={inline} resolveLink={resolveLink} />
          {figures}
        </>
      );
    }
    case 'blockquote':
      return <QuoteBlock q={t as Tokens.Blockquote} resolveLink={resolveLink} />;
    case 'table':
      return <TableBlock t={t as Tokens.Table} resolveLink={resolveLink} />;
    case 'html':
      return <HtmlBlock html={(t as Tokens.HTML).text} />;
    case 'list':
      return <ReaderList list={t as Tokens.List} resolveLink={resolveLink} />;
    case 'code':
      return (
        <View style={{ marginTop: compact ? 8 : 16 }}>
          <CodeBlock code={(t as Tokens.Code).text} lang={(t as Tokens.Code).lang} />
        </View>
      );
    case 'hr':
      return <View style={{ height: 1, backgroundColor: colors.outlineVariant, marginVertical: compact ? 12 : 28, marginHorizontal: compact ? 0 : 48 }} />;
    default:
      return null;
  }
}

/** Bulleted / numbered list for articles, left-aligned, with nested lists indented. */
function ReaderList({ list, resolveLink, level = 0 }: { list: Tokens.List; resolveLink?: (title: string) => string | undefined; level?: number }) {
  const { compact } = use(ReadingContext);
  const textStyle = compact ? undefined : { fontSize: 17, lineHeight: 27 };
  const variant = compact ? 'bodyMedium' : 'bodyLarge';
  return (
    <View style={{ gap: compact ? 4 : 8, marginTop: level ? 6 : compact ? 8 : 18, paddingLeft: level ? 18 : 2 }}>
      {list.items.map((it, i) => {
        const nested = it.tokens.filter((x) => x.type === 'list') as Tokens.List[];
        const text = it.tokens.filter((x) => x.type !== 'list' && x.type !== 'space');
        return (
          <View key={i}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Text variant={variant} color="primary" style={[textStyle, { fontWeight: '700', minWidth: list.ordered ? 22 : 10 }]}>
                {it.task ? (it.checked ? '☑' : '☐') : list.ordered ? `${Number(list.start || 1) + i}.` : '•'}
              </Text>
              <Text variant={variant} selectable style={[textStyle, { flex: 1 }]}>
                {text.map((x, k) => (
                  <Fragment key={k}>
                    {k > 0 ? '\n' : null}
                    <Inline tokens={'tokens' in x && x.tokens ? x.tokens : [x]} resolveLink={resolveLink} />
                  </Fragment>
                ))}
              </Text>
            </View>
            {nested.map((n, k) => (
              <ReaderList key={k} list={n} resolveLink={resolveLink} level={level + 1} />
            ))}
          </View>
        );
      })}
    </View>
  );
}

function Paragraph({ tokens, resolveLink }: { tokens: Token[]; resolveLink?: (title: string) => string | undefined }) {
  const { reading, compact } = use(ReadingContext);
  if (compact) {
    return (
      <Text variant="bodyMedium" selectable style={{ marginTop: 8, lineHeight: 21 }}>
        <Inline tokens={tokens} resolveLink={resolveLink} />
      </Text>
    );
  }
  return (
    <Text
      variant="bodyLarge"
      selectable={reading}
      {...(reading ? justifyProps : null)}
      style={reading ? [{ marginTop: 18, fontSize: 17, lineHeight: 28 }, JUSTIFIED] : { marginTop: 16 }}
    >
      <Inline tokens={tokens} resolveLink={resolveLink} />
    </Text>
  );
}

function Inline({ tokens, resolveLink }: { tokens?: Token[]; resolveLink?: (title: string) => string | undefined }) {
  const { colors } = useAppTheme();
  const { onOpenLink, baseUrl, reading } = use(ReadingContext);
  if (!tokens) return null;
  return (
    <>
      {tokens.map((t, i) => {
        switch (t.type) {
          case 'strong':
            return (
              <Text key={i} style={{ fontWeight: '700' }}>
                <Inline tokens={(t as Tokens.Strong).tokens} resolveLink={resolveLink} />
              </Text>
            );
          case 'em':
            return (
              <Text key={i} style={{ fontStyle: 'italic' }}>
                <Inline tokens={(t as Tokens.Em).tokens} resolveLink={resolveLink} />
              </Text>
            );
          case 'del':
            return (
              <Text key={i} style={{ textDecorationLine: 'line-through' }}>
                <Inline tokens={(t as Tokens.Del).tokens} resolveLink={resolveLink} />
              </Text>
            );
          case 'codespan':
            // A tonal chip behind the run (thin spaces pad it, nested Text has no padding).
            return (
              <Text
                key={i}
                style={{ fontFamily: MONO_FAMILY, fontSize: reading ? 15 : 14, color: colors.onSecondaryContainer, backgroundColor: colors.secondaryContainer }}
              >
                {`\u2009${(t as Tokens.Codespan).text}\u2009`}
              </Text>
            );
          case 'html': {
            const h = (t as Tokens.HTML).text;
            return /^<br\s*\/?>$/i.test(h.trim()) ? '\n' : '';
          }
          case 'link': {
            const l = t as Tokens.Link;
            const href = baseUrl ? (resolveUrl(l.href, baseUrl) ?? l.href) : l.href;
            const web = /^https?:\/\//i.test(href);
            return (
              <Text
                key={i}
                onPress={web && onOpenLink ? () => onOpenLink(href) : undefined}
                style={{ color: colors.primary, fontWeight: '700', textDecorationLine: 'underline' }}
              >
                {l.tokens?.length ? <Inline tokens={l.tokens} resolveLink={resolveLink} /> : l.text}
              </Text>
            );
          }
          case 'image':
            return null;
          case 'br':
            return '\n';
          case 'text':
          case 'escape': {
            const tt = t as Tokens.Text;
            if (tt.tokens?.length) return <Inline key={i} tokens={tt.tokens} resolveLink={resolveLink} />;
            return <WikiText key={i} text={tt.text} resolveLink={resolveLink} />;
          }
          default:
            return 'text' in t ? (t as { text: string }).text : '';
        }
      })}
    </>
  );
}

/** Plain text with [[Saved item]] links made tappable. */
function WikiText({ text, resolveLink }: { text: string; resolveLink?: (title: string) => string | undefined }) {
  const { colors } = useAppTheme();
  const parts = text.split(/(\[\[[^\]]+\]\])/g);
  return (
    <>
      {parts.map((p, i) => {
        const m = /^\[\[([^\]]+)\]\]$/.exec(p);
        if (!m) return p;
        const id = resolveLink?.(m[1].trim());
        return (
          <Text
            key={i}
            onPress={id ? () => router.push(`/item/${id}`) : undefined}
            style={{ color: colors.primary, fontWeight: '700' }}
            accessibilityRole={id ? 'link' : undefined}
          >
            {m[1]}
          </Text>
        );
      })}
    </>
  );
}

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const { colors } = useAppTheme();
  const [copied, setCopied] = useState(false);
  return (
    <View style={{ borderRadius: 20, overflow: 'hidden', backgroundColor: colors.surfaceContainer, marginTop: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 16, paddingRight: 6, paddingTop: 6 }}>
        <Text style={{ fontFamily: MONO_FAMILY, fontSize: 12, fontWeight: '700' }} color="onSurfaceVariant">
          {lang || 'code'}
        </Text>
        <PressableSurface
          kind="button"
          corner={18}
          onPress={() => {
            void Clipboard.setStringAsync(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          }}
          accessibilityLabel="Copy code"
          style={{ height: 36, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, backgroundColor: colors.surfaceContainerHighest }}
        >
          <Ico name={copied ? 'check' : 'contentCopy'} size={16} color={colors.onSecondaryContainer} />
          <Text variant="labelLarge" color="onSecondaryContainer" style={{ fontWeight: '700' }}>
            {copied ? 'Copied' : 'Copy'}
          </Text>
        </PressableSurface>
      </View>
      {/* Code keeps its lines: long ones scroll sideways instead of wrapping. */}
      <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingTop: 10 }}>
        <Text selectable style={{ fontFamily: MONO_FAMILY, fontSize: 13.5, lineHeight: 21, color: colors.onSurface }}>
          {code}
        </Text>
      </ScrollView>
    </View>
  );
}

/** Raw HTML the lexer passed through: its text only (tags dropped, <br> kept as breaks). */
const htmlText = (html: string) =>
  html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\/?(p|div|li|tr|h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();

function HtmlBlock({ html }: { html: string }) {
  const { reading, compact } = use(ReadingContext);
  const text = htmlText(html);
  if (!text) return null;
  return (
    <Text variant={compact ? 'bodyMedium' : 'bodyLarge'} selectable={reading} style={{ marginTop: compact ? 8 : reading ? 18 : 16 }}>
      {text}
    </Text>
  );
}

/**
 * Block quotes. A short single-paragraph quote is a pull-quote card; longer quoted passages sit
 * beside an accent bar and keep their own paragraphs, lists, code and nested quotes.
 */
function QuoteBlock({ q, resolveLink, nested = false }: { q: Tokens.Blockquote; resolveLink?: (title: string) => string | undefined; nested?: boolean }) {
  const { colors } = useAppTheme();
  const { reading, compact } = use(ReadingContext);
  const blocks = q.tokens.filter((b) => b.type !== 'space');
  const short = !nested && !compact && blocks.length === 1 && blocks[0].type === 'paragraph' && q.text.length <= 240;
  if (short) {
    return (
      <View style={{ borderRadius: 24, padding: 16, paddingHorizontal: 18, backgroundColor: colors.tertiaryContainer, marginTop: reading ? 20 : 8 }}>
        <Ico name="formatQuote" size={24} color={colors.onTertiaryContainer} />
        <Text variant="quote" color="onTertiaryContainer" selectable={reading} style={[{ marginTop: 4 }, reading && { fontSize: 18, lineHeight: 27 }]}>
          <Inline tokens={(blocks[0] as Tokens.Paragraph).tokens} resolveLink={resolveLink} />
        </Text>
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', gap: compact ? 10 : 14, marginTop: nested ? 10 : compact ? 8 : reading ? 20 : 12 }}>
      <View style={{ width: compact ? 3 : 4, borderRadius: 2, backgroundColor: compact ? colors.outline : colors.tertiary }} />
      <View style={{ flex: 1, paddingVertical: 2 }}>
        <QuoteBody blocks={blocks} resolveLink={resolveLink} />
      </View>
    </View>
  );
}

function QuoteBody({ blocks, resolveLink }: { blocks: Token[]; resolveLink?: (title: string) => string | undefined }) {
  const { reading, compact } = use(ReadingContext);
  const text = compact ? { fontSize: 14, lineHeight: 20 } : reading ? { fontSize: 17, lineHeight: 28 } : { fontSize: 16, lineHeight: 25 };
  return (
    <>
      {blocks.map((b, i) => {
        const gap = i ? (compact ? 6 : 12) : 0;
        switch (b.type) {
          case 'paragraph':
          case 'text':
            return (
              <Text key={i} variant="bodyLarge" color="onSurfaceVariant" selectable={reading} style={[text, { marginTop: gap, fontStyle: 'italic' }]}>
                <Inline tokens={(b as Tokens.Paragraph).tokens} resolveLink={resolveLink} />
              </Text>
            );
          case 'heading':
            return (
              <Text key={i} variant="titleMediumEmphasized" color="onSurfaceVariant" style={{ marginTop: gap }}>
                <Inline tokens={(b as Tokens.Heading).tokens} resolveLink={resolveLink} />
              </Text>
            );
          case 'list':
            return <ReaderList key={i} list={b as Tokens.List} resolveLink={resolveLink} level={1} />;
          case 'code':
            return (
              <View key={i} style={{ marginTop: gap || 4 }}>
                <CodeBlock code={(b as Tokens.Code).text} lang={(b as Tokens.Code).lang} />
              </View>
            );
          case 'blockquote':
            return <QuoteBlock key={i} q={b as Tokens.Blockquote} resolveLink={resolveLink} nested />;
          case 'table':
            return <TableBlock key={i} t={b as Tokens.Table} resolveLink={resolveLink} />;
          case 'html':
            return <HtmlBlock key={i} html={(b as Tokens.HTML).text} />;
          default:
            return null;
        }
      })}
    </>
  );
}

/** A GFM table: tonal header row, divided rows, column alignment, sideways scroll when wide. */
function TableBlock({ t, resolveLink }: { t: Tokens.Table; resolveLink?: (title: string) => string | undefined }) {
  const { colors } = useAppTheme();
  const { reading, compact } = use(ReadingContext);
  const [available, setAvailable] = useState(0);
  const base = useMemo(
    () =>
      tableColumnWidths([t.header, ...t.rows].map((r) => r.map((c) => plainOf(c.tokens) || c.text)), compact ? { charWidth: 7.6, max: 200 } : undefined),
    [t, compact],
  );
  const widths = fitColumns(base, Math.max(0, available - 2));
  const total = widths.reduce((a, b) => a + b, 0);
  if (!t.rows.length) return null;
  const cell = (c: Tokens.TableCell, k: number, header: boolean) => (
    <View key={k} style={{ width: widths[k], paddingHorizontal: 12, paddingVertical: compact ? 6 : 10, justifyContent: 'center' }}>
      <Text
        variant={header ? 'labelLargeEmphasized' : compact ? 'bodySmall' : 'bodyMedium'}
        selectable={reading}
        style={{ textAlign: t.align[k] ?? 'left', fontWeight: header ? '800' : undefined }}
      >
        <Inline tokens={c.tokens} resolveLink={resolveLink} />
      </Text>
    </View>
  );
  return (
    <View style={{ marginTop: compact ? 8 : reading ? 20 : 12 }} onLayout={(e) => setAvailable(Math.floor(e.nativeEvent.layout.width))}>
      <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={total + 2 > available}>
        <View style={{ width: total + 2, borderRadius: 16, borderWidth: 1, borderColor: colors.outlineVariant, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', backgroundColor: colors.surfaceContainerHigh }}>{t.header.map((c, k) => cell(c, k, true))}</View>
          {t.rows.map((r, i) => (
            <View
              key={i}
              style={{
                flexDirection: 'row',
                backgroundColor: i % 2 ? colors.surfaceContainerLow : colors.surface,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.outlineVariant,
              }}
            >
              {r.map((c, k) => cell(c, k, false))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
