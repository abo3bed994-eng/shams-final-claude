const { withAppBuildGradle } = require('@expo/config-plugins');

const withRecaptcha = (config) => {
  return withAppBuildGradle(config, (modConfig) => {
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
};

module.exports = withRecaptcha;
