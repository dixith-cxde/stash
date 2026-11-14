import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

/** Dev: deep link `stash://dev/tab?to=library` switches tabs (adb can't tap on this phone). */
export default function DevTab() {
  const { to = 'library' } = useLocalSearchParams<{ to?: string }>();
  useEffect(() => {
    // Not cleared on unmount: dismissing unmounts this screen.
    setTimeout(() => router.dismissTo(`/${to}` as never), 300);
  }, [to]);
  return null;
}
