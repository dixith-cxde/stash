import { Text } from 'react-native';

import type { ColorRoles } from '@/theme/palette';

/**
 * Syntax tint for the Markdown editor (design: Editor artboard): markers dim, headings in
 * primary, quotes in tertiary, code in a warm accent, [[links]] in primary. Line-based and
 * cheap enough to run on every keystroke. Returns spans to place inside a TextInput.
 */
export function tintMarkdown(md: string, c: ColorRoles) {
  const marker = { color: c.outline };
  const out: React.ReactNode[] = [];
  let inFence = false;
  md.split('\n').forEach((line, i, all) => {
    const nl = i < all.length - 1 ? '\n' : '';
    const k = `l${i}`;
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      out.push(<Text key={k} style={marker}>{line + nl}</Text>);
      return;
    }
    if (inFence) {
      out.push(<Text key={k} style={{ color: c.tertiary }}>{line + nl}</Text>);
      return;
    }
    const heading = /^(#{1,6}\s)(.*)$/.exec(line);
    if (heading) {
      out.push(
        <Text key={k}>
          <Text style={marker}>{heading[1]}</Text>
          <Text style={{ color: c.primary, fontWeight: '700' }}>{inline(heading[2], c, k)}</Text>
          {nl}
        </Text>,
      );
      return;
    }
    const quote = /^(>\s?)(.*)$/.exec(line);
    if (quote) {
      out.push(
        <Text key={k}>
          <Text style={marker}>{quote[1]}</Text>
          <Text style={{ color: c.onTertiaryContainer }}>{inline(quote[2], c, k)}</Text>
          {nl}
        </Text>,
      );
      return;
    }
    const list = /^(\s*(?:[-*+]|\d+\.)\s(?:\[[ xX]\]\s)?)(.*)$/.exec(line);
    if (list) {
      out.push(
        <Text key={k}>
          <Text style={marker}>{list[1]}</Text>
          {inline(list[2], c, k)}
          {nl}
        </Text>,
      );
      return;
    }
    out.push(
      <Text key={k}>
        {inline(line, c, k)}
        {nl}
      </Text>,
    );
  });
  return out;
}

const INLINE = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*|_[^_\s][^_]*_|`[^`]+`|\[\[[^\]]+\]\])/g;

function inline(text: string, c: ColorRoles, key: string): React.ReactNode[] {
  const marker = { color: c.outline };
  return text.split(INLINE).map((part, i) => {
    const k = `${key}-${i}`;
    if (/^(\*\*|__).+\1$/.test(part)) {
      const m = part.slice(0, 2);
      return (
        <Text key={k}>
          <Text style={marker}>{m}</Text>
          <Text style={{ fontWeight: '700' }}>{part.slice(2, -2)}</Text>
          <Text style={marker}>{m}</Text>
        </Text>
      );
    }
    if (/^[*_].+[*_]$/.test(part) && part.length > 2) {
      return (
        <Text key={k}>
          <Text style={marker}>{part[0]}</Text>
          <Text style={{ fontStyle: 'italic' }}>{part.slice(1, -1)}</Text>
          <Text style={marker}>{part[0]}</Text>
        </Text>
      );
    }
    if (/^`.+`$/.test(part)) return <Text key={k} style={{ color: c.tertiary }}>{part}</Text>;
    if (/^\[\[.+\]\]$/.test(part)) {
      return (
        <Text key={k}>
          <Text style={marker}>[[</Text>
          <Text style={{ color: c.primary }}>{part.slice(2, -2)}</Text>
          <Text style={marker}>]]</Text>
        </Text>
      );
    }
    return part;
  });
}
