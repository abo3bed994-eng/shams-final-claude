import React, { useEffect, useState } from "react";
import { Linking, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Icon from "@/components/Icon";
import { APP_VERSION, isFlexibleUpdateAvailable, normalizeVersion } from "@/lib/version";
import { useApp, AppSettings } from "@/context/AppContext";

const DISMISS_PREFIX = "shams_flexible_update_dismissed_";
const DISMISS_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface FlexibleUpdateModalProps {
  preview?: boolean;
  visibleOverride?: boolean;
  onClosePreview?: () => void;
  draftSettings?: Partial<AppSettings>;
}

export default function FlexibleUpdateModal({
  preview = false,
  visibleOverride,
  onClosePreview,
  draftSettings,
}: FlexibleUpdateModalProps = {}) {
  const { settings } = useApp();
  const [visible, setVisible] = useState(false);

  // In preview mode, use draftSettings; otherwise use active app settings
  const activeSettings = preview && draftSettings ? { ...settings, ...draftSettings } : settings;

  const latestVersion = (activeSettings as any)?.latestVersion;
  const flexibleUpdateEnabled = (activeSettings as any)?.flexibleUpdateEnabled;
  const updateTitle = (activeSettings as any)?.updateTitle?.trim() || "يتوفر تحديث جديد للتطبيق";
  const updateMessage =
    (activeSettings as any)?.updateMessage?.trim() ||
    "يتوفر إصدار جديد يتضمن تحسينات ومزايا إضافية وتجربة تسوق أفضل. يمكنك التحديث الآن أو الاستمرار والتحديث لاحقاً.";

  const updateUrl =
    (activeSettings as any)?.updateUrl?.trim() ||
    (Platform.OS === "ios"
      ? "https://apps.apple.com/app/id0000000000"
      : "https://play.google.com/store/apps/details?id=com.shamstex.app");

  useEffect(() => {
    if (preview) {
      if (typeof visibleOverride === "boolean") {
        setVisible(visibleOverride);
      }
      return;
    }

    let isMounted = true;
    (async () => {
      const available = isFlexibleUpdateAvailable(latestVersion, flexibleUpdateEnabled, APP_VERSION);
      if (!available) {
        if (isMounted) setVisible(false);
        return;
      }

      // Fingerprint dismissal by version, title, and link so modifying the update prompts again
      const targetTag = normalizeVersion(latestVersion) || "general";
      const dismissKey = `${DISMISS_PREFIX}${targetTag}`;

      try {
        const raw = await AsyncStorage.getItem(dismissKey);
        if (raw) {
          const dismissedAt = parseInt(raw, 10);
          if (Date.now() - dismissedAt < DISMISS_COOLDOWN_MS) {
            if (isMounted) setVisible(false);
            return;
          }
        }
      } catch {}

      if (isMounted) setVisible(true);
    })();

    return () => {
      isMounted = false;
    };
  }, [preview, visibleOverride, latestVersion, flexibleUpdateEnabled]);

  const handleUpdate = () => {
    if (preview) {
      if (onClosePreview) onClosePreview();
      else setVisible(false);
      return;
    }
    Linking.openURL(updateUrl).catch(() => {});
    setVisible(false);
  };

  const handleDismiss = async () => {
    if (preview) {
      if (onClosePreview) onClosePreview();
      else setVisible(false);
      return;
    }
    const targetTag = normalizeVersion(latestVersion) || "general";
    const dismissKey = `${DISMISS_PREFIX}${targetTag}`;
    try {
      await AsyncStorage.setItem(dismissKey, String(Date.now()));
    } catch {}
    setVisible(false);
  };

  const isModalVisible = preview ? (visibleOverride ?? visible) : visible;
  if (!isModalVisible) return null;

  return (
    <Modal
      visible={isModalVisible}
      transparent
      animationType="fade"
      onRequestClose={handleDismiss}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {preview ? (
            <View style={styles.previewBadge}>
              <Icon name="eye" size={14} color="#D4AF37" />
              <Text style={styles.previewBadgeText}>معاينة لشاشات العملاء</Text>
            </View>
          ) : null}

          <View style={styles.iconWrap}>
            <Icon name="sparkles" size={32} color="#D4AF37" />
          </View>

          <Text style={styles.title}>{updateTitle}</Text>

          {latestVersion ? (
            <View style={styles.versionBadge}>
              <Text style={styles.versionBadgeText}>
                الإصدار الجديد: {normalizeVersion(latestVersion) || latestVersion}
              </Text>
            </View>
          ) : null}

          <Text style={styles.body}>{updateMessage}</Text>

          <Pressable
            style={({ pressed }) => [styles.btnPrimary, pressed && { opacity: 0.85 }]}
            onPress={handleUpdate}
          >
            <Icon name="download" size={18} color="#0A0A0A" />
            <Text style={styles.btnPrimaryText}>تحديث الآن</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.btnSecondary, pressed && { opacity: 0.7 }]}
            onPress={handleDismiss}
          >
            <Text style={styles.btnSecondaryText}>لاحقاً</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#111111",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#D4AF37",
    padding: 24,
    alignItems: "center",
  },
  previewBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#D4AF3722",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D4AF3755",
    marginBottom: 12,
  },
  previewBadgeText: {
    color: "#D4AF37",
    fontSize: 12,
    fontFamily: "Cairo_600SemiBold",
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#D4AF3722",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    color: "#D4AF37",
    fontSize: 18,
    fontFamily: "Cairo_700Bold",
    marginBottom: 8,
    textAlign: "center",
  },
  versionBadge: {
    backgroundColor: "#1A1A1A",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  versionBadgeText: {
    color: "#D4AF37",
    fontSize: 12,
    fontFamily: "Cairo_600SemiBold",
  },
  body: {
    color: "#DDD",
    fontSize: 13,
    fontFamily: "Cairo_400Regular",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
  },
  btnPrimary: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#D4AF37",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: "100%",
    marginBottom: 10,
  },
  btnPrimaryText: {
    color: "#0A0A0A",
    fontSize: 14,
    fontFamily: "Cairo_700Bold",
  },
  btnSecondary: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  btnSecondaryText: {
    color: "#AAA",
    fontSize: 13,
    fontFamily: "Cairo_600SemiBold",
  },
});
