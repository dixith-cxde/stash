import { useDbQuery } from '@/db/hooks';
import { listTags, siteHistory } from '@/db/repo';
import { hostOf } from '@/features/capture/normalize';

import { type SuggestInput, suggestFolder, suggestTags, type TagStat } from './suggest';

export type Suggestions = { tags: TagStat[]; folderId: string | null };

const NONE: Suggestions = { tags: [], folderId: null };

/** Live tag + folder suggestions for an item (or a draft that is not saved yet). */
export function useSuggestions(input: SuggestInput & { id?: string }, exclude: string[] = [], limit = 5): Suggestions {
  const host = input.url ? hostOf(input.url) : '';
  const { data } = useDbQuery(
    async () => {
      const [tags, history] = await Promise.all([
        listTags(),
        host ? siteHistory(host, input.id) : Promise.resolve({ tagCounts: new Map(), folderCounts: new Map() }),
      ]);
      return {
        tags: suggestTags(input, tags, history.tagCounts, exclude, limit),
        folderId: suggestFolder(history.folderCounts),
      };
    },
    [input.id, input.title, input.description, input.url, host, exclude.join(','), limit],
    NONE,
  );
  return data;
}
