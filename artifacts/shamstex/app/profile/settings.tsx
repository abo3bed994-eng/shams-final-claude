import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@/components/Icon";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import GoldHeader from "@/components/GoldHeader";
import GoldButton from "@/components/GoldButton";
import AppTextInput from "@/components/AppTextInput";
import { samePhone } from "@/lib/phoneUtils";

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, setUser, updateRegisteredCustomer, deleteRegisteredCustomer, setCustomerPin, verifyCustomerPin, registeredCustomers, showToast } = useApp();
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const isOwner = Boolean(
    user?.phone && (
      samePhone(user.phone, "+201221131138") ||
      samePhone(user.phone, "01221131138")
    )
  );

  const [name, setName] = useState(user?.name || "");
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState("");

  const hasExistingPin = Boolean(user?.pin || registeredCustomers.find((c) => user?.phone && samePhone(c.phone, user.phone))?.pin);
  const [showPinChangeForm, setShowPinChangeForm] = useState(false);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [savingPin, setSavingPin] = useState(false);
  const [pinError, setPinError] = useState("");

  if (!user) return null;

  const handleSaveName = async () => {
    setNameError("");
    const trimmed = name.trim();
    if (trimmed.length < 2) { setNameError("يجب أن يتكون الاسم من حرفين على الأقل."); return; }
    if (trimmed === user.name) return;
    setSavingName(true);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      updateRegisteredCustomer({ ...user, name: trimmed, lastUpdated: new Date().toISOString() });
      showToast("تم تحديث الاسم بنجاح", "success");
      Alert.alert("تم الحفظ", "تم تحديث اسمك بنجاح.", [{ text: "حسناً" }]);
    } catch { setNameError("تعذر حفظ الاسم، يرجى المحاولة مرة أخرى."); }
    finally { setSavingName(false); }
  };

  const handleSavePin = async () => {
    setPinError("");
    if (isOwner) {
      if (hasExistingPin && (!currentPin || !verifyCustomerPin(user.phone, currentPin))) {
        setPinError("كلمة المرور الحالية غير صحيحة.");
        return;
      }
      if (newPin.trim().length < 4) {
        setPinError("كلمة المرور الجديدة يجب أن تتكون من 4 خانات على الأقل.");
        return;
      }
      if (newPin !== confirmPin) {
        setPinError("كلمة المرور وتأكيدها غير متطابقين.");
        return;
      }
    } else {
      if (hasExistingPin && (!currentPin || currentPin.length !== 4 || !verifyCustomerPin(user.phone, currentPin))) {
        setPinError(currentPin.length === 4 ? "كلمة السر الحالية غير صحيحة." : "يرجى إدخال كلمة السر الحالية (4 أرقام).");
        return;
      }
      if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
        setPinError("كلمة السر الجديدة يجب أن تتكون من 4 أرقام.");
        return;
      }
      if (newPin !== confirmPin) {
        setPinError("كلمة السر وتأكيدها غير متطابقين.");
        return;
      }
    }

    setSavingPin(true);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await setCustomerPin(user.phone, newPin);
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      setShowPinChangeForm(false);
      showToast("تم تغيير كلمة المرور بنجاح", "success");
      Alert.alert("تم التحديث", "تم تغيير كلمة المرور بنجاح.", [{ text: "حسناً" }]);
    } catch {
      setPinError("تعذر تغيير كلمة المرور، يرجى المحاولة مرة أخرى.");
    } finally {
      setSavingPin(false);
    }
  };

  const handleLogout = () => {
    if (Platform.OS === "web") {
      if (window.confirm("هل أنت متأكد من رغبتك في تسجيل الخروج؟")) {
        router.replace("/auth/login");
        setTimeout(() => setUser(null), 50);
      }
      return;
    }
    Alert.alert("تسجيل الخروج", "هل أنت متأكد من رغبتك في تسجيل الخروج؟", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "خروج",
        style: "destructive",
        onPress: () => {
          router.replace("/auth/login");
          setTimeout(() => {
            setUser(null);
          }, 80);
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    const title = "حذف الحساب";
    const msg = "هل أنت متأكد من رغبتك في حذف حسابك وبياناتك نهائياً؟ هذا الإجراء لا يمكن التراجع عنه.";
    if (Platform.OS === "web") {
      if (window.confirm(`${title}\n\n${msg}`)) {
        if (user.phone) deleteRegisteredCustomer(user.phone);
        router.replace("/auth/login");
        setTimeout(() => setUser(null), 50);
      }
      return;
    }
    Alert.alert(title, msg, [
      { text: "إلغاء", style: "cancel" },
      {
        text: "نعم، احذف حسابي",
        style: "destructive",
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          if (user.phone) deleteRegisteredCustomer(user.phone);
          router.replace("/auth/login");
          setTimeout(() => {
            setUser(null);
          }, 80);
        },
      },
    ]);
  };

  const renderPasswordInput = (label: string, value: string, setter: (v: string) => void, placeholder = "") => (
    <View style={styles.fieldGroup}>
      <Text style={[styles.inputLabel, { color: colors.foreground }]}>{label}</Text>
      <View style={[styles.inputBox, { backgroundColor: colors.input, borderColor: colors.border, borderRadius: colors.radius - 4 }]}>
        <AppTextInput
          style={[isOwner ? styles.textInput : styles.textInputPin, { color: colors.foreground }]}
          placeholder={placeholder || (isOwner ? "أدخل كلمة المرور" : "••••")}
          placeholderTextColor={colors.mutedForeground}
          value={value}
          onChangeText={(v) => {
            setter(isOwner ? v : v.replace(/\D/g, "").slice(0, 4));
            setPinError("");
          }}
          textAlign={isOwner ? "right" : "center"}
          keyboardType={isOwner ? "default" : "numeric"}
          maxLength={isOwner ? 50 : 4}
          secureTextEntry={!showPasswordText}
        />
        {isOwner && (
          <Pressable onPress={() => setShowPasswordText(!showPasswordText)} hitSlop={8}>
            <Icon name={showPasswordText ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>
    </View>
  );

  const card = (icon: string, title: string, subtitle: string, children: React.ReactNode) => (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.headerIconWrap, { backgroundColor: colors.gold + "22" }]}><Icon name={icon as any} size={18} color={colors.gold} /></View>
        <View style={styles.headerTextWrap}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>{title}</Text>
          <Text style={[styles.cardSubtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>
        </View>
      </View>
      {children}
    </View>
  );

  const canSavePin = isOwner
    ? newPin.trim().length >= 4 && confirmPin.trim().length >= 4 && (!hasExistingPin || currentPin.trim().length >= 4) && !savingPin
    : newPin.length === 4 && confirmPin.length === 4 && (!hasExistingPin || currentPin.length === 4) && !savingPin;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GoldHeader title="إعدادات الحساب" onBack={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 36 }]} keyboardShouldPersistTaps="handled">
          {card("user", "تعديل الاسم", "يمكنك تعديل اسمك الشخصي المسجل في الحساب والطلبات", <>
            <View style={styles.fieldGroup}>
              <Text style={[styles.inputLabel, { color: colors.foreground }]}>الاسم بالكامل</Text>
              <View style={[styles.inputBox, { backgroundColor: colors.input, borderColor: colors.border, borderRadius: colors.radius - 4 }]}>
                <AppTextInput
                  style={[styles.textInput, { color: colors.foreground }]}
                  placeholder="أدخل اسمك"
                  placeholderTextColor={colors.mutedForeground}
                  value={name}
                  onChangeText={(v) => { setName(v); setNameError(""); }}
                  textAlign="right"
                />
              </View>
            </View>
            {nameError ? <Text style={[styles.errorText, { color: colors.destructive }]}>{nameError}</Text> : null}
            <GoldButton label="حفظ الاسم" onPress={handleSaveName} loading={savingName} disabled={name.trim().length < 2 || name.trim() === user.name || savingName} size="sm" style={{ marginTop: 8 }} />
          </>)}

          {card(
            "lock",
            isOwner ? "كلمة مرور الإدارة" : "كلمة المرور",
            isOwner
              ? "كلمة مرور خاصة بحساب المدير الأساسي (حروف، أرقام، رموز)"
              : "رمز مرور يُستخدم لتسجيل الدخول السريع",
            <>
              {!showPinChangeForm ? (
                <GoldButton
                  label="تغيير كلمة المرور"
                  onPress={() => {
                    setShowPinChangeForm(true);
                    setPinError("");
                  }}
                  variant="outline"
                  size="sm"
                  style={{ marginTop: 4 }}
                />
              ) : (
                <View style={{ gap: 4 }}>
                  {hasExistingPin ? renderPasswordInput("كلمة المرور الحالية", currentPin, setCurrentPin) : null}
                  {renderPasswordInput(
                    isOwner ? "كلمة المرور الجديدة (4 خانات فأكثر)" : "كلمة المرور الجديدة (4 أرقام)",
                    newPin,
                    setNewPin,
                    isOwner ? "أدخل كلمة المرور الجديدة" : "••••"
                  )}
                  {renderPasswordInput(
                    "تأكيد كلمة المرور الجديدة",
                    confirmPin,
                    setConfirmPin,
                    isOwner ? "أعد كتابة كلمة المرور للتأكيد" : "••••"
                  )}
                  {pinError ? (
                    <View style={[styles.errorBanner, { backgroundColor: colors.destructive + "15", borderColor: colors.destructive + "33" }]}>
                      <Icon name="alert-circle" size={15} color={colors.destructive} />
                      <Text style={[styles.errorBannerText, { color: colors.destructive }]}>{pinError}</Text>
                    </View>
                  ) : null}
                  <View style={{ flexDirection: "row-reverse", gap: 8, marginTop: 8 }}>
                    <GoldButton
                      label="حفظ كلمة المرور"
                      onPress={handleSavePin}
                      loading={savingPin}
                      disabled={!canSavePin}
                      size="sm"
                      style={{ flex: 1 }}
                    />
                    <Pressable
                      onPress={() => {
                        setShowPinChangeForm(false);
                        setCurrentPin("");
                        setNewPin("");
                        setConfirmPin("");
                        setPinError("");
                      }}
                      style={styles.cancelBtn}
                    >
                      <Text style={[styles.cancelBtnText, { color: colors.mutedForeground }]}>إلغاء</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </>
          )}

          {card("shield", "إدارة الحساب", "تسجيل الخروج من هذا الجهاز أو حذف الحساب نهائياً", <>
            <GoldButton label="تسجيل الخروج" onPress={handleLogout} variant="outline" style={{ borderColor: colors.destructive + "88", marginTop: 8 }} />
            <View style={styles.deleteSection}>
              <Pressable onPress={handleDeleteAccount} style={({ pressed }) => [styles.deleteBtn, { opacity: pressed ? 0.5 : 0.8 }]} hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}>
                <Icon name="trash-2" size={15} color={colors.destructive} />
                <Text style={[styles.deleteBtnText, { color: colors.destructive }]}>حذف الحساب نهائياً</Text>
              </Pressable>
            </View>
          </>)}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }, content: { padding: 16, gap: 16 },
  card: { padding: 16, borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  cardHeader: { flexDirection: "row-reverse", alignItems: "center", gap: 12, marginBottom: 16 },
  headerIconWrap: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  headerTextWrap: { flex: 1, alignItems: "flex-end" },
  cardTitle: { fontSize: 15, fontFamily: "Cairo_700Bold", textAlign: "right" },
  cardSubtitle: { fontSize: 11, fontFamily: "Cairo_400Regular", textAlign: "right", marginTop: 2, lineHeight: 16 },
  fieldGroup: { marginBottom: 10 }, inputLabel: { fontSize: 12, fontFamily: "Cairo_600SemiBold", textAlign: "right", marginBottom: 6 },
  inputBox: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 10 : 6,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  textInput: { flex: 1, fontSize: 14, fontFamily: "Cairo_500Medium", minHeight: 28 },
  textInputPin: { flex: 1, fontSize: 18, fontFamily: "Cairo_700Bold", letterSpacing: 8, minHeight: 32 },
  errorText: { fontSize: 11, fontFamily: "Cairo_500Medium", textAlign: "right", marginTop: 4 },
  errorBanner: { flexDirection: "row-reverse", alignItems: "center", gap: 8, padding: 10, borderWidth: 1, borderRadius: 8, marginVertical: 6 },
  errorBannerText: { fontSize: 12, fontFamily: "Cairo_500Medium", flex: 1, textAlign: "right" },
  cancelBtn: {
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(150,150,150,0.3)",
  },
  cancelBtnText: {
    fontSize: 13,
    fontFamily: "Cairo_600SemiBold",
  },
  deleteSection: { marginTop: 18, alignItems: "center", justifyContent: "center" },
  deleteBtn: { flexDirection: "row-reverse", alignItems: "center", gap: 6, paddingVertical: 6, paddingHorizontal: 12 },
  deleteBtnText: { fontSize: 13, fontFamily: "Cairo_600SemiBold" },
});
