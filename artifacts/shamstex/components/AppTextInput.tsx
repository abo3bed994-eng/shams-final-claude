import React, { forwardRef, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";

export interface AppTextInputProps extends TextInputProps {
  wrapperStyle?: ViewStyle;
}

const LAYOUT_KEYS = [
  "flex",
  "flexGrow",
  "flexShrink",
  "flexBasis",
  "alignSelf",
  "width",
  "minWidth",
  "maxWidth",
  "height",
  "minHeight",
  "maxHeight",
  "margin",
  "marginTop",
  "marginBottom",
  "marginLeft",
  "marginRight",
  "marginHorizontal",
  "marginVertical",
  "top",
  "bottom",
  "left",
  "right",
  "position",
  "zIndex",
] as const;

/**
 * AppTextInput wraps React Native's TextInput to solve an upstream React Native Android issue
 * (facebook/react-native#25594 / #16206) where native ReactEditText with textAlign="right" or "center"
 * intercepts touch events on ACTION_DOWN and fails to release them to parent ScrollViews on swipe.
 *
 * Solution:
 * On Android, while the input is unfocused, a transparent overlay handles touch gestures:
 * - A vertical swipe gesture naturally passes up the responder hierarchy to the parent ScrollView.
 * - A tap immediately focuses the TextInput, dismissing the overlay so typing works normally.
 * - When blurred (or when the keyboard is dismissed on scroll), the overlay re-engages.
 *
 * It also defaults multiline inputs to `scrollEnabled={false}` to prevent internal scroll trapping.
 */
export const AppTextInput = forwardRef<TextInput, AppTextInputProps>(
  function AppTextInput(
    {
      style,
      wrapperStyle,
      multiline,
      scrollEnabled,
      onFocus,
      onBlur,
      autoFocus,
      editable,
      ...props
    },
    ref
  ) {
    const internalRef = useRef<TextInput | null>(null);
    const [isFocused, setIsFocused] = useState<boolean>(Boolean(autoFocus));

    const setRef = (instance: TextInput | null) => {
      internalRef.current = instance;
      if (typeof ref === "function") {
        ref(instance);
      } else if (ref) {
        (ref as any).current = instance;
      }
    };

    const effectiveScrollEnabled = multiline ? (scrollEnabled ?? false) : scrollEnabled;

    const isArabic = (s?: any) => Boolean(s && typeof s === "string" && /[؀-ۿ]/.test(s));
    const hasValue = props.value !== undefined && props.value !== null && String(props.value).length > 0;

    if (Platform.OS !== "android") {
      const flat = (StyleSheet.flatten(style) || {}) as Record<string, any>;
      const iosStyle: Record<string, any> = { ...flat };

      // 1. Placeholder & Arabic text letterSpacing fix on iOS:
      // iOS CoreText applies letterSpacing (kerning) to placeholder attributed strings as well as typed text.
      // In Arabic cursive script, any letterSpacing > 0 disconnects connected ligatures into broken isolated glyphs.
      // - When the input has no typed value (placeholder is shown), enforce letterSpacing: 0.
      // - When typed value contains Arabic characters, enforce letterSpacing: 0.
      // - Preserve letterSpacing only when entering non-Arabic values (e.g. numeric PINs or OTP).
      if (!hasValue || isArabic(props.value)) {
        iosStyle.letterSpacing = 0;
      }

      // 2. Writing direction & RTL shaping fix on iOS:
      // When placeholder or value has Arabic, or textAlign is "right", ensure writingDirection: "rtl"
      // so iOS CoreText applies RTL shaping, keeping ligatures connected and trailing ellipsis "..." from breaking words.
      if (
        iosStyle.writingDirection === undefined &&
        (props.textAlign === "right" ||
          iosStyle.textAlign === "right" ||
          isArabic(props.placeholder) ||
          isArabic(props.value))
      ) {
        iosStyle.writingDirection = "rtl";
      }

      return (
        <TextInput
          ref={setRef}
          style={iosStyle}
          multiline={multiline}
          scrollEnabled={effectiveScrollEnabled}
          onFocus={onFocus}
          onBlur={onBlur}
          autoFocus={autoFocus}
          editable={editable}
          {...props}
        />
      );
    }

    const flat = (StyleSheet.flatten(style) || {}) as Record<string, any>;
    const wrapperLayout: Record<string, any> = {};
    const innerStyle: Record<string, any> = { ...flat };

    for (const key of LAYOUT_KEYS) {
      if (flat[key] !== undefined) {
        wrapperLayout[key] = flat[key];
        if (key.startsWith("margin")) {
          innerStyle[key] = 0;
        }
      }
    }

    if (wrapperLayout.flex !== undefined || wrapperLayout.width !== undefined) {
      innerStyle.width = "100%";
    }
    if (wrapperLayout.height !== undefined || flat.height === "100%") {
      innerStyle.height = "100%";
    }

    if (innerStyle.textAlignVertical === undefined && props.textAlignVertical === undefined) {
      innerStyle.textAlignVertical = "center";
    }
    if (innerStyle.includeFontPadding === undefined) {
      innerStyle.includeFontPadding = false;
    }
    if (!hasValue || isArabic(props.value)) {
      innerStyle.letterSpacing = 0;
    }

    return (
      <View style={[styles.wrapper, wrapperLayout, wrapperStyle]}>
        <TextInput
          ref={setRef}
          style={innerStyle}
          multiline={multiline}
          scrollEnabled={effectiveScrollEnabled}
          autoFocus={autoFocus}
          editable={editable}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          {...props}
        />
        {!isFocused && editable !== false && (
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              internalRef.current?.focus();
            }}
          />
        )}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  wrapper: {
    position: "relative",
    justifyContent: "center",
  },
});

export default AppTextInput;
