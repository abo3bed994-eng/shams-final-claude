import AppTextInput from "@/components/AppTextInput";
import React, { useState, useMemo } from "react";
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { KeyboardAwareScroll } from "@/components/KeyboardAware";
import Icon from "@/components/Icon";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp, Product } from "@/context/AppContext";
import GoldHeader from "@/components/GoldHeader";
import GoldButton from "@/components/GoldButton";
import { useAdminGuard } from "@/hooks/useAdminGuard";

interface PendingChange {
  name: string;
  retailPrice: number;
  wholesalePrice: number;
  offerPrice?: number;
  priceTrend?: Product["priceTrend"];
  priceMenuNew?: boolean;
}

export default function AdminPricesScreen() {
  useAdminGuard("edit_products");
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { products, updateProductsBatch } = useApp();

  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [editValues, setEditValues] = useState<{
    name: string;
    retail: string;
    wholesale: string;
    offer: string;
    priceTrend: Product["priceTrend"];
    priceMenuNew: boolean;
  }>({
    name: "",
    retail: "",
    wholesale: "",
    offer: "",
    priceTrend: undefined,
    priceMenuNew: false,
  });

  const [pendingChanges, setPendingChanges] = useState<Record<string, PendingChange>>({});
  const [isSaving, setIsSaving] = useState(false);

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const pendingCount = Object.keys(pendingChanges).length;

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, searchQuery]);

  const startEdit = (product: Product) => {
    const pending = pendingChanges[product.id];
    setEditingId(product.id);
    setEditValues({
      name: pending?.name ?? product.name,
      retail: String(pending?.retailPrice ?? product.retailPrice),
      wholesale: String(pending?.wholesalePrice ?? product.wholesalePrice),
      offer:
        pending !== undefined
          ? pending.offerPrice && pending.offerPrice > 0
            ? String(pending.offerPrice)
            : ""
          : product.offerPrice && product.offerPrice > 0
          ? String(product.offerPrice)
          : "",
      priceTrend: pending ? pending.priceTrend : product.priceTrend,
      priceMenuNew: pending ? !!pending.priceMenuNew : !!product.priceMenuNew,
    });
  };

  const applyRowEdit = (productId: string) => {
    const retail = parseFloat(editValues.retail);
    const wholesale = parseFloat(editValues.wholesale);
    const offerNum = editValues.offer.trim() ? parseFloat(editValues.offer) : 0;

    if (!editValues.name.trim()) {
      Alert.alert("تنبيه", "يرجى إدخال اسم الخامة");
      return;
    }
    if (isNaN(retail) || retail <= 0 || isNaN(wholesale) || wholesale <= 0) {
      Alert.alert("خطأ في السعر", "يرجى إدخال سعر صحيح للزبون وسعر التاجر (أكبر من 0)");
      return;
    }
    if (offerNum > 0 && offerNum >= retail) {
      Alert.alert(
        "خطأ في سعر العرض",
        `سعر العرض (${offerNum} ج.م) يجب أن يكون أقل من سعر الزبون الأساسي (${retail} ج.م) ليظهر كتخفيض صحيح.`
      );
      return;
    }

    setPendingChanges((prev) => ({
      ...prev,
      [productId]: {
        name: editValues.name.trim(),
        retailPrice: retail,
        wholesalePrice: wholesale,
        offerPrice: offerNum > 0 && offerNum < retail ? offerNum : undefined,
        priceTrend: editValues.priceTrend,
        priceMenuNew: editValues.priceMenuNew,
      },
    }));

    setEditingId(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const cancelRowEdit = () => {
    setEditingId(null);
  };

  const revertSingleProduct = (productId: string) => {
    setPendingChanges((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
    setEditingId(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const revertAllChanges = () => {
    Alert.alert("تراجع عن التعديلات", "هل تريد إلغاء جميع التعديلات غير المحفوظة والعودة للأسعار الأصلية؟", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "تراجع عن الكل",
        style: "destructive",
        onPress: () => {
          setPendingChanges({});
          setEditingId(null);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        },
      },
    ]);
  };

  const saveAllChanges = async () => {
    const ids = Object.keys(pendingChanges);
    if (ids.length === 0) return;

    setIsSaving(true);
    try {
      const updatedList: Product[] = [];
      for (const id of ids) {
        const change = pendingChanges[id];
        const original = products.find((p) => p.id === id);
        if (!original) continue;

        const updated: Product = {
          ...original,
          name: change.name,
          retailPrice: change.retailPrice,
          wholesalePrice: change.wholesalePrice,
          priceTrend: change.priceTrend,
          priceMenuNew: change.priceMenuNew,
        };

        if (change.offerPrice && change.offerPrice > 0 && change.offerPrice < change.retailPrice) {
          updated.offerPrice = change.offerPrice;
        } else {
          delete updated.offerPrice;
        }

        updatedList.push(updated);
      }

      await updateProductsBatch(updatedList);
      setPendingChanges({});
      setEditingId(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("تم الحفظ بنجاح", `تم حفظ أسعار وعروض ${updatedList.length} خامة بنجاح.`);
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("تعذّر الحفظ", "تأكد من اتصالك بالإنترنت ثم حاول مجدداً.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    if (pendingCount > 0) {
      Alert.alert(
        "تعديلات غير محفوظة",
        `لديك ${pendingCount} خامة تم تعديلها ولم يتم حفظها بعد، هل تريد الخروج وتجاهل هذه التعديلات؟`,
        [
          { text: "البقاء للتعديل", style: "cancel" },
          {
            text: "خروج بدون حفظ",
            style: "destructive",
            onPress: () => router.back(),
          },
        ]
      );
    } else {
      router.back();
    }
  };

  // Preview helper values for editing row
  const editRetailNum = parseFloat(editValues.retail) || 0;
  const editOfferNum = parseFloat(editValues.offer) || 0;
  const hasValidOfferEdit = editOfferNum > 0 && editOfferNum < editRetailNum;
  const hasInvalidOfferEdit = editOfferNum > 0 && editOfferNum >= editRetailNum;
  const calculatedDiscount =
    hasValidOfferEdit && editRetailNum > 0
      ? Math.round(((editRetailNum - editOfferNum) / editRetailNum) * 100)
      : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GoldHeader title="إدارة الأسعار والعروض" onBack={handleBack} />

      {/* Search & Info Bar */}
      <View style={[styles.searchBarContainer, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={[styles.searchInputWrapper, { backgroundColor: colors.input, borderColor: colors.border }]}>
          <Icon name="search" size={16} color={colors.mutedForeground} />
          <AppTextInput
            style={[styles.searchInput, { color: colors.foreground, fontFamily: "Cairo_500Medium" }]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="بحث عن خامة..."
            placeholderTextColor={colors.mutedForeground}
            textAlign="right"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
              <Icon name="x" size={15} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>

        <View style={styles.statsRow}>
          <Text style={[styles.statsText, { color: colors.mutedForeground, fontFamily: "Cairo_400Regular" }]}>
            الإجمالي: {products.length} خامة
          </Text>
          {pendingCount > 0 && (
            <View style={[styles.pendingPill, { backgroundColor: colors.gold + "22", borderColor: colors.gold }]}>
              <Text style={[styles.pendingPillText, { color: colors.gold, fontFamily: "Cairo_700Bold" }]}>
                {pendingCount} بانتظار الحفظ
              </Text>
            </View>
          )}
        </View>
      </View>

      <KeyboardAwareScroll
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomPad + (pendingCount > 0 ? 100 : 40) },
        ]}
      >
        {/* Table Column Headers */}
        <View style={[styles.headerRow, { borderBottomColor: colors.border }]}>
          <Text style={[styles.colHeader, { color: colors.mutedForeground, fontFamily: "Cairo_600SemiBold", flex: 1 }]}>
            سعر التاجر
          </Text>
          <Text style={[styles.colHeader, { color: colors.mutedForeground, fontFamily: "Cairo_600SemiBold", flex: 1.1 }]}>
            سعر الزبون / العرض
          </Text>
          <Text style={[styles.colHeader, { color: colors.mutedForeground, fontFamily: "Cairo_600SemiBold", flex: 2, textAlign: "right", paddingRight: 6 }]}>
            اسم الخامة
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {filteredProducts.map((product) => {
          const isEditing = editingId === product.id;
          const pending = pendingChanges[product.id];
          const isModified = pending !== undefined;

          // Effective values to display in the list
          const displayName = pending?.name ?? product.name;
          const displayWholesale = pending?.wholesalePrice ?? product.wholesalePrice;
          const displayRetail = pending?.retailPrice ?? product.retailPrice;
          const displayOffer =
            pending !== undefined ? pending.offerPrice : product.offerPrice;
          const displayHasOffer =
            displayOffer != null && displayOffer > 0 && displayOffer < displayRetail;
          const displayTrend = pending ? pending.priceTrend : product.priceTrend;
          const displayNew = pending ? !!pending.priceMenuNew : !!product.priceMenuNew;

          return (
            <View key={product.id}>
              <Pressable
                onPress={() => {
                  if (!isEditing) startEdit(product);
                }}
                style={({ pressed }) => [
                  styles.priceRow,
                  {
                    backgroundColor: isEditing
                      ? colors.surface
                      : isModified
                      ? colors.gold + "0C"
                      : colors.card,
                    borderColor: isEditing
                      ? colors.gold
                      : isModified
                      ? colors.gold + "66"
                      : colors.border,
                    borderRadius: colors.radius - 2,
                    opacity: pressed && !isEditing ? 0.85 : 1,
                  },
                ]}
              >
                {!isEditing ? (
                  <>
                    {/* Wholesale Cell */}
                    <Text
                      style={[
                        styles.priceCell,
                        { color: colors.gold, fontFamily: "Cairo_700Bold", flex: 1 },
                      ]}
                      numberOfLines={1}
                    >
                      {displayWholesale} ج.م
                    </Text>

                    {/* Retail / Offer Cell */}
                    <View style={{ flex: 1.1, alignItems: "center", justifyContent: "center" }}>
                      {displayHasOffer ? (
                        <View style={{ alignItems: "center", gap: 2 }}>
                          <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 3 }}>
                            <Text style={{ fontSize: 13, color: "#E74C3C", fontFamily: "Cairo_700Bold" }}>
                              {displayOffer} ج.م
                            </Text>
                            <View style={[styles.offerBadge, { backgroundColor: "#E74C3C22" }]}>
                              <Text style={[styles.offerBadgeText, { color: "#E74C3C", fontFamily: "Cairo_700Bold" }]}>
                                عرض
                              </Text>
                            </View>
                          </View>
                          <Text
                            style={{
                              fontSize: 10,
                              color: colors.mutedForeground,
                              textDecorationLine: "line-through",
                              fontFamily: "Cairo_500Medium",
                            }}
                          >
                            {displayRetail} ج.م
                          </Text>
                        </View>
                      ) : (
                        <Text
                          style={[
                            styles.priceCell,
                            { color: colors.foreground, fontFamily: "Cairo_600SemiBold" },
                          ]}
                          numberOfLines={1}
                        >
                          {displayRetail} ج.م
                        </Text>
                      )}
                    </View>

                    {/* Product Name & Badges */}
                    <View style={{ flex: 2, flexDirection: "row-reverse", alignItems: "center", gap: 6 }}>
                      {isModified && (
                        <View style={[styles.modifiedBadge, { backgroundColor: colors.gold + "28" }]}>
                          <Text style={[styles.modifiedBadgeText, { color: colors.gold, fontFamily: "Cairo_700Bold" }]}>
                            معدّل
                          </Text>
                        </View>
                      )}
                      {displayNew && (
                        <View style={[styles.newBadge, { backgroundColor: colors.gold }]}>
                          <Text style={[styles.newBadgeText, { color: colors.background, fontFamily: "Cairo_700Bold" }]}>
                            NEW
                          </Text>
                        </View>
                      )}
                      {displayTrend === "up" && <Icon name="chevron-up" size={16} color="#27AE60" />}
                      {displayTrend === "down" && <Icon name="chevron-down" size={16} color="#E74C3C" />}
                      <Text
                        style={[
                          styles.nameCell,
                          { color: colors.foreground, fontFamily: "Cairo_600SemiBold", flex: 1, textAlign: "right" },
                        ]}
                        numberOfLines={1}
                      >
                        {displayName}
                      </Text>
                    </View>

                    <Icon name="edit-2" size={14} color={isModified ? colors.gold : colors.mutedForeground} />
                  </>
                ) : (
                  /* Expanded Inline Edit Form */
                  <View style={styles.expandedForm}>
                    <View style={styles.formHeader}>
                      <Text style={[styles.formTitle, { color: colors.gold, fontFamily: "Cairo_700Bold" }]}>
                        تعديل أسعار: {product.name}
                      </Text>
                      {isModified && (
                        <Pressable onPress={() => revertSingleProduct(product.id)} style={styles.revertBtn}>
                          <Icon name="rotate-ccw" size={12} color={colors.mutedForeground} />
                          <Text style={[styles.revertBtnText, { color: colors.mutedForeground, fontFamily: "Cairo_500Medium" }]}>
                            استعادة الأصلي
                          </Text>
                        </Pressable>
                      )}
                    </View>

                    {/* Fabric Name Input */}
                    <View style={styles.fieldGroup}>
                      <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: "Cairo_500Medium" }]}>
                        اسم الخامة
                      </Text>
                      <AppTextInput
                        style={[
                          styles.editInput,
                          {
                            color: colors.foreground,
                            backgroundColor: colors.input,
                            borderColor: colors.border,
                            fontFamily: "Cairo_600SemiBold",
                          },
                        ]}
                        value={editValues.name}
                        onChangeText={(v) => setEditValues((p) => ({ ...p, name: v }))}
                        placeholder="اسم الخامة"
                        placeholderTextColor={colors.mutedForeground}
                        textAlign="right"
                      />
                    </View>

                    {/* Basic Prices: Wholesale & Retail */}
                    <View style={styles.priceInputsRow}>
                      <View style={styles.priceInputWrapper}>
                        <Text style={[styles.fieldLabel, { color: colors.gold, fontFamily: "Cairo_600SemiBold" }]}>
                          سعر التاجر (ج.م)
                        </Text>
                        <AppTextInput
                          style={[
                            styles.editInput,
                            {
                              color: colors.gold,
                              backgroundColor: colors.input,
                              borderColor: colors.border,
                              fontFamily: "Cairo_700Bold",
                              fontSize: 15,
                            },
                          ]}
                          value={editValues.wholesale}
                          onChangeText={(v) => {
                            if (/^\d*\.?\d*$/.test(v)) setEditValues((p) => ({ ...p, wholesale: v }));
                          }}
                          keyboardType="decimal-pad"
                          textAlign="center"
                          placeholder="0"
                          placeholderTextColor={colors.mutedForeground}
                        />
                      </View>

                      <View style={styles.priceInputWrapper}>
                        <Text style={[styles.fieldLabel, { color: colors.foreground, fontFamily: "Cairo_600SemiBold" }]}>
                          سعر الزبون (ج.م)
                        </Text>
                        <AppTextInput
                          style={[
                            styles.editInput,
                            {
                              color: colors.foreground,
                              backgroundColor: colors.input,
                              borderColor: colors.border,
                              fontFamily: "Cairo_700Bold",
                              fontSize: 15,
                            },
                          ]}
                          value={editValues.retail}
                          onChangeText={(v) => {
                            if (/^\d*\.?\d*$/.test(v)) setEditValues((p) => ({ ...p, retail: v }));
                          }}
                          keyboardType="decimal-pad"
                          textAlign="center"
                          placeholder="0"
                          placeholderTextColor={colors.mutedForeground}
                        />
                      </View>
                    </View>

                    {/* Offer Price Section (Dedicated Box) */}
                    <View
                      style={[
                        styles.offerSection,
                        {
                          backgroundColor: colors.background,
                          borderColor: hasValidOfferEdit ? "#E74C3C88" : colors.border,
                        },
                      ]}
                    >
                      <View style={styles.offerHeaderRow}>
                        <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6 }}>
                          <Icon name="tag" size={15} color="#E74C3C" />
                          <Text style={[styles.offerSectionTitle, { color: "#E74C3C", fontFamily: "Cairo_700Bold" }]}>
                            سعر العرض للزبون (تخفيض / سعر مشطوب)
                          </Text>
                        </View>
                        {editValues.offer.trim().length > 0 && (
                          <Pressable
                            onPress={() => setEditValues((p) => ({ ...p, offer: "" }))}
                            style={styles.clearOfferBtn}
                          >
                            <Icon name="x" size={13} color="#E74C3C" />
                            <Text style={{ fontSize: 11, color: "#E74C3C", fontFamily: "Cairo_600SemiBold" }}>
                              إلغاء العرض
                            </Text>
                          </Pressable>
                        )}
                      </View>

                      <Text style={[styles.offerHelpText, { color: colors.mutedForeground, fontFamily: "Cairo_400Regular" }]}>
                        اتركه فارغاً إذا لم يكن هناك عرض. عند إدخال سعر أقل من سعر الزبون، سيظهر السعر القديم مشطوباً وسعر العرض هو السعر الفعلي.
                      </Text>

                      <AppTextInput
                        style={[
                          styles.editInput,
                          {
                            color: "#E74C3C",
                            backgroundColor: colors.input,
                            borderColor: editValues.offer.trim() ? "#E74C3C" : colors.border,
                            fontFamily: "Cairo_700Bold",
                            fontSize: 15,
                          },
                        ]}
                        value={editValues.offer}
                        onChangeText={(v) => {
                          if (/^\d*\.?\d*$/.test(v)) setEditValues((p) => ({ ...p, offer: v }));
                        }}
                        keyboardType="decimal-pad"
                        textAlign="center"
                        placeholder="بدون عرض (مثال: 120)"
                        placeholderTextColor={colors.mutedForeground}
                      />

                      {/* Live Validation & Hint for Offer */}
                      {hasValidOfferEdit && (
                        <View style={styles.offerStatusBox}>
                          <Text style={[styles.offerStatusText, { color: "#27AE60", fontFamily: "Cairo_600SemiBold" }]}>
                            ✓ سيظهر السعر القديم ({editRetailNum} ج.م) مشطوباً، وسعر العرض ({editOfferNum} ج.م) هو السعر الفعلي (خصم {calculatedDiscount}%).
                          </Text>
                        </View>
                      )}

                      {hasInvalidOfferEdit && (
                        <View style={styles.offerStatusBox}>
                          <Text style={[styles.offerStatusText, { color: "#E74C3C", fontFamily: "Cairo_600SemiBold" }]}>
                            ⚠ تنبيه: سعر العرض ({editOfferNum} ج.م) يجب أن يكون أقل من سعر الزبون الأساسي ({editRetailNum} ج.م).
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Extra Badges: NEW & Price Trend */}
                    <View style={styles.markerRow}>
                      <Pressable
                        onPress={() => setEditValues((p) => ({ ...p, priceMenuNew: !p.priceMenuNew }))}
                        style={[
                          styles.markerBtn,
                          {
                            backgroundColor: editValues.priceMenuNew ? colors.gold + "22" : colors.surface,
                            borderColor: editValues.priceMenuNew ? colors.gold : colors.border,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.newBadge,
                            { backgroundColor: editValues.priceMenuNew ? colors.gold : colors.mutedForeground },
                          ]}
                        >
                          <Text
                            style={[
                              styles.newBadgeText,
                              {
                                color: editValues.priceMenuNew ? colors.background : colors.card,
                                fontFamily: "Cairo_700Bold",
                              },
                            ]}
                          >
                            NEW
                          </Text>
                        </View>
                        <Text style={{ color: colors.foreground, fontFamily: "Cairo_500Medium", fontSize: 12 }}>
                          شارة خامة جديدة
                        </Text>
                      </Pressable>

                      <View style={styles.trendGroup}>
                        <Text style={{ color: colors.mutedForeground, fontFamily: "Cairo_400Regular", fontSize: 11 }}>
                          إشارة حركة السعر
                        </Text>
                        <View style={styles.trendButtons}>
                          {([
                            { value: undefined, label: "بدون", icon: "minus" },
                            { value: "up", label: "↑", icon: "chevron-up" },
                            { value: "down", label: "↓", icon: "chevron-down" },
                          ] as const).map((item) => (
                            <Pressable
                              key={item.label}
                              onPress={() => setEditValues((p) => ({ ...p, priceTrend: item.value }))}
                              style={[
                                styles.trendBtn,
                                {
                                  backgroundColor:
                                    editValues.priceTrend === item.value ? colors.gold + "22" : colors.surface,
                                  borderColor:
                                    editValues.priceTrend === item.value ? colors.gold : colors.border,
                                },
                              ]}
                            >
                              <Icon
                                name={item.icon}
                                size={14}
                                color={
                                  editValues.priceTrend === item.value ? colors.gold : colors.mutedForeground
                                }
                              />
                              <Text
                                style={{
                                  color:
                                    editValues.priceTrend === item.value ? colors.gold : colors.mutedForeground,
                                  fontFamily: "Cairo_500Medium",
                                  fontSize: 10,
                                }}
                              >
                                {item.label}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>
                    </View>

                    {/* Row Edit Actions */}
                    <View style={styles.editActions}>
                      <GoldButton
                        label="اعتماد التعديل"
                        onPress={() => applyRowEdit(product.id)}
                        size="sm"
                        style={{ flex: 1.5 }}
                      />
                      <GoldButton
                        label="إلغاء"
                        onPress={cancelRowEdit}
                        variant="ghost"
                        size="sm"
                        style={{ flex: 1 }}
                      />
                    </View>
                  </View>
                )}
              </Pressable>
            </View>
          );
        })}

        {filteredProducts.length === 0 && (
          <View style={styles.emptyContainer}>
            <Icon name="search" size={32} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Cairo_600SemiBold" }]}>
              لا توجد خامات مطابقة للبحث
            </Text>
          </View>
        )}
      </KeyboardAwareScroll>

      {/* Floating Batch Save Bar */}
      {pendingCount > 0 && (
        <View
          style={[
            styles.floatingBar,
            {
              backgroundColor: colors.card,
              borderTopColor: colors.gold,
              paddingBottom: bottomPad + 8,
            },
          ]}
        >
          <View style={styles.floatingInfo}>
            <Text style={[styles.floatingTitle, { color: colors.gold, fontFamily: "Cairo_700Bold" }]}>
              تم تعديل {pendingCount} {pendingCount === 1 ? "خامة" : pendingCount === 2 ? "خامتَين" : "خامات"}
            </Text>
            <Text style={[styles.floatingSubtitle, { color: colors.mutedForeground, fontFamily: "Cairo_400Regular" }]}>
              التغييرات بانتظار الحفظ في السيرفر
            </Text>
          </View>

          <View style={styles.floatingButtons}>
            <GoldButton
              label={`حفظ الكل (${pendingCount})`}
              onPress={saveAllChanges}
              loading={isSaving}
              size="sm"
              style={{ minWidth: 125 }}
            />
            <GoldButton
              label="تراجع"
              onPress={revertAllChanges}
              variant="ghost"
              size="sm"
              disabled={isSaving}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchBarContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  searchInputWrapper: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
    height: 40,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 13,
    paddingVertical: 0,
  },
  statsRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statsText: { fontSize: 11 },
  pendingPill: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  pendingPillText: { fontSize: 11 },

  content: { padding: 16, gap: 10 },
  headerRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingBottom: 10,
    borderBottomWidth: 1,
    paddingHorizontal: 8,
  },
  colHeader: { fontSize: 12, textAlign: "center" },
  priceRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderWidth: 1,
    gap: 8,
  },
  priceCell: { fontSize: 13, textAlign: "center" },
  nameCell: { fontSize: 13 },
  offerBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  offerBadgeText: { fontSize: 9 },
  modifiedBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  modifiedBadgeText: { fontSize: 9 },

  // Expanded form styles
  expandedForm: { flex: 1, gap: 12 },
  formHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#ffffff15",
    paddingBottom: 6,
  },
  formTitle: { fontSize: 14 },
  revertBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  revertBtnText: { fontSize: 11 },

  fieldGroup: { gap: 4 },
  fieldLabel: { fontSize: 11, textAlign: "right" },
  editInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    minHeight: 42,
  },

  priceInputsRow: { flexDirection: "row-reverse", gap: 10 },
  priceInputWrapper: { flex: 1, gap: 4 },

  // Offer Section in edit form
  offerSection: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    gap: 8,
  },
  offerHeaderRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  offerSectionTitle: { fontSize: 12 },
  clearOfferBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  offerHelpText: { fontSize: 10.5, textAlign: "right", lineHeight: 16 },
  offerStatusBox: {
    backgroundColor: "#ffffff08",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
  },
  offerStatusText: { fontSize: 11, textAlign: "right", lineHeight: 17 },

  markerRow: { flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  markerBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  newBadge: { borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },
  newBadgeText: { fontSize: 9 },
  trendGroup: { flex: 1, alignItems: "flex-end", gap: 4 },
  trendButtons: { flexDirection: "row-reverse", gap: 4 },
  trendBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 2,
    borderWidth: 1,
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 5,
  },

  editActions: { flexDirection: "row-reverse", gap: 10, marginTop: 4 },

  emptyContainer: {
    paddingVertical: 50,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyText: { fontSize: 13 },

  // Floating save bar
  floatingBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1.5,
    paddingHorizontal: 16,
    paddingTop: 10,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 10,
  },
  floatingInfo: { flex: 1, alignItems: "flex-end" },
  floatingTitle: { fontSize: 13 },
  floatingSubtitle: { fontSize: 10.5 },
  floatingButtons: { flexDirection: "row-reverse", alignItems: "center", gap: 6 },
});
