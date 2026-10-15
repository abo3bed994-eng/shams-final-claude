import React, { useState } from "react";
import { Alert, Platform, Pressable, Switch, Text, View } from "react-native";
import { Card, Field, SettingsScreen, useSettingsDraft } from "./_shared";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { useColors } from "@/hooks/useColors";
import { APP_VERSION, isValidVersion, normalizeVersion, compareVersions } from "@/lib/version";
import Icon from "@/components/Icon";
import FlexibleUpdateModal from "@/components/FlexibleUpdateModal";
import ForceUpdateScreen from "@/components/ForceUpdateScreen";

const DEFAULT_PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.shamstex.app";

export default function UpdateSettings() {
  useAdminGuard("manage_settings");
  const { colors, bottomPad, draft, setDraft, save, saving } = useSettingsDraft();

  const [showFlexiblePreview, setShowFlexiblePreview] = useState(false);
  const [showForcePreview, setShowForcePreview] = useState(false);

  const minVersionNorm = normalizeVersion(draft.minVersion);
  const latestVersionNorm = normalizeVersion(draft.latestVersion);

  const invalidMinVersion = draft.minVersion?.trim() !== "" && !isValidVersion(draft.minVersion);
  const invalidLatestVersion = draft.latestVersion?.trim() !== "" && !isValidVersion(draft.latestVersion);

  // Warning if minVersion is set higher than current APP_VERSION
  const minVersionExceedsCurrent =
    isValidVersion(draft.minVersion) &&
    draft.forceUpdateEnabled &&
    compareVersions(APP_VERSION, draft.minVersion) < 0;

  return (
    <SettingsScreen
      title="تحديثات التطبيق (إجباري واختياري)"
      bottomPad={bottomPad}
      save={save}
      saving={saving}
    >
      {/* Overview Info Banner */}
      <View
        style={{
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.gold + "55",
          borderRadius: 16,
          padding: 16,
          marginBottom: 16,
          flexDirection: "row-reverse",
          alignItems: "center",
          gap: 12,
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: colors.gold + "22",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="info" size={22} color={colors.gold} />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: colors.foreground,
              fontFamily: "Cairo_700Bold",
              fontSize: 14,
              textAlign: "right",
            }}
          >
            إصدار التطبيق الحالي: {APP_VERSION}
          </Text>
          <Text
            style={{
              color: colors.mutedForeground,
              fontFamily: "Cairo_400Regular",
              fontSize: 12,
              textAlign: "right",
              marginTop: 2,
            }}
          >
            يمكنك إرسال إشعار لطيف للعملاء بتوفر تحديث جديد (اختياري)، أو قفل التطبيق حتى التحديث (إجباري).
          </Text>
        </View>
      </View>

      {/* 1. Flexible (Optional) Update Card */}
      <Card title="✨ التحديث الاختياري (تنبيه لطيف للعملاء)">
        <View
          style={{
            flexDirection: "row-reverse",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: 8,
            marginBottom: 8,
          }}
        >
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text
              style={{
                color: colors.foreground,
                fontFamily: "Cairo_700Bold",
                fontSize: 14,
                textAlign: "right",
              }}
            >
              تفعيل تنبيه التحديث الاختياري
            </Text>
            <Text
              style={{
                color: colors.mutedForeground,
                fontFamily: "Cairo_400Regular",
                fontSize: 11,
                textAlign: "right",
                marginTop: 2,
              }}
            >
              تظهر رسالة منبثقة جميلة للعميل عند فتح التطبيق مع زر "تحديث الآن" وزر "لاحقاً".
            </Text>
          </View>
          <Switch
            value={draft.flexibleUpdateEnabled ?? false}
            onValueChange={(val) => setDraft((d) => ({ ...d, flexibleUpdateEnabled: val }))}
            trackColor={{ false: colors.border, true: colors.gold }}
            thumbColor={draft.flexibleUpdateEnabled ? "#0A0A0A" : "#888"}
          />
        </View>

        <Field
          label="رقم الإصدار الجديد المقترح (اختياري)"
          value={draft.latestVersion ?? ""}
          onChange={(v) => setDraft((d) => ({ ...d, latestVersion: v }))}
          placeholder="مثال: 1.2.0 (اتركه فارغاً للتنبيه دائماً)"
        />
        {invalidLatestVersion && (
          <Text
            style={{
              color: "#E74C3C",
              fontSize: 12,
              fontFamily: "Cairo_400Regular",
              textAlign: "right",
              marginTop: -6,
              marginBottom: 8,
            }}
          >
            صيغة رقم النسخة غير صحيحة (مثال صحيح: 1.2.0).
          </Text>
        )}

        <Field
          label="عنوان رسالة التحديث (اختياري)"
          value={draft.updateTitle ?? ""}
          onChange={(v) => setDraft((d) => ({ ...d, updateTitle: v }))}
          placeholder="يتوفر تحديث جديد للتطبيق"
        />

        <Field
          label="نص الرسالة / ما الجديد في التحديث (اختياري)"
          value={draft.updateMessage ?? ""}
          onChange={(v) => setDraft((d) => ({ ...d, updateMessage: v }))}
          placeholder="أضفنا مميزات جديدة وتحسينات سريعة وتجربة تسوق أفضل..."
        />

        <Field
          label="رابط التحديث على المتجر (Google Play / App Store)"
          value={draft.updateUrl ?? ""}
          onChange={(v) => setDraft((d) => ({ ...d, updateUrl: v }))}
          placeholder="https://play.google.com/store/apps/details?id=com.shamstex.app"
        />

        <View
          style={{
            flexDirection: "row-reverse",
            gap: 10,
            marginTop: 8,
            marginBottom: 4,
          }}
        >
          <Pressable
            onPress={() => setDraft((d) => ({ ...d, updateUrl: DEFAULT_PLAY_STORE_URL }))}
            style={({ pressed }) => ({
              backgroundColor: colors.input,
              borderWidth: 1,
              borderColor: colors.border,
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 8,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text
              style={{
                color: colors.gold,
                fontFamily: "Cairo_600SemiBold",
                fontSize: 12,
              }}
            >
              استخدام رابط Google Play الافتراضي
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setShowFlexiblePreview(true)}
            style={({ pressed }) => ({
              backgroundColor: colors.gold + "22",
              borderWidth: 1,
              borderColor: colors.gold,
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 8,
              flexDirection: "row-reverse",
              alignItems: "center",
              gap: 6,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Icon name="eye" size={14} color={colors.gold} />
            <Text
              style={{
                color: colors.gold,
                fontFamily: "Cairo_700Bold",
                fontSize: 12,
              }}
            >
              معاينة الرسالة الآن
            </Text>
          </Pressable>
        </View>
      </Card>

      {/* 2. Force Update Card */}
      <Card title="🛑 التحديث الإجباري (قفل التطبيق)">
        <View
          style={{
            flexDirection: "row-reverse",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: 8,
            marginBottom: 8,
          }}
        >
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text
              style={{
                color: colors.foreground,
                fontFamily: "Cairo_700Bold",
                fontSize: 14,
                textAlign: "right",
              }}
            >
              تفعيل القفل الإجباري
            </Text>
            <Text
              style={{
                color: colors.mutedForeground,
                fontFamily: "Cairo_400Regular",
                fontSize: 11,
                textAlign: "right",
                marginTop: 2,
              }}
            >
              يمنع أي مستخدم نسخته أقدم من الحد الأدنى من استخدام التطبيق حتى يقوم بالتحديث.
            </Text>
          </View>
          <Switch
            value={draft.forceUpdateEnabled ?? false}
            onValueChange={(val) => setDraft((d) => ({ ...d, forceUpdateEnabled: val }))}
            trackColor={{ false: colors.border, true: "#E74C3C" }}
            thumbColor={draft.forceUpdateEnabled ? "#FFF" : "#888"}
          />
        </View>

        <Field
          label="الحد الأدنى لنسخة التطبيق (Min Version)"
          value={draft.minVersion ?? ""}
          onChange={(v) => setDraft((d) => ({ ...d, minVersion: v }))}
          placeholder="مثال: 1.1.0"
        />
        {invalidMinVersion && (
          <Text
            style={{
              color: "#E74C3C",
              fontSize: 12,
              fontFamily: "Cairo_400Regular",
              textAlign: "right",
              marginTop: -6,
              marginBottom: 8,
            }}
          >
            صيغة رقم النسخة غير صحيحة (مثال صحيح: 1.1.0).
          </Text>
        )}

        {minVersionExceedsCurrent ? (
          <View
            style={{
              backgroundColor: "#E74C3C18",
              borderWidth: 1,
              borderColor: "#E74C3C66",
              borderRadius: 10,
              padding: 12,
              marginBottom: 12,
            }}
          >
            <Text
              style={{
                color: "#E74C3C",
                fontFamily: "Cairo_700Bold",
                fontSize: 13,
                textAlign: "right",
              }}
            >
              ⚠️ تحذير مهم:
            </Text>
            <Text
              style={{
                color: "#E74C3C",
                fontFamily: "Cairo_400Regular",
                fontSize: 12,
                textAlign: "right",
                marginTop: 2,
                lineHeight: 18,
              }}
            >
              الرقم المدخل ({minVersionNorm}) أعلى من نسخة التطبيق الحالية ({APP_VERSION}). تفعيل هذا الخيار سيقفل التطبيق على جميع المستخدمين الحاليين فوراً حتى ينزلوا التحديث الجديد من المتجر.
            </Text>
          </View>
        ) : null}

        <View
          style={{
            flexDirection: "row-reverse",
            gap: 10,
            marginTop: 4,
          }}
        >
          <Pressable
            onPress={() => setShowForcePreview(true)}
            style={({ pressed }) => ({
              backgroundColor: colors.input,
              borderWidth: 1,
              borderColor: colors.border,
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 8,
              flexDirection: "row-reverse",
              alignItems: "center",
              gap: 6,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Icon name="eye" size={14} color={colors.foreground} />
            <Text
              style={{
                color: colors.foreground,
                fontFamily: "Cairo_600SemiBold",
                fontSize: 12,
              }}
            >
              معاينة شاشة القفل الإجباري
            </Text>
          </Pressable>
        </View>
      </Card>

      {/* Previews */}
      <FlexibleUpdateModal
        preview
        visibleOverride={showFlexiblePreview}
        onClosePreview={() => setShowFlexiblePreview(false)}
        draftSettings={draft}
      />

      {showForcePreview && (
        <ForceUpdateScreen
          preview
          onClosePreview={() => setShowForcePreview(false)}
          draftSettings={draft}
        />
      )}
    </SettingsScreen>
  );
}
