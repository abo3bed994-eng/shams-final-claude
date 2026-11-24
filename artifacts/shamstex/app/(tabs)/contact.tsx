import React from "react";
import {
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Icon from "@/components/Icon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cardShadow } from "@/constants/shadows";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useTranslation } from "@/lib/i18n";

export default function ContactScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { settings, language } = useApp();
  const { t } = useTranslation();
  const CONTACTS = settings.contacts;
  const SOCIAL = settings.social;
  const branches = (settings.branches ?? []).filter(
    (b) => b && typeof b.name === "string" && b.name.trim().length > 0
  );

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const callNumber = (number: string) => {
    Linking.openURL(`tel:${number.replace(/\s+/g, "")}`);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 8, borderBottomColor: colors.border },
        ]}
      >
        <Text
          style={[styles.title, { color: colors.foreground, fontFamily: "Cairo_700Bold", textAlign: "right" }]}
        >
          {t("contactUs")}
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 100 }]}
      >
        <View style={styles.logoSection}>
          <Image
            source={require("../../assets/images/logo.png")}
            style={styles.logoImg}
            resizeMode="contain"
          />
          <Text
            style={[
              styles.brandName,
              {
                color: colors.gold,
                fontFamily: "Cairo_700Bold",
                letterSpacing: language === "ar" ? 0 : 0.5,
              },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.65}
            maxFontSizeMultiplier={1.15}
          >
            {t("tagline")}
          </Text>
        </View>

        {branches.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Icon name="map-pin" size={20} color={colors.gold} />
              <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Cairo_700Bold" }]}>
                {t("branches")}
              </Text>
            </View>

            <View style={{ gap: 12 }}>
              {branches.map((branch) => {
                const phone = branch.phone?.trim();
                const mapsUrl = branch.mapsUrl?.trim();

                return (
                  <View
                    key={branch.id}
                    style={[
                      styles.branchCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                        borderRadius: colors.radius,
                      },
                      cardShadow(colors.isDark, "soft"),
                    ]}
                  >
                    <View style={styles.branchHeader}>
                      <View style={[styles.branchIconWrap, { backgroundColor: colors.gold + "18" }]}>
                        <Icon name="home" size={20} color={colors.gold} />
                      </View>
                      <View style={styles.branchInfo}>
                        <Text style={[styles.branchName, { color: colors.foreground, fontFamily: "Cairo_700Bold" }]}>
                          {branch.name}
                        </Text>
                        {branch.address ? (
                          <View style={styles.branchAddressRow}>
                            <Icon name="map-pin" size={13} color={colors.mutedForeground} />
                            <Text style={[styles.branchAddress, { color: colors.mutedForeground, fontFamily: "Cairo_400Regular" }]}>
                              {branch.address}
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      {(phone || mapsUrl) ? (
                        <View style={styles.branchActions}>
                          {phone ? (
                            <Pressable
                              onPress={() => callNumber(phone)}
                              accessibilityLabel={`اتصال بـ ${branch.name}`}
                              style={({ pressed }) => [
                                styles.branchActionCircle,
                                {
                                  backgroundColor: colors.gold + "18",
                                  borderColor: colors.gold + "44",
                                  opacity: pressed ? 0.7 : 1,
                                },
                              ]}
                            >
                              <Icon name="phone" size={17} color={colors.gold} />
                            </Pressable>
                          ) : null}

                          {mapsUrl ? (
                            <Pressable
                              onPress={() => {
                                Linking.openURL(mapsUrl).catch(() => {
                                  Alert.alert("خطأ", "تعذّر فتح رابط الخريطة على هذا الجهاز");
                                });
                              }}
                              accessibilityLabel={`موقع ${branch.name} على الخريطة`}
                              style={({ pressed }) => [
                                styles.branchActionCircle,
                                {
                                  backgroundColor: colors.isDark ? "#3498DB22" : "#3498DB15",
                                  borderColor: "#3498DB55",
                                  opacity: pressed ? 0.7 : 1,
                                },
                              ]}
                            >
                              <Icon name="map-pin" size={17} color="#3498DB" />
                            </Pressable>
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Cairo_700Bold" }]}>
            {t("contactUs")}
          </Text>
          {CONTACTS.map((contact) => (
            <Pressable
              key={contact.id}
              onPress={() => callNumber(contact.number)}
              style={({ pressed }) => [
                styles.contactCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                  opacity: pressed ? 0.8 : 1,
                },
                cardShadow(colors.isDark, "soft"),
              ]}
            >
              <Icon name="phone-call" size={18} color={colors.gold} />
              <View style={styles.contactInfo}>
                <Text style={[styles.contactLabel, { color: colors.mutedForeground, fontFamily: "Cairo_400Regular" }]}>
                  {contact.label}
                </Text>
                <Text style={[styles.contactNumber, { color: colors.foreground, fontFamily: "Cairo_600SemiBold" }]}>
                  {contact.number}
                </Text>
              </View>
              <View style={[styles.contactIcon, { backgroundColor: colors.gold + "22" }]}>
                <Icon name={contact.icon as any} size={20} color={colors.gold} />
              </View>
            </Pressable>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Cairo_700Bold" }]}>
            {t("followUs")}
          </Text>
          <View style={styles.socialRow}>
            {SOCIAL.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => Linking.openURL(s.url)}
                style={({ pressed }) => [
                  styles.socialBtn,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    borderRadius: colors.radius,
                    opacity: pressed ? 0.8 : 1,
                  },
                  cardShadow(colors.isDark, "soft"),
                ]}
              >
                <Icon name={s.icon as any} size={22} color={colors.gold} />
                <Text
                  style={[styles.socialLabel, { color: colors.foreground, fontFamily: "Cairo_500Medium" }]}
                >
                  {s.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View
          style={[
            styles.aboutCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.gold + "33",
              borderRadius: colors.radius,
            },
            cardShadow(colors.isDark, "soft"),
          ]}
        >
          <Text style={[styles.aboutTitle, { color: colors.gold, fontFamily: "Cairo_700Bold" }]}>
            {settings.aboutTitle}
          </Text>
          <Text style={[styles.aboutText, { color: colors.mutedForeground, fontFamily: "Cairo_400Regular" }]}>
            {settings.aboutText}
          </Text>
          <View style={styles.aboutStats}>
            <View style={styles.stat}>
              <Text style={[styles.statNum, { color: colors.gold, fontFamily: "Cairo_700Bold" }]}>
                {settings.stats?.clients ?? "+500"}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Cairo_400Regular" }]}>
                {settings.statLabels?.clients ?? t("clients")}
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.stat}>
              <Text style={[styles.statNum, { color: colors.gold, fontFamily: "Cairo_700Bold" }]}>
                {settings.stats?.products ?? "+50"}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Cairo_400Regular" }]}>
                {settings.statLabels?.products ?? t("productsCount")}
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.stat}>
              <Text style={[styles.statNum, { color: colors.gold, fontFamily: "Cairo_700Bold" }]}>
                {settings.stats?.years ?? "15+"}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Cairo_400Regular" }]}>
                {settings.statLabels?.years ?? t("yearsExperience")}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    alignItems: "flex-end",
  },
  title: { fontSize: 22, textAlign: "right", width: "100%" },
  content: {
    padding: 16,
    gap: 24,
  },
  logoSection: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 16,
    width: "100%",
  },
  logoImg: {
    width: 180,
    height: 180,
  },
  brandName: {
    fontSize: 18,
    letterSpacing: 0,
    textAlign: "center",
    paddingHorizontal: 0,
    width: "100%",
  },
  tagline: {
    fontSize: 13,
    letterSpacing: 1,
  },
  section: {
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    textAlign: "right",
  },
  contactCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  contactInfo: {
    flex: 1,
    gap: 2,
    alignItems: "flex-end",
  },
  contactLabel: {
    fontSize: 13,
  },
  contactNumber: {
    fontSize: 16,
  },
  contactIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  branchCard: {
    padding: 14,
    borderWidth: 1,
  },
  branchHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
  },
  branchIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  branchInfo: {
    flex: 1,
    alignItems: "flex-end",
    gap: 2,
  },
  branchName: {
    fontSize: 16,
    textAlign: "right",
  },
  branchAddressRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  branchAddress: {
    fontSize: 13,
    textAlign: "right",
  },
  branchActions: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  branchActionCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  socialRow: {
    flexDirection: "row-reverse",
    gap: 12,
  },
  socialBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
    borderWidth: 1,
  },
  socialLabel: {
    fontSize: 12,
  },
  aboutCard: {
    padding: 20,
    borderWidth: 1,
    gap: 14,
  },
  aboutTitle: {
    fontSize: 18,
    textAlign: "right",
  },
  aboutText: {
    fontSize: 13,
    textAlign: "right",
    lineHeight: 22,
  },
  aboutStats: {
    flexDirection: "row-reverse",
    justifyContent: "space-around",
    marginTop: 8,
  },
  stat: {
    alignItems: "center",
    gap: 4,
  },
  statNum: {
    fontSize: 22,
  },
  statLabel: {
    fontSize: 11,
  },
  statDivider: {
    width: 1,
    height: 40,
  },
});
