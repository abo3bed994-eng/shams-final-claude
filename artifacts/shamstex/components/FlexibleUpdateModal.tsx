import React, { useEffect, useState } from "react";
import { Linking, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Icon from "@/components/Icon";
import { APP_VERSION, isFlexibleUpdateAvailable } from "@/lib/version";
import { useApp } from "@/context/AppContext";

const DISMISS_KEY = "shams_flexible_update_dismissed_at";
const DISMISS_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

export default function FlexibleUpdateModal() {
  const { settings } = useApp();
  const [visible, setVisible] = useState(false);

  const latestVersion = (settings as any)?.latestVersion;
  const updateUrl =
    (settings as any)?.updateUrl ||
    (Platform.OS === "ios"
      ? "https://apps.apple.com/app/id0000000000"
      : "https://play.google.com/store/apps/details?id=com.shamstex.app");

  useEffect(() => {
    let isMounted = true;

    async function evaluatePrompt() {
      if (!isFlexibleUpdateAvailable(latestVersion)) {
        if (isMounted) setVisible(false);
        return;
      }

      try {
        const lastDismissed = await AsyncStorage.getItem(DISMISS_KEY);
        if (lastDismissed) {
          const diff = Date.now() - parseInt(lastDismissed, 10);
          if (diff < DISMISS_COOLDOWN_MS) {
            return;
          }
        }
        if (isMounted) setVisible(true);
      } catch {
        if (isMounted) setVisible(true);
      }
    }

    evaluatePrompt();

    return () => {
      isMounted = false;
    };
  }, [latestVersion]);

  const handleDismiss = async () => {
    setVisible(false);
    try {
      await AsyncStorage.setItem(DISMISS_KEY, Date.now().toString());
    } catch {}
  };

  const handleUpdate = () => {
    Linking.openURL(updateUrl).catch(() => {});
  };

  if (!visible) return null;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={handleDismiss}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Icon name="sparkles" size={32} color="#D4AF37" />
          </View>
          <Text style={styles.title}>يتوفر تحديث جديد</Text>
          <Text style={styles.body}>
            يتوفر الإصدار ({latestVersion}) متضمناً تحسينات ومزايا جديدة. يمكنك التحديث الآن أو الاستمرار في التسوق والتحديث لاحقاً.
          </Text>

          <View style={styles.buttonRow}>
            <Pressable
              onPress={handleUpdate}
              style={({ pressed }) => [styles.btnPrimary, pressed && { opacity: 0.85 }]}
            >
              <Icon name="download" size={16} color="#0A0A0A" />
              <Text style={styles.btnPrimaryText}>تحديث الآن</Text>
            </Pressable>

            <Pressable
              onPress={handleDismiss}
              style={({ pressed }) => [styles.btnSecondary, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.btnSecondaryText}>لاحقاً</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#141414",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "#D4AF37",
    alignItems: "center",
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#D4AF3722",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  title: {
    color: "#D4AF37",
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    marginBottom: 10,
    textAlign: "center",
  },
  body: {
    color: "#DDD",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: "row-reverse",
    gap: 12,
    width: "100%",
  },
  btnPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#D4AF37",
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnPrimaryText: {
    color: "#0A0A0A",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  btnSecondary: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: "#222",
    alignItems: "center",
    justifyContent: "center",
  },
  btnSecondaryText: {
    color: "#AAA",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
