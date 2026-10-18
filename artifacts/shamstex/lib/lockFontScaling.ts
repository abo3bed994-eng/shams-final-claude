import React from "react";
import * as ReactNative from "react-native";

const enforceProps = (type: any, props: any) => {
  let p = props ? { ...props } : {};
  p.allowFontScaling = false;
  p.maxFontSizeMultiplier = p.maxFontSizeMultiplier ?? 1;
  // If multiline TextInput on Android, disable internal scrolling by default so outer ScrollView scrolls smoothly
  if (p.multiline && p.scrollEnabled === undefined) {
    p.scrollEnabled = false;
  }
  return p;
};

const isTextTarget = (type: any): boolean => {
  if (!type) return false;
  if (type === ReactNative.Text || type === ReactNative.TextInput) return true;
  const name = typeof type === "function" ? (type.displayName || type.name) : "";
  return (
    name === "Text" ||
    name === "TextImpl" ||
    name === "TextInput" ||
    name === "NativeText" ||
    name === "NativeVirtualText"
  );
};

// 1. Monkey-patch React.createElement
const origCreateElement = React.createElement;
(React as any).createElement = function (type: any, props: any, ...children: any[]) {
  const p = isTextTarget(type) ? enforceProps(type, props) : props;
  return origCreateElement.call(this, type, p, ...children);
};

// 2. Monkey-patch react/jsx-runtime and react/jsx-dev-runtime if available
try {
  const jsxRuntime = require("react/jsx-runtime");
  if (jsxRuntime) {
    if (typeof jsxRuntime.jsx === "function") {
      const origJsx = jsxRuntime.jsx;
      jsxRuntime.jsx = function (type: any, props: any, key: any) {
        return origJsx(type, isTextTarget(type) ? enforceProps(type, props) : props, key);
      };
    }
    if (typeof jsxRuntime.jsxs === "function") {
      const origJsxs = jsxRuntime.jsxs;
      jsxRuntime.jsxs = function (type: any, props: any, key: any) {
        return origJsxs(type, isTextTarget(type) ? enforceProps(type, props) : props, key);
      };
    }
  }
} catch {
  // jsx-runtime might not be loaded yet or bundled
}

try {
  const jsxDevRuntime = require("react/jsx-dev-runtime");
  if (jsxDevRuntime && typeof jsxDevRuntime.jsxDEV === "function") {
    const origJsxDEV = jsxDevRuntime.jsxDEV;
    jsxDevRuntime.jsxDEV = function (type: any, props: any, key: any, isStatic: any, source: any, self: any) {
      return origJsxDEV(type, isTextTarget(type) ? enforceProps(type, props) : props, key, isStatic, source, self);
    };
  }
} catch {
  // jsx-dev-runtime
}

// 3. Monkey-patch ReactNative.Text and ReactNative.TextInput
try {
  const OrigText = ReactNative.Text;
  const OrigTextInput = ReactNative.TextInput;

  if (OrigText) {
    (OrigText as any).defaultProps = (OrigText as any).defaultProps || {};
    (OrigText as any).defaultProps.allowFontScaling = false;
    (OrigText as any).defaultProps.maxFontSizeMultiplier = 1;
  }
  if (OrigTextInput) {
    (OrigTextInput as any).defaultProps = (OrigTextInput as any).defaultProps || {};
    (OrigTextInput as any).defaultProps.allowFontScaling = false;
    (OrigTextInput as any).defaultProps.maxFontSizeMultiplier = 1;
  }
} catch {
  // ignore
}
