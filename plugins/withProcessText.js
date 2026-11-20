// "Save to Stash" in the text-selection toolbar is declared by modules/expressive
// (ProcessTextActivity), which forwards the text to MainActivity in Stash's own task.
// This plugin only removes the PROCESS_TEXT filter that older versions put on MainActivity:
// apps start that action for a result, which put MainActivity in the caller's task and lost
// the text, and a second filter would show the menu entry twice.
const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

const ACTION = 'android.intent.action.PROCESS_TEXT';

module.exports = function withProcessText(config) {
  return withAndroidManifest(config, (cfg) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(cfg.modResults);
    activity['intent-filter'] = (activity['intent-filter'] ?? []).filter(
      (f) => !f.action?.some((a) => a.$['android:name'] === ACTION),
    );
    return cfg;
  });
};
