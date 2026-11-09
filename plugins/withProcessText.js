// Adds an ACTION_PROCESS_TEXT intent filter to MainActivity so "Save to Stash" appears in the
// text-selection toolbar of every app. The selected text is read by modules/expressive
// (ProcessText) from Intent.EXTRA_PROCESS_TEXT.
const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

const ACTION = 'android.intent.action.PROCESS_TEXT';

module.exports = function withProcessText(config, { label = 'Save to Stash' } = {}) {
  return withAndroidManifest(config, (cfg) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(cfg.modResults);
    activity['intent-filter'] = (activity['intent-filter'] ?? []).filter(
      (f) => !f.action?.some((a) => a.$['android:name'] === ACTION),
    );
    activity['intent-filter'].push({
      $: { 'android:label': label },
      action: [{ $: { 'android:name': ACTION } }],
      category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
      data: [{ $: { 'android:mimeType': 'text/plain' } }],
    });
    return cfg;
  });
};
