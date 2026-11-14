const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Signs release builds with the Stash release key when its properties are set, usually in
 * ~/.gradle/gradle.properties (never in the repo):
 *
 *   STASH_UPLOAD_STORE_FILE=/absolute/path/stash-release.jks
 *   STASH_UPLOAD_STORE_PASSWORD=…
 *   STASH_UPLOAD_KEY_ALIAS=stash
 *   STASH_UPLOAD_KEY_PASSWORD=…
 *
 * Without them, release builds fall back to the debug key (as the Expo template does).
 */
const MARK = '// stash-release-signing';

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (src.includes(MARK)) return cfg;

    src = src.replace(
      /signingConfigs \{\n/,
      `signingConfigs {
        ${MARK}
        release {
            if (project.hasProperty('STASH_UPLOAD_STORE_FILE')) {
                storeFile file(STASH_UPLOAD_STORE_FILE)
                storePassword STASH_UPLOAD_STORE_PASSWORD
                keyAlias STASH_UPLOAD_KEY_ALIAS
                keyPassword STASH_UPLOAD_KEY_PASSWORD
            }
        }
`,
    );

    // Only the release build type: its signingConfig line follows the template's comment.
    src = src.replace(
      /(release \{\n\s*\/\/ Caution![^\n]*\n\s*\/\/ see[^\n]*\n\s*)signingConfig signingConfigs\.debug/,
      "$1signingConfig project.hasProperty('STASH_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug",
    );

    cfg.modResults.contents = src;
    return cfg;
  });
};
