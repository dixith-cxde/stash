import {
  Button,
  Column,
  HorizontalFloatingToolbar,
  IconButton,
  LinearWavyProgressIndicator,
  ModalBottomSheet,
  type ModalBottomSheetRef,
  OutlinedTextField,
  Row,
  Text,
  useNativeState,
} from '@expo/ui/jetpack-compose';
import { fillMaxWidth, padding, verticalScroll } from '@expo/ui/jetpack-compose/modifiers';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Pdf, { type PdfRef } from 'react-native-pdf';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HighlightCard } from '@/components/HighlightCard';
import { Ico } from '@/components/Ico';
import { TopBar } from '@/components/TopBar';
import { useDbQuery } from '@/db/hooks';
import { createHighlight, getBookmark, queryHighlights, updateBookmark } from '@/db/repo';
import { AppHost, useColors } from '@/theme/AppTheme';

function AddHighlightSheet({ page, onDismiss, onSave }: { page: number; onDismiss: () => void; onSave: (text: string, note: string) => void }) {
  const ref = useRef<ModalBottomSheetRef>(null);
  const textState = useNativeState('');
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const colors = useColors();

  useEffect(() => {
    // Prefill from the clipboard: copy text in the PDF (or elsewhere), then tap Highlight.
    void Clipboard.getStringAsync().then((c) => {
      if (c?.trim()) {
        textState.set(c.trim());
        setText(c.trim());
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ModalBottomSheet ref={ref} onDismissRequest={onDismiss} skipPartiallyExpanded>
      <Column modifiers={[padding(24, 0, 24, 24)]} verticalArrangement={{ spacedBy: 16 }}>
        <Text style={{ typography: 'headlineSmall', fontWeight: '600' }}>{`Highlight on page ${page}`}</Text>
        <OutlinedTextField value={textState} onValueChange={setText} minLines={3} maxLines={8} modifiers={[fillMaxWidth()]}>
          <OutlinedTextField.Label>
            <Text>Passage</Text>
          </OutlinedTextField.Label>
        </OutlinedTextField>
        <OutlinedTextField onValueChange={setNote} minLines={1} modifiers={[fillMaxWidth()]}>
          <OutlinedTextField.Label>
            <Text>Note (optional)</Text>
          </OutlinedTextField.Label>
        </OutlinedTextField>
        <Text color={colors.onSurfaceVariant} style={{ typography: 'bodySmall' }}>
          Tip: copy text from the page first and it will be filled in here.
        </Text>
        <Row modifiers={[fillMaxWidth()]} horizontalArrangement="end">
          <Button
            enabled={!!text.trim()}
            onClick={async () => {
              onSave(text.trim(), note.trim());
              await ref.current?.hide();
              onDismiss();
            }}>
            <Text>Save highlight</Text>
          </Button>
        </Row>
      </Column>
    </ModalBottomSheet>
  );
}

function HighlightsSheet({ bookmarkId, onDismiss, onJump }: { bookmarkId: string; onDismiss: () => void; onJump: (page: number) => void }) {
  const { data } = useDbQuery(() => queryHighlights({ bookmarkId }), [bookmarkId], []);
  return (
    <ModalBottomSheet onDismissRequest={onDismiss}>
      <Column modifiers={[padding(0, 0, 0, 24), verticalScroll()]}>
        <Text style={{ typography: 'headlineSmall', fontWeight: '600' }} modifiers={[padding(24, 0, 24, 12)]}>
          {`Highlights · ${data.length}`}
        </Text>
        {data.map((h) => (
          <Column key={h.id}>
            <HighlightCard highlight={h} />
            {h.page != null ? (
              <Row modifiers={[padding(24, 0, 24, 8)]}>
                <Button onClick={() => onJump(h.page! + 1)}>
                  <Text>{`Go to page ${h.page + 1}`}</Text>
                </Button>
              </Row>
            ) : null}
          </Column>
        ))}
      </Column>
    </ModalBottomSheet>
  );
}

export default function PdfScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const pdfRef = useRef<PdfRef>(null);
  const { data: item } = useDbQuery(() => getBookmark(id), [id], null);
  const { data: highlights } = useDbQuery(() => queryHighlights({ bookmarkId: id }), [id], []);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [sheet, setSheet] = useState<'add' | 'list' | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (item && !item.readAt) void updateBookmark(item.id, { readAt: new Date() });
  }, [item]);

  return (
    <View style={[styles.root, { backgroundColor: colors.surfaceContainer }]}>
      <AppHost matchContents={{ vertical: true }} style={styles.bar}>
        <Column>
          <TopBar
            title={item?.title ?? ''}
            actions={
              <IconButton onClick={() => router.push({ pathname: '/item/[id]', params: { id } })}>
                <Ico name="moreVert" label="Details" />
              </IconButton>
            }
          />
          <LinearWavyProgressIndicator progress={pages ? page / pages : 0} modifiers={[fillMaxWidth()]} />
        </Column>
      </AppHost>

      {item?.filePath && !failed ? (
        <Pdf
          ref={pdfRef}
          source={{ uri: item.filePath }}
          style={styles.pdf}
          spacing={12}
          fitPolicy={0}
          enableAntialiasing
          onLoadComplete={(n) => setPages(n)}
          onPageChanged={(p, n) => {
            setPage(p);
            setPages(n);
          }}
          onError={(e) => {
            console.warn('[pdf]', e);
            setFailed(true);
          }}
        />
      ) : (
        <View style={styles.pdf} />
      )}

      <AppHost matchContents style={[styles.toolbar, { bottom: insets.bottom + 16 }]}>
        <HorizontalFloatingToolbar>
          <IconButton enabled={page > 1} onClick={() => pdfRef.current?.setPage(page - 1)}>
            <Ico name="arrowBack" label="Previous page" />
          </IconButton>
          <Text style={{ typography: 'labelLarge', fontWeight: '700' }} modifiers={[padding(4, 0, 4, 0)]}>
            {pages ? `${page} / ${pages}` : '…'}
          </Text>
          <IconButton enabled={page < pages} onClick={() => pdfRef.current?.setPage(page + 1)}>
            <Ico name="chevronRight" label="Next page" />
          </IconButton>
          <IconButton onClick={() => setSheet('list')}>
            <Ico name={highlights.length ? 'inkHighlighterFill' : 'inkHighlighter'} label="Highlights" />
          </IconButton>
          <HorizontalFloatingToolbar.FloatingActionButton onPress={() => setSheet('add')}>
            <Ico name="formatQuote" label="Add highlight" />
          </HorizontalFloatingToolbar.FloatingActionButton>
        </HorizontalFloatingToolbar>
        {sheet === 'add' ? (
          <AddHighlightSheet
            page={page}
            onDismiss={() => setSheet(null)}
            onSave={(text, note) =>
              void createHighlight({ text, note: note || undefined, bookmarkId: id, page: page - 1, sourceTitle: item?.title })
            }
          />
        ) : null}
        {sheet === 'list' ? (
          <HighlightsSheet
            bookmarkId={id}
            onDismiss={() => setSheet(null)}
            onJump={(p) => {
              setSheet(null);
              pdfRef.current?.setPage(p);
            }}
          />
        ) : null}
      </AppHost>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bar: { width: '100%' },
  pdf: { flex: 1, backgroundColor: 'transparent' },
  toolbar: { position: 'absolute', alignSelf: 'center' },
});
