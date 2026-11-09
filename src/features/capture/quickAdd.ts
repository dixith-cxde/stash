import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';

import { useCapture } from '@/state/capture';

import { type CaptureDraft, normalizeShare } from './normalize';
import { type SaveOptions, saveDraft } from './save';

/** Clipboard → capture screen (links become link drafts, anything else a note). */
export async function captureFromClipboard(): Promise<boolean> {
  const text = (await Clipboard.getStringAsync())?.trim();
  if (!text) return false;
  useCapture.getState().setDrafts(normalizeShare({ text }));
  router.push('/capture');
  return true;
}

export async function pickPdfs(opts: SaveOptions = {}): Promise<number> {
  const res = await DocumentPicker.getDocumentAsync({
    type: 'application/pdf',
    multiple: true,
    copyToCacheDirectory: true,
  });
  if (res.canceled) return 0;
  const drafts: CaptureDraft[] = res.assets.map((a) => ({
    kind: 'bookmark',
    type: 'pdf',
    title: a.name.replace(/\.pdf$/i, ''),
    file: { path: a.uri, fileName: a.name, mimeType: a.mimeType ?? 'application/pdf', size: a.size ?? null },
  }));
  for (const d of drafts) await saveDraft(d, opts);
  return drafts.length;
}

export async function pickImages(opts: SaveOptions = {}): Promise<number> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    quality: 1,
  });
  if (res.canceled) return 0;
  for (const a of res.assets) {
    await saveDraft(
      {
        kind: 'bookmark',
        type: 'image',
        title: a.fileName?.replace(/\.[a-z0-9]+$/i, '') ?? 'Image',
        file: { path: a.uri, fileName: a.fileName, mimeType: a.mimeType ?? 'image/jpeg', size: a.fileSize ?? null },
      },
      opts,
    );
  }
  return res.assets.length;
}
