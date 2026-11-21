const { withAppBuildGradle, withPodfile } = require('@expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

const withRecaptcha = (config) => {
  // 1. Android
  config = withAppBuildGradle(config, (modConfig) => {
    const buildGradle = modConfig.modResults.contents;
    const dependency = "implementation 'com.google.android.recaptcha:recaptcha:18.5.1'";

    if (!buildGradle.includes(dependency)) {
      const dependenciesRegex = /dependencies\s*\{/;
      if (dependenciesRegex.test(buildGradle)) {
        modConfig.modResults.contents = buildGradle.replace(
          dependenciesRegex,
          `dependencies {\n    ${dependency}`
        );
      } else {
        modConfig.modResults.contents += `\ndependencies {\n    ${dependency}\n}\n`;
      }
    }

    return modConfig;
  });

  // 2. iOS
  config = withPodfile(config, (modConfig) => {
    const podfile = modConfig.modResults.contents;
    const podDependency = "pod 'RecaptchaEnterprise'";

    if (!podfile.includes('RecaptchaEnterprise')) {
      try {
        const result = mergeContents({
          tag: 'recaptcha-enterprise-ios',
          src: podfile,
          newSrc: `  ${podDependency}`,
          anchor: /use_native_modules!/,
          offset: 1,
          comment: '#',
        });
        if (result.didMerge) {
          modConfig.modResults.contents = result.contents;
        }
      } catch (e) {
        if (podfile.includes('use_native_modules!')) {
          modConfig.modResults.contents = podfile.replace(
            /use_native_modules!.*\n/,
            (match) => `${match}  ${podDependency}\n`
          );
        }
      }
    }

    return modConfig;
  });

  return config;
};

module.exports = withRecaptcha;
