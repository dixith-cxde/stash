import { Column, IconButton, OutlinedTextField, Text, TextField, useNativeState } from '@expo/ui/jetpack-compose';
import { fillMaxSize, fillMaxWidth, padding, verticalScroll, weight } from '@expo/ui/jetpack-compose/modifiers';
import { router } from 'expo-router';
import { useState } from 'react';

import { Ico } from '@/components/Ico';
import { TopBar } from '@/components/TopBar';
import { saveDraft } from '@/features/capture/save';
import { AppHost, useColors } from '@/theme/AppTheme';

/** New text note. Existing notes are edited inline on the item screen. */
export default function NoteScreen() {
  const colors = useColors();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const titleState = useNativeState('');

  const save = async () => {
    const content = body.trim();
    if (!content && !title.trim()) return router.back();
    const firstLine = content.split('\n')[0]?.slice(0, 80) ?? '';
    const { id } = await saveDraft({ kind: 'bookmark', type: 'text', title: title.trim() || firstLine || 'Note', content });
    router.replace({ pathname: '/item/[id]', params: { id } });
  };

  return (
    <AppHost style={{ flex: 1 }}>
      <Column modifiers={[fillMaxSize()]}>
        <TopBar
          title="New note"
          actions={
            <IconButton onClick={() => void save()}>
              <Ico name="check" label="Save" tint={colors.primary} />
            </IconButton>
          }
        />
        <Column modifiers={[weight(1), verticalScroll(), padding(16, 0, 16, 24)]} verticalArrangement={{ spacedBy: 12 }}>
          <TextField
            value={titleState}
            singleLine
            onValueChange={setTitle}
            textStyle={{ fontSize: 26, fontWeight: '700' }}
            colors={{ focusedContainerColor: 'transparent', unfocusedContainerColor: 'transparent' }}
            modifiers={[fillMaxWidth()]}>
            <TextField.Placeholder>
              <Text style={{ fontSize: 26, fontWeight: '700' }}>Title</Text>
            </TextField.Placeholder>
          </TextField>
          <OutlinedTextField autoFocus onValueChange={setBody} minLines={12} modifiers={[fillMaxWidth()]}>
            <OutlinedTextField.Placeholder>
              <Text>Write something worth keeping…</Text>
            </OutlinedTextField.Placeholder>
          </OutlinedTextField>
        </Column>
      </Column>
    </AppHost>
  );
}
