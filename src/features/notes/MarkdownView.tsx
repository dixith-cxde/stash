import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { Lexer, type Token, type Tokens } from 'marked';
import { Image } from 'expo-image';
import { createContext, Fragment, use, useMemo, useState } from 'react';
import { View } from 'react-native';

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
  /** Long-form reading: larger body text and line height (feed articles). */
  reading?: boolean;
};

const ReadingContext = createContext<{ onOpenLink?: (url: string) => void; reading: boolean }>({ reading: false });

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
export function MarkdownView({ markdown, onToggleTask, resolveLink, onOpenLink, reading = false }: Props) {
  const tokens = useMemo(() => Lexer.lex(markdown, { gfm: true }), [markdown]);
  const ctx = useMemo(() => ({ onOpenLink, reading }), [onOpenLink, reading]);
  let task = 0;
  const nextTask = () => task++;

  return (
    <ReadingContext value={ctx}>
      <View>
        {tokens.map((t, i) => {
          const next = tokens.slice(i + 1).find((n) => n.type !== 'space');
          return (
            <Fragment key={i}>
              <Block t={t} next={next} nextTask={nextTask} onToggleTask={onToggleTask} resolveLink={resolveLink} />
            </Fragment>
          );
        })}
      </View>
    </ReadingContext>
  );
}

type BlockProps = {
  t: Token;
  next?: Token;
  nextTask: () => number;
  onToggleTask?: (i: number) => void;
  resolveLink?: (title: string) => string | undefined;
};

function Block({ t, next, nextTask, onToggleTask, resolveLink }: BlockProps) {
  const { colors } = useAppTheme();
  switch (t.type) {
    case 'heading': {
      const h = t as Tokens.Heading;
      const tasks = next?.type === 'list' ? (next as Tokens.List).items.filter((it) => it.task) : [];
      const done = tasks.filter((it) => it.checked).length;
      return (
        <View style={{ marginTop: 26, marginBottom: tasks.length ? 0 : 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <Text variant={h.depth <= 2 ? 'titleMediumEmphasized' : 'titleSmall'} accessibilityRole="header" style={{ flex: 1 }}>
              <Inline tokens={h.tokens} resolveLink={resolveLink} />
            </Text>
            {tasks.length > 0 && (
              <Text variant="labelMedium" color="onSurfaceVariant" style={{ fontWeight: '700' }}>
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
      return (
        <View style={{ borderRadius: 24, padding: 16, paddingHorizontal: 18, backgroundColor: colors.tertiaryContainer, marginTop: 4 }}>
          <Ico name="formatQuote" size={24} color={colors.onTertiaryContainer} />
          <Text variant="quote" color="onTertiaryContainer" style={{ marginTop: 4 }}>
            {(t as Tokens.Blockquote).tokens.map((b, i) =>
              'tokens' in b && b.tokens ? <Inline key={i} tokens={b.tokens} resolveLink={resolveLink} /> : 'text' in b ? b.text : '',
            )}
          </Text>
        </View>
      );
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

function Paragraph({ tokens, resolveLink }: { tokens: Token[]; resolveLink?: (title: string) => string | undefined }) {
  const { reading } = use(ReadingContext);
  return (
    <Text
      variant="bodyLarge"
      selectable={reading}
      style={reading ? { marginTop: 16, fontSize: 17, lineHeight: 28 } : { marginTop: 16 }}
    >
      <Inline tokens={tokens} resolveLink={resolveLink} />
    </Text>
  );
}

function Inline({ tokens, resolveLink }: { tokens?: Token[]; resolveLink?: (title: string) => string | undefined }) {
  const { colors } = useAppTheme();
  const { onOpenLink } = use(ReadingContext);
  if (!tokens) return null;
  return (
    <>
      {tokens.map((t, i) => {
        switch (t.type) {
          case 'strong':
            return (
              <Text key={i} style={{ fontWeight: '800' }}>
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
            return (
              <Text key={i} style={{ fontFamily: MONO_FAMILY, color: colors.tertiary, fontSize: 14 }}>
                {(t as Tokens.Codespan).text}
              </Text>
            );
          case 'link': {
            const l = t as Tokens.Link;
            const web = /^https?:\/\//i.test(l.href);
            return (
              <Text
                key={i}
                onPress={web && onOpenLink ? () => onOpenLink(l.href) : undefined}
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
          <Text variant="labelMedium" color="onSecondaryContainer" style={{ fontWeight: '700' }}>
            {copied ? 'Copied' : 'Copy'}
          </Text>
        </PressableSurface>
      </View>
      <Text selectable style={{ fontFamily: MONO_FAMILY, fontSize: 13.5, lineHeight: 21, color: colors.tertiary, padding: 16, paddingTop: 10 }}>
        {code}
      </Text>
    </View>
  );
}
