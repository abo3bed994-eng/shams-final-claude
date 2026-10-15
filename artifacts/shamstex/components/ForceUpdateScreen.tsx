import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Icon from "@/components/Icon";
import { APP_VERSION, normalizeVersion } from "@/lib/version";
import { useApp, AppSettings } from "@/context/AppContext";
import { FS } from "@/lib/firebase";

export interface ForceUpdateScreenProps {
  preview?: boolean;
  onClosePreview?: () => void;
  draftSettings?: Partial<AppSettings>;
}

export default function ForceUpdateScreen({
  preview = false,
  onClosePreview,
  draftSettings,
}: ForceUpdateScreenProps = {}) {
  const { settings, setSettings } = useApp();
  const [checking, setChecking] = useState(false);

  const activeSettings = preview && draftSettings ? { ...settings, ...draftSettings } : settings;

  const updateUrl =
    (activeSettings as any)?.updateUrl?.trim() ||
    (Platform.OS === "ios"
      ? "https://apps.apple.com/app/id0000000000"
      : "https://play.google.com/store/apps/details?id=com.shamstex.app");

  const rawMinVersion = (activeSettings as any)?.minVersion;
  const minVersion = rawMinVersion ? normalizeVersion(rawMinVersion) : "—";
  const title = (activeSettings as any)?.updateTitle?.trim() || "تحديث إجباري مطلوب";
  const message =
    (activeSettings as any)?.updateMessage?.trim() ||
    "هذا الإصدار من التطبيق قديم ولا يدعم آخر التحديثات.\nيجب تحديث التطبيق إلى أحدث نسخة للاستمرار في الاستخدام.";

  const openStore = () => {
    Linking.openURL(updateUrl).catch(() => {});
  };

  const handleCheckAgain = async () => {
    if (preview) {
      Alert.alert("معاينة", "هذه معاينة تجريبية، في التطبيق الفعلي يتم إعادة فحص إعدادات الخادم فوراً.");
      return;
    }
    setChecking(true);
    try {
      const fresh = await FS.getSettings();
      if (fresh) {
        setSettings(fresh);
      }
    } catch {}
    finally {
      setChecking(false);
    }
  };

  const content = (
    <View style={styles.root}>
      <View style={styles.card}>
        {preview ? (
          <View style={styles.previewBadge}>
            <Icon name="eye" size={14} color="#D4AF37" />
            <Text style={styles.previewBadgeText}>معاينة لشاشات العملاء</Text>
          </View>
        ) : null}

        <View style={styles.iconWrap}>
          <Icon name="refresh-cw" size={48} color="#D4AF37" />
        </View>

        <Text style={styles.title}>{title}</Text>

        <Text style={styles.body}>{message}</Text>

        <View style={styles.versionBox}>
          <Text style={styles.versionLabel}>نسختك الحالية</Text>
          <Text style={styles.versionValue}>{APP_VERSION}</Text>
          <View style={styles.divider} />
          <Text style={styles.versionLabel}>الحد الأدنى المطلوب</Text>
          <Text style={[styles.versionValue, { color: "#D4AF37" }]}>{minVersion}</Text>
        </View>

        <Pressable
          style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
          onPress={openStore}
        >
          <Icon name="download" size={20} color="#0A0A0A" />
          <Text style={styles.btnText}>تحديث الآن من المتجر</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.btnSecondary, pressed && { opacity: 0.7 }]}
          onPress={handleCheckAgain}
          disabled={checking}
        >
          {checking ? (
            <ActivityIndicator size="small" color="#D4AF37" />
          ) : (
            <>
              <Icon name="rotate-cw" size={16} color="#D4AF37" />
              <Text style={styles.btnSecondaryText}>التحقق مرة أخرى</Text>
            </>
          )}
        </Pressable>

        {preview && onClosePreview ? (
          <Pressable
            style={({ pressed }) => [styles.closePreviewBtn, pressed && { opacity: 0.7 }]}
            onPress={onClosePreview}
          >
            <Text style={styles.closePreviewBtnText}>إغلاق المعاينة</Text>
          </Pressable>
        ) : null}


      </View>
    </View>
  );

  if (preview) {
    return (
      <Modal visible transparent animationType="fade" onRequestClose={onClosePreview}>
        <View style={styles.modalBackdrop}>{content}</View>
      </Modal>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
  },
  root: {
    flex: 1,
    backgroundColor: "#0A0A0A",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#0F0F0F",
    borderRadius: 24,
    padding: 28,
    borderWidth: 1,
    borderColor: "#D4AF37",
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
    marginBottom: 16,
  },
  previewBadgeText: {
    color: "#D4AF37",
    fontSize: 12,
    fontFamily: "Cairo_600SemiBold",
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#D4AF3722",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    color: "#D4AF37",
    fontSize: 22,
    fontFamily: "Cairo_700Bold",
    marginBottom: 12,
    textAlign: "center",
  },
  body: {
    color: "#CCC",
    fontSize: 13,
    fontFamily: "Cairo_400Regular",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
  },
  versionBox: {
    width: "100%",
    backgroundColor: "#1A1A1A",
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  versionLabel: {
    color: "#888",
    fontSize: 12,
    fontFamily: "Cairo_400Regular",
    textAlign: "center",
  },
  versionValue: {
    color: "#FFF",
    fontSize: 18,
    fontFamily: "Cairo_600SemiBold",
    textAlign: "center",
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: "#2A2A2A",
    marginVertical: 12,
  },
  btn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#D4AF37",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    width: "100%",
    marginBottom: 10,
  },
  btnText: {
    color: "#0A0A0A",
    fontSize: 15,
    fontFamily: "Cairo_700Bold",
  },
  btnSecondary: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    width: "100%",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D4AF3755",
    backgroundColor: "#D4AF3711",
  },
  btnSecondaryText: {
    color: "#D4AF37",
    fontSize: 13,
    fontFamily: "Cairo_600SemiBold",
  },
  closePreviewBtn: {
    marginTop: 14,
    paddingVertical: 8,
  },
  closePreviewBtnText: {
    color: "#888",
    fontSize: 13,
    fontFamily: "Cairo_400Regular",
  },
});
