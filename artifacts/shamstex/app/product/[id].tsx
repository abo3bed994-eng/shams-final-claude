import AppTextInput from "@/components/AppTextInput";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  BackHandler,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import Icon from "@/components/Icon";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp, CartItem } from "@/context/AppContext";
import { sortColorsByGlobal } from "@/lib/colorUtils";
import { discountPercent, displayPriceFor, isOnOffer } from "@/lib/pricing";
import { metersPerKg } from "@/lib/fabric";
import { useCartPulse } from "@/hooks/useCartPulse";
import GoldButton from "@/components/GoldButton";
import GoldHeader from "@/components/GoldHeader";
import { KeyboardAwareScroll } from "@/components/KeyboardAware";

const KG_STEP = 0.5;

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { products, user, cart, addToCart, showToast, effectivePriceMode, favorites, toggleFavorite, settings } = useApp();
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartPulse = useCartPulse(cartCount);

  const { width: windowWidth, height: windowHeight, fontScale } = useWindowDimensions();
  const isLargeFont = fontScale >= 1.15;
  // On narrow screens (or large display-size settings, common on Xiaomi) the
  // fixed-width weight input + the two round buttons squeeze the color name
  // out of the row. Shrink the input responsively so the name always fits.
  const isNarrow = windowWidth < 390;
  const weightInputWidth = isNarrow ? 72 : 104;
  const imgScrollRef = useRef<ScrollView>(null);
  const viewerScrollRef = useRef<ScrollView>(null);
  const product = products.find((p) => p.id === id);

  const displayColors = React.useMemo(
    () => (product?.colors ? sortColorsByGlobal(product.colors, settings?.globalColors) : []),
    [product?.colors, settings?.globalColors]
  );

  const [selectedColors, setSelectedColors] = useState<Record<string, number>>({});
  const [colorWeights, setColorWeights] = useState<Record<string, number>>({});
  const [weightTexts, setWeightTexts] = useState<Record<string, string>>({});
  const [companionPercentages, setCompanionPercentages] = useState<Record<string, Record<string, string>>>({});
  const [companionEditor, setCompanionEditor] = useState<{
    mode: "all" | "per_color";
    allPercentage: string;
    perColorValues: Record<string, string>;
  } | null>(null);
  const [orderType, setOrderType] = useState<"weight" | "pieces">("pieces");
  const [imgIdx, setImgIdx] = useState(0);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIdx, setViewerIdx] = useState(0);
  const imgWidth = windowWidth - 32;

  const confirmLeave = React.useCallback(() => {
    const has =
      Object.values(selectedColors).some((v) => v > 0) ||
      Object.values(colorWeights).some((v) => v > 0);
    const hasCompanions = Object.values(companionPercentages).some((byMaterial) =>
      Object.values(byMaterial).some((value) => Number(value) > 0)
    );
    if (!has && !hasCompanions) {
      router.back();
      return;
    }
    Alert.alert(
      "تنبيه",
      "اختياراتك من هذا المنتج لن تحفظ",
      [
        { text: "استمرار", style: "cancel" },
        { text: "تأكيد الخروج", style: "destructive", onPress: () => router.back() },
      ]
    );
  }, [selectedColors, colorWeights, companionPercentages]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      confirmLeave();
      return true;
    });
    return () => sub.remove();
  }, [confirmLeave]);

  useEffect(() => {
    const imgs = product?.images ?? [];
    if (imgs.length < 2) return;
    const timer = setInterval(() => {
      setImgIdx((prev) => {
        const next = (prev + 1) % imgs.length;
        imgScrollRef.current?.scrollTo({ x: next * imgWidth, animated: true });
        return next;
      });
    }, 5000);
    return () => clearInterval(timer);
  }, [product?.images?.length, imgWidth]);

  useEffect(() => {
    if (!viewerVisible) return;
    const t = setTimeout(() => {
      viewerScrollRef.current?.scrollTo({ x: viewerIdx * windowWidth, animated: false });
    }, 0);
    return () => clearTimeout(t);
  }, [viewerVisible, viewerIdx, windowWidth]);

  const bottomPad = Platform.OS === "web" ? 34 : Math.max(insets.bottom, Platform.OS === "android" ? 16 : 16);

  if (!product) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <GoldHeader title="المنتج" onBack={() => router.back()} />
        <View style={styles.notFound}>
          <Text style={{ color: colors.mutedForeground, fontFamily: "Cairo_400Regular" }}>
            المنتج غير موجود
          </Text>
        </View>
      </View>
    );
  }

  const displayPrice = displayPriceFor(product, effectivePriceMode);
  const onOffer = effectivePriceMode !== "wholesale" && isOnOffer(product);

  const totalPieces = Object.values(selectedColors).reduce((a, b) => a + b, 0);
  const selectedColorCount = Object.keys(selectedColors).length;

  const totalWeight = Object.values(colorWeights).reduce((a, b) => a + b, 0);
  const weightColorCount = Object.keys(colorWeights).filter((k) => colorWeights[k] > 0).length;

  const addColorPiece = (colorName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedColors((prev) => ({ ...prev, [colorName]: (prev[colorName] ?? 0) + 1 }));
  };

  const removeColorPiece = (colorName: string) => {
    setSelectedColors((prev) => {
      const current = prev[colorName] ?? 0;
      if (current <= 1) {
        const next = { ...prev };
        delete next[colorName];
        return next;
      }
      return { ...prev, [colorName]: current - 1 };
    });
  };

  const addColorWeight = (colorName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setColorWeights((prev) => ({
      ...prev,
      [colorName]: parseFloat(((prev[colorName] ?? 0) + KG_STEP).toFixed(1)),
    }));
  };


  const isStaff = user?.role === "admin" || user?.role === "employee" || user?.role === "supervisor";

  const completeAddToCart = () => {
    if (isStaff) {
      Alert.alert("للعرض فقط", "أعضاء فريق العمل يمكنهم عرض المنتجات فقط ولا يمكنهم الطلب.");
      return;
    }
    if (orderType === "pieces") {
      if (selectedColorCount === 0 || totalPieces === 0) {
        Alert.alert("تنبيه", "الرجاء اختيار لون وتحديد الكمية");
        return;
      }
      const items: CartItem[] = Object.entries(selectedColors).map(([colorName, qty]) => {
        const colorInfo = product.colors.find((c) => c.name === colorName);
        return {
          productId: product.id,
          productName: product.name,
          colorName,
          colorHex: colorInfo?.hex ?? "#CCCCCC",
          quantity: qty,
          unitPrice: displayPrice,
          orderType: "pieces",
          unit: product.unit,
          companions: buildCompanions(colorName, "pieces", qty * (product.unit === "meter" ? 100 : 20)),
        };
      });
      items.forEach(addToCart);
    } else {
      if (weightColorCount === 0 || totalWeight === 0) {
        Alert.alert("تنبيه", "الرجاء تحديد الوزن لكل لون");
        return;
      }
      const minWeight = product.minimumOrderQuantity ?? (product.unit === "meter" ? 100 : 20);
      const unitName = product.unit === "meter" ? "متر" : "كغ";
      const belowMin = Object.entries(colorWeights).filter(([_, w]) => w > 0 && w < minWeight);
      if (belowMin.length > 0) {
        const names = belowMin.map(([c, w]) => `${c}: ${w} ${unitName}`).join("\n");
        Alert.alert("الحد الأدنى", `الحد الأدنى للطلب هو ${minWeight} ${unitName} لكل لون\n\n${names}`);
        return;
      }
      const items: CartItem[] = Object.entries(colorWeights)
        .filter(([_, w]) => w > 0)
        .map(([colorName, w]) => {
          const colorInfo = product.colors.find((c) => c.name === colorName);
          return {
            productId: product.id,
            productName: product.name,
            colorName,
            colorHex: colorInfo?.hex ?? "#CCCCCC",
            quantity: 1,
            unitPrice: displayPrice,
            orderType: "weight",
            weight: w,
            unit: product.unit,
            companions: buildCompanions(colorName, "weight", w),
          };
        });
      items.forEach(addToCart);
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
    showToast("تمت الإضافة إلى السلة ✓");
  };

  const unitLabel = product.unit === "kilo" ? "كيلو" : "متر";
  const companionMaterials = (settings.companionMaterials ?? []).filter(
    (material) => material.inStock && (product.companionMaterialIds ?? []).includes(material.id)
  );
  const companionPrice = (material: (typeof companionMaterials)[number]) =>
    effectivePriceMode === "wholesale" ? material.wholesalePrice : material.retailPrice;
  const minimumOrderQuantity = product.minimumOrderQuantity ?? (product.unit === "meter" ? 100 : 20);
  const buildCompanions = (colorName: string, type: "weight" | "pieces", baseAmount: number) =>
    companionMaterials.flatMap((material) => {
      const maximum = Math.min(100, Math.max(0, material.maxPercentage ?? 100));
      const percentage = Math.min(maximum, Number(companionPercentages[colorName]?.[material.id] ?? 0));
      if (!Number.isFinite(percentage) || percentage <= 0) return [];
      const matchedColor = (material.colors ?? settings.globalColors).find((color) => color.name === colorName);
      const amount = baseAmount * percentage / 100;
      return [{
        materialId: material.id,
        materialName: material.name,
        colorName: matchedColor?.name ?? colorName,
        colorHex: matchedColor?.hex ?? "#CCCCCC",
        percentage,
        orderType: type,
        unit: material.unit,
        unitPrice: companionPrice(material),
        quantity: 1,
        ...(type === "weight" ? { weight: amount } : { actualWeight: amount }),
      }];
    });

  const isColorSelected = (colorName: string) =>
    orderType === "weight"
      ? (colorWeights[colorName] ?? 0) > 0
      : (selectedColors[colorName] ?? 0) > 0;

  const hasCompanionForColor = (colorName: string) =>
    isColorSelected(colorName) &&
    companionMaterials.some((material) => Number(companionPercentages[colorName]?.[material.id] ?? 0) > 0);

  const openCompanionEditor = (_colorName?: string) => {
    const chosenColors = selectedOrderColors;
    if (chosenColors.length === 0) {
      showToast("اختر لوناً وحدد الكمية أولاً لإضافة خامة مرافقة", "error");
      return;
    }

    const firstMaterial = companionMaterials[0];
    const materialId = firstMaterial?.id ?? "default";

    const perColorValues: Record<string, string> = {};
    let allSame = true;
    let firstVal: string | null = null;

    chosenColors.forEach((c) => {
      const val = companionPercentages[c]?.[materialId] ?? "";
      perColorValues[c] = val;
      if (firstVal === null) {
        firstVal = val;
      } else if (firstVal !== val) {
        allSame = false;
      }
    });

    const isAll = allSame && firstVal !== null && firstVal !== "";

    setCompanionEditor({
      mode: isAll ? "all" : "per_color",
      allPercentage: isAll ? (firstVal ?? "") : "",
      perColorValues,
    });
  };

  const handleAddToCart = () => {
    if (isStaff) {
      completeAddToCart();
      return;
    }

    const selectedColorNames =
      orderType === "weight"
        ? Object.entries(colorWeights).filter(([_, weight]) => weight > 0).map(([colorName]) => colorName)
        : Object.entries(selectedColors).filter(([_, quantity]) => quantity > 0).map(([colorName]) => colorName);
    const withoutCompanion = selectedColorNames.filter((colorName) => !hasCompanionForColor(colorName));

    if (companionMaterials.length > 0 && withoutCompanion.length > 0) {
      const companionNames = companionMaterials.map((material) => material.name).join(" و");
      const colorNames = withoutCompanion.join("، ");
      Alert.alert(
        "الخامة المرافقة",
        `عادةً ما يتم طلب ${companionNames} مع ${product.name} للون ${colorNames}.\n\nاضغط على رمز السلسلة بجانب اللون لإضافة الخامة المرافقة.`,
        [
          { text: "المتابعة بدونها", style: "cancel", onPress: completeAddToCart },
          { text: "إضافة خامة مرافقة", onPress: () => openCompanionEditor(withoutCompanion[0]) },
        ]
      );
      return;
    }

    completeAddToCart();
  };

  const selectedOrderColors = orderType === "weight"
    ? Object.entries(colorWeights).filter(([_, weight]) => (weight ?? 0) > 0).map(([name]) => name)
    : Object.entries(selectedColors).filter(([_, quantity]) => (quantity ?? 0) > 0).map(([name]) => name);

  const getColorBaseAmount = (colorName: string): number => {
    if (orderType === "weight") {
      return colorWeights[colorName] ?? 0;
    }
    return (selectedColors[colorName] ?? 0) * (product.unit === "meter" ? 100 : 20);
  };
  const formatCompanionAmount = (amount: number) => {
    const rounded = Number(amount.toFixed(2));
    return Number.isFinite(rounded) ? String(rounded) : "0";
  };

  const colorsSection = (
    <View style={styles.colorsSection}>
      <View
        style={[
          styles.colorsDropdown,
          {
            backgroundColor: colors.surface,
            borderColor: colors.gold,
            borderRadius: colors.radius - 4,
          },
        ]}
      >
        <Icon name="layers" size={18} color={colors.gold} />
        <Text style={[styles.dropdownText, { color: colors.foreground, fontFamily: "Cairo_500Medium" }]}>
          {orderType === "weight"
            ? weightColorCount > 0
              ? `${weightColorCount} لون — ${totalWeight} ${unitLabel}`
              : "اختر الألوان والوزن"
            : selectedColorCount > 0
            ? `${selectedColorCount} لون مختار`
            : "اختر الألوان"}
        </Text>
      </View>

      <View
        style={[
          styles.colorsList,
          { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: colors.radius - 4 },
        ]}
      >
        {displayColors.map((color, idx) => {
            const isLast = idx === displayColors.length - 1;

            if (orderType === "weight") {
              const w = colorWeights[color.name] ?? 0;
              return (
                <View
                  key={color.name}
                  style={[
                    styles.colorRow,
                    { borderBottomColor: colors.border, borderBottomWidth: isLast ? 0 : 1 },
                  ]}
                >
                  <View style={styles.colorRowLeft}>
                    <AppTextInput
                      maxFontSizeMultiplier={1.15}
                      style={[styles.weightInput, {
                        width: weightInputWidth,
                        color: w > 0 ? colors.gold : colors.mutedForeground,
                        backgroundColor: colors.input,
                        borderColor: w > 0 ? colors.gold + "55" : colors.border,
                        fontFamily: "Cairo_700Bold",
                      }]}
                      value={weightTexts[color.name] !== undefined ? weightTexts[color.name] : (w > 0 ? String(w) : "")}
                      placeholder="0"
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType="decimal-pad"
                      textAlign="center"
                      onChangeText={(text) => {
                        if (!/^\d*\.?\d*$/.test(text)) return;
                        setWeightTexts((prev) => ({ ...prev, [color.name]: text }));
                        if (text === "" || text === "0" || text === "0.") {
                          setColorWeights((prev) => {
                            const next = { ...prev };
                            delete next[color.name];
                            return next;
                          });
                          return;
                        }
                        const val = parseFloat(text);
                        if (!isNaN(val) && val > 0) {
                          setColorWeights((prev) => ({ ...prev, [color.name]: val }));
                        }
                      }}
                      onBlur={() => setWeightTexts((prev) => { const n = { ...prev }; delete n[color.name]; return n; })}
                    />
                  </View>
                  <View style={styles.colorRowRight}>
                    <Text numberOfLines={1} maxFontSizeMultiplier={1.15} style={[styles.colorName, { color: colors.foreground, fontFamily: "Cairo_500Medium" }]}>
                      {color.name}
                    </Text>
                     {companionMaterials.length > 0 && (
                       <Pressable
                         onPress={() => openCompanionEditor(color.name)}
                         disabled={w <= 0}
                         hitSlop={6}
                         accessibilityRole="button"
                         accessibilityLabel={`إضافة خامة مرافقة للون ${color.name}`}
                         style={[
                           styles.companionChainButton,
                           {
                             borderColor: hasCompanionForColor(color.name) ? colors.success : colors.border,
                             backgroundColor: hasCompanionForColor(color.name) ? colors.success + "18" : colors.surface,
                             opacity: w > 0 ? 1 : 0.45,
                           },
                         ]}
                       >
                         <Icon
                           name="link"
                           size={16}
                           color={hasCompanionForColor(color.name) ? colors.success : colors.mutedForeground}
                         />
                       </Pressable>
                     )}
                    <Pressable
                      onPress={() => addColorWeight(color.name)}
                      style={[styles.colorRing, w > 0 && { borderColor: colors.gold }]}
                    >
                      <View
                        style={[
                          styles.colorSwatch,
                          {
                            backgroundColor: color.hex,
                            borderColor: colors.border,
                            borderWidth: color.hex === "#FFFFFF" || color.hex === "#FEFEFE" ? 1 : 0,
                          },
                        ]}
                      />
                    </Pressable>
                  </View>
                </View>
              );
            }

            const qty = selectedColors[color.name] ?? 0;
            return (
              <View
                key={color.name}
                style={[
                  styles.colorRow,
                  { borderBottomColor: colors.border, borderBottomWidth: isLast ? 0 : 1 },
                ]}
              >
                <View style={styles.colorRowLeft}>
                  <Pressable
                    onPress={() => addColorPiece(color.name)}
                    style={[styles.qtyBtn, { backgroundColor: colors.gold }]}
                  >
                    <Icon name="plus" size={14} color={colors.background} />
                  </Pressable>
                  {qty > 0 ? (
                    <>
                      <Text style={[styles.qtyText, { color: colors.foreground, fontFamily: "Cairo_700Bold" }]}>
                        {qty}
                      </Text>
                      <Pressable
                        onPress={() => removeColorPiece(color.name)}
                        style={[styles.qtyBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                      >
                        <Icon name="minus" size={14} color={colors.gold} />
                      </Pressable>
                    </>
                  ) : null}
                </View>
                <View style={styles.colorRowRight}>
                  <Text numberOfLines={1} maxFontSizeMultiplier={1.15} style={[styles.colorName, { color: colors.foreground, fontFamily: "Cairo_500Medium" }]}>
                    {color.name}
                  </Text>
                  {companionMaterials.length > 0 && (
                    <Pressable
                      onPress={() => openCompanionEditor(color.name)}
                      disabled={qty <= 0}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel={`إضافة خامة مرافقة للون ${color.name}`}
                      style={[
                        styles.companionChainButton,
                        {
                          borderColor: hasCompanionForColor(color.name) ? colors.success : colors.border,
                          backgroundColor: hasCompanionForColor(color.name) ? colors.success + "18" : colors.surface,
                          opacity: qty > 0 ? 1 : 0.45,
                        },
                      ]}
                    >
                      <Icon
                        name="link"
                        size={16}
                        color={hasCompanionForColor(color.name) ? colors.success : colors.mutedForeground}
                      />
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() => addColorPiece(color.name)}
                    style={[styles.colorRing, qty > 0 && { borderColor: colors.gold }]}
                  >
                    <View
                      style={[
                        styles.colorSwatch,
                        {
                          backgroundColor: color.hex,
                          borderColor: colors.border,
                          borderWidth: color.hex === "#FFFFFF" || color.hex === "#FEFEFE" ? 1 : 0,
                        },
                      ]}
                    />
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>

      {orderType === "weight" && totalWeight > 0 && (
        <View
          style={[
            styles.weightTotalBox,
            { backgroundColor: colors.gold + "11", borderColor: colors.gold + "33", borderRadius: colors.radius - 4 },
          ]}
        >
          <Text style={[styles.weightTotalLabel, { color: colors.mutedForeground, fontFamily: "Cairo_400Regular" }]}>
            إجمالي الوزن
          </Text>
          <Text style={[styles.weightTotalValue, { color: colors.gold, fontFamily: "Cairo_700Bold" }]}>
            {totalWeight} {unitLabel}
          </Text>
          <Text style={[styles.weightTotalPrice, { color: colors.gold, fontFamily: "Cairo_600SemiBold" }]}>
            ≈ {(displayPrice * totalWeight).toFixed(0)} ج.م
          </Text>
        </View>
      )}
    </View>
  );

  const addBtnLabel =
    orderType === "weight"
      ? weightColorCount > 0 && totalWeight > 0
        ? `إضافة للسلة — ${(displayPrice * totalWeight).toFixed(0)} ج.م`
        : "حدد المطلوب من كل لون"
      : totalPieces > 0
      ? `إضافة ${totalPieces} أثواب للسلة`
      : "اختر الألوان والكميات";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GoldHeader
        title={product.name}
        subtitle={product.category}
        onBack={confirmLeave}
        rightElement={
          <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 14 }}>
            {user ? (
              <Pressable
                onPress={() => toggleFavorite(product.id)}
                hitSlop={8}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 4 })}
              >
                <Icon
                  name="heart"
                  size={22}
                  color={favorites.includes(product.id) ? "#E74C3C" : colors.foreground}
                />
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => router.push("/cart")}
              hitSlop={8}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 4 })}
            >
              <Animated.View style={{ transform: [{ scale: cartPulse }] }}>
                <Icon name="shopping-cart" size={22} color={colors.foreground} />
                {cartCount > 0 && (
                  <View
                    style={{
                      position: "absolute",
                      top: -6,
                      left: -8,
                      minWidth: 16,
                      height: 16,
                      borderRadius: 8,
                      paddingHorizontal: 3,
                      backgroundColor: "#E74C3C",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: "#fff", fontSize: 9, fontFamily: "Cairo_700Bold" }}>
                      {cartCount > 9 ? "9+" : cartCount}
                    </Text>
                  </View>
                )}
              </Animated.View>
            </Pressable>
          </View>
        }
      />

      <KeyboardAwareScroll
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 100 }]}
        keyboardShouldPersistTaps="handled"
        androidBehavior="height"
        bottomOffset={120}
      >
        {product.images && product.images.length > 0 ? (
          <View style={[styles.imageCarousel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ScrollView
              ref={imgScrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={16}
              onMomentumScrollEnd={(e) => {
                const offset = e.nativeEvent.contentOffset.x;
                const idx = Math.round(offset / imgWidth);
                setImgIdx(idx);
              }}
              style={{ flex: 1, height: 220 }}
            >
              {product.images.map((uri, i) => (
                <Pressable
                  key={i}
                  onPress={() => {
                    setViewerIdx(i);
                    setViewerVisible(true);
                  }}
                >
                  <Image
                    source={{ uri }}
                    style={{ width: imgWidth, height: 220 }}
                    resizeMode="cover"
                  />
                </Pressable>
              ))}
            </ScrollView>
            {product.images.length > 1 && (
              <View style={styles.imageDots} pointerEvents="none">
                {product.images.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.imageDot,
                      { backgroundColor: i === imgIdx ? colors.gold : "rgba(255,255,255,0.5)" },
                    ]}
                  />
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={[styles.imagePlaceholder, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Icon name="layers" size={60} color={colors.goldDark} />
            <Text style={[styles.category, { color: colors.gold, fontFamily: "Cairo_500Medium" }]}>
              {product.category}
            </Text>
          </View>
        )}

        <View style={styles.priceSection}>
          <View>
            <Text
              style={[styles.priceLabel, { color: colors.mutedForeground, fontFamily: "Cairo_400Regular" }]}
            >
              {user?.role === "merchant" ? "سعر الجملة" : "السعر"}
            </Text>
            {onOffer ? (
              <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <Text style={[styles.price, { color: colors.gold, fontFamily: "Cairo_700Bold" }]}>
                  {displayPrice} ج.م / {product.unit === "kilo" ? "كيلو" : "متر"}
                </Text>
                <Text style={{ color: colors.mutedForeground, fontFamily: "Cairo_500Medium", fontSize: 16, textDecorationLine: "line-through" }}>
                  {product.retailPrice} ج.م
                </Text>
                <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 4, backgroundColor: "#27AE60", paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20 }}>
                  <Icon name="tag" size={12} color="#fff" />
                  <Text style={{ color: "#fff", fontFamily: "Cairo_700Bold", fontSize: 11 }}>خصم {discountPercent(product)}%</Text>
                </View>
              </View>
            ) : (
              <Text style={[styles.price, { color: colors.gold, fontFamily: "Cairo_700Bold" }]}>
                {displayPrice} ج.م / {product.unit === "kilo" ? "كيلو" : "متر"}
              </Text>
            )}
          </View>
          {product.description && (
            <Text
              style={[styles.desc, { color: colors.mutedForeground, fontFamily: "Cairo_400Regular" }]}
            >
              {product.description}
            </Text>
          )}
        </View>

        {(product.width != null || product.gsm != null || (product.composition?.length ?? 0) > 0) && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Cairo_700Bold" }]}>
              مواصفات القماش
            </Text>
            <View style={{ gap: 10 }}>
              {product.width != null && (
                <View style={styles.specLine}>
                  <Text style={[styles.specLabel, { color: colors.mutedForeground, fontFamily: "Cairo_400Regular" }]}>العرض</Text>
                  <Text style={[styles.specValue, { color: colors.foreground, fontFamily: "Cairo_600SemiBold" }]}>{product.width} سم</Text>
                </View>
              )}
              {product.gsm != null && (
                <View style={styles.specLine}>
                  <Text style={[styles.specLabel, { color: colors.mutedForeground, fontFamily: "Cairo_400Regular" }]}>المقطع (GSM)</Text>
                  <Text style={[styles.specValue, { color: colors.foreground, fontFamily: "Cairo_600SemiBold" }]}>{product.gsm} جم/م²</Text>
                </View>
              )}
              {product.unit === "kilo" && metersPerKg(product.gsm, product.width) != null && (
                <View style={styles.specLine}>
                  <Text style={[styles.specLabel, { color: colors.gold, fontFamily: "Cairo_500Medium" }]}>المدّ</Text>
                  <Text style={[styles.specValue, { color: colors.gold, fontFamily: "Cairo_700Bold" }]}>
                    ≈ {(metersPerKg(product.gsm, product.width) as number).toFixed(1)} متر للكيلو
                  </Text>
                </View>
              )}
              {(product.composition?.length ?? 0) > 0 && (
                <View style={[styles.specLine, { alignItems: "flex-start" }]}>
                  <Text style={[styles.specLabel, { color: colors.mutedForeground, fontFamily: "Cairo_400Regular" }]}>التركيب</Text>
                  <View style={{ flex: 1, flexDirection: "row-reverse", flexWrap: "wrap", gap: 6, justifyContent: "flex-start" }}>
                    {product.composition!.map((c, i) => (
                      <View key={i} style={{ flexDirection: "row-reverse", alignItems: "center", gap: 4, backgroundColor: colors.gold + "18", borderColor: colors.gold + "44", borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14 }}>
                        <Text style={{ color: colors.gold, fontFamily: "Cairo_700Bold", fontSize: 12 }}>{c.percent}%</Text>
                        <Text style={{ color: colors.foreground, fontFamily: "Cairo_500Medium", fontSize: 12 }}>{c.yarn}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {!product.inStock && (
          <View
            style={[
              styles.outOfStockBanner,
              { backgroundColor: "#C0392B22", borderColor: "#C0392B66" },
            ]}
          >
            <Icon name="x-circle" size={20} color="#C0392B" />
            <Text style={[styles.outOfStockBannerText, { fontFamily: "Cairo_700Bold" }]}>
              هذا المنتج نفذ من المخزون
            </Text>
          </View>
        )}

        {product.inStock && (
        <View
          style={[
            styles.section,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text
            style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Cairo_700Bold" }]}
          >
            طريقة الطلب
          </Text>
          <View style={styles.orderTypeRow}>
            <Pressable
              onPress={() => setOrderType("pieces")}
              style={({ pressed }) => [
                styles.typeBtn,
                {
                  flex: 1,
                  backgroundColor: orderType === "pieces" ? colors.gold : colors.surface,
                  borderColor: orderType === "pieces" ? colors.gold : colors.border,
                  borderRadius: colors.radius - 4,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.typeBtnText,
                  {
                    color: orderType === "pieces" ? colors.background : colors.foreground,
                    fontFamily: orderType === "pieces" ? "Cairo_600SemiBold" : "Cairo_400Regular",
                  },
                ]}
              >
                ثوب
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                if (orderType === "pieces") {
                  setCompanionPercentages({});
                }
                setOrderType("weight");
              }}
              style={({ pressed }) => [
                styles.typeBtn,
                {
                  flex: 1,
                  backgroundColor: orderType === "weight" ? colors.gold : colors.surface,
                  borderColor: orderType === "weight" ? colors.gold : colors.border,
                  borderRadius: colors.radius - 4,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.typeBtnText,
                  {
                    color: orderType === "weight" ? colors.background : colors.foreground,
                    fontFamily: orderType === "weight" ? "Cairo_600SemiBold" : "Cairo_400Regular",
                  },
                ]}
              >
                {product.unit === "kilo" ? "وزن" : "أمتار"}
              </Text>
            </Pressable>
          </View>

          {colorsSection}
          {orderType === "pieces" && totalPieces > 0 && (
            <View
              style={[
                styles.piecesNote,
                {
                  backgroundColor: colors.gold + "11",
                  borderColor: colors.gold + "33",
                  borderRadius: colors.radius - 4,
                },
              ]}
            >
              <Icon name="info" size={14} color={colors.gold} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  style={[styles.piecesNoteText, { color: colors.mutedForeground, fontFamily: "Cairo_400Regular" }]}
                >
                  {product.unit === "meter" ? "الأمتار التقديرية" : "الوزن التقديري"}: {totalPieces * (product.unit === "meter" ? 100 : 20)} {product.unit === "meter" ? "متر" : "كغ"} — السعر التقديري: ≈ {totalPieces * (product.unit === "meter" ? 100 : 20) * displayPrice} ج.م
                </Text>
                <Text style={{ color: colors.mutedForeground, fontFamily: "Cairo_400Regular", fontSize: 11 }}>
                  ({product.unit === "meter" ? "100 متر" : "20 كغ"} لكل ثوب)
                </Text>
              </View>
            </View>
          )}
        </View>
        )}
      </KeyboardAwareScroll>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            paddingBottom: bottomPad,
            bottom: 0,
            left: 0,
            right: 0,
            position: "absolute",
          },
        ]}
      >
        {product.inStock ? (
          <GoldButton
            label={addBtnLabel}
            onPress={handleAddToCart}
            style={{ flex: 1 }}
            size="lg"
          />
        ) : (
          <View style={[styles.outOfStockFooterBtn, { backgroundColor: "#C0392B22", borderColor: "#C0392B66" }]}>
            <Icon name="x-circle" size={18} color="#C0392B" />
            <Text style={[styles.outOfStockFooterText, { fontFamily: "Cairo_700Bold" }]}>
              غير متوفر — نفذ المخزون
            </Text>
          </View>
        )}
      </View>

      <Modal
        visible={companionEditor !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setCompanionEditor(null)}
      >
        <View style={styles.companionModalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setCompanionEditor(null)}
            accessibilityLabel="إغلاق بطاقة الخامة المرافقة"
          />
          <View
            style={[
              styles.companionModalCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                maxHeight: Math.min(windowHeight * 0.9, 720),
              },
            ]}
          >
            {/* Header */}
            <View style={styles.companionModalHeader}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text
                  style={[
                    styles.companionModalTitle,
                    { color: colors.foreground, fontFamily: "Cairo_700Bold" },
                  ]}
                >
                  الخامة المرافقة
                </Text>
                <Text
                  style={[
                    styles.companionModalSubtitle,
                    { color: colors.mutedForeground, fontFamily: "Cairo_400Regular" },
                  ]}
                >
                  ادخل نسبة كل لون من الخامة المرافقة
                </Text>
              </View>
              <Pressable
                onPress={() => setCompanionEditor(null)}
                hitSlop={10}
                style={[styles.companionModalClose, { backgroundColor: colors.surface }]}
              >
                <Icon name="x" size={18} color={colors.mutedForeground} />
              </Pressable>
            </View>

            {/* Two Options at the top (A8) */}
            {companionEditor && (
              <View style={{ gap: 10 }}>
                {/* Option 1: جميع الألوان */}
                <View
                  style={[
                    styles.companionOptionBox,
                    {
                      backgroundColor:
                        companionEditor.mode === "all" ? colors.gold + "14" : colors.surface,
                      borderColor:
                        companionEditor.mode === "all" ? colors.gold : colors.border,
                    },
                  ]}
                >
                  <Pressable
                    onPress={() => setCompanionEditor((c) => (c ? { ...c, mode: "all" } : c))}
                    style={{ flex: 1, flexDirection: "row-reverse", alignItems: "center", gap: 8 }}
                  >
                    <View
                      style={[
                        styles.radioCircle,
                        {
                          borderColor:
                            companionEditor.mode === "all" ? colors.gold : colors.mutedForeground,
                        },
                      ]}
                    >
                      {companionEditor.mode === "all" && (
                        <View style={[styles.radioInner, { backgroundColor: colors.gold }]} />
                      )}
                    </View>
                    <Text
                      style={{
                        color: colors.foreground,
                        fontFamily: "Cairo_700Bold",
                        fontSize: 14,
                      }}
                    >
                      جميع الألوان
                    </Text>
                  </Pressable>

                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    {(() => {
                      const maxPct = Math.min(
                        100,
                        Math.max(0, companionMaterials[0]?.maxPercentage ?? 100)
                      );
                      const pct = Math.min(maxPct, Number(companionEditor.allPercentage) || 0);
                      const totalBase = selectedOrderColors.reduce(
                        (sum, c) => sum + getColorBaseAmount(c),
                        0
                      );
                      const allWeight = (totalBase * pct) / 100;
                      return allWeight > 0 ? (
                        <Text
                          style={{
                            color: colors.success,
                            fontFamily: "Cairo_700Bold",
                            fontSize: 13,
                          }}
                        >
                          {formatCompanionAmount(allWeight)} كغ
                        </Text>
                      ) : null;
                    })()}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <AppTextInput
                        value={companionEditor.allPercentage}
                        onFocus={() => {
                          if (companionEditor.mode !== "all") {
                            setCompanionEditor((c) => (c ? { ...c, mode: "all" } : c));
                          }
                        }}
                        onChangeText={(value) => {
                          if (!/^\d*([.]\d*)?$/.test(value)) return;
                          const maxPct = Math.min(
                            100,
                            Math.max(0, companionMaterials[0]?.maxPercentage ?? 100)
                          );
                          const num = Number(value);
                          const nextVal =
                            value !== "" && Number.isFinite(num) && num > maxPct
                              ? String(maxPct)
                              : value;
                          setCompanionEditor((c) =>
                            c ? { ...c, mode: "all", allPercentage: nextVal } : c
                          );
                        }}
                        keyboardType="decimal-pad"
                        placeholder="0"
                        placeholderTextColor={colors.mutedForeground}
                        textAlign="center"
                        style={[
                          styles.companionRowInput,
                          {
                            color: colors.foreground,
                            backgroundColor: colors.input,
                            borderColor: colors.border,
                          },
                        ]}
                      />
                      <Text
                        style={{
                          color: colors.mutedForeground,
                          fontFamily: "Cairo_600SemiBold",
                          fontSize: 14,
                        }}
                      >
                        %
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Option 2: تحديد الألوان */}
                <Pressable
                  onPress={() => setCompanionEditor((c) => (c ? { ...c, mode: "per_color" } : c))}
                  style={[
                    styles.companionOptionBox,
                    {
                      backgroundColor:
                        companionEditor.mode === "per_color" ? colors.gold + "14" : colors.surface,
                      borderColor:
                        companionEditor.mode === "per_color" ? colors.gold : colors.border,
                    },
                  ]}
                >
                  <View
                    style={{ flex: 1, flexDirection: "row-reverse", alignItems: "center", gap: 8 }}
                  >
                    <View
                      style={[
                        styles.radioCircle,
                        {
                          borderColor:
                            companionEditor.mode === "per_color"
                              ? colors.gold
                              : colors.mutedForeground,
                        },
                      ]}
                    >
                      {companionEditor.mode === "per_color" && (
                        <View style={[styles.radioInner, { backgroundColor: colors.gold }]} />
                      )}
                    </View>
                    <Text
                      style={{
                        color: colors.foreground,
                        fontFamily: "Cairo_700Bold",
                        fontSize: 14,
                      }}
                    >
                      تحديد الألوان
                    </Text>
                  </View>
                </Pressable>
              </View>
            )}

            {/* Per-color list (Option 2) */}
            {companionEditor && companionEditor.mode === "per_color" && (
              <ScrollView
                style={{ maxHeight: 260, flexShrink: 1 }}
                contentContainerStyle={{ gap: 4, paddingVertical: 2 }}
                nestedScrollEnabled={true}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={true}
              >
                {selectedOrderColors.map((colorName) => {
                  const color = product.colors.find((item) => item.name === colorName);
                  const maxPct = Math.min(
                    100,
                    Math.max(0, companionMaterials[0]?.maxPercentage ?? 100)
                  );
                  const pctVal = companionEditor.perColorValues[colorName] ?? "";
                  const pct = Math.min(maxPct, Number(pctVal) || 0);
                  const colorWeight = (getColorBaseAmount(colorName) * pct) / 100;

                  return (
                    <View
                      key={colorName}
                      style={[styles.companionColorRow, { borderBottomColor: colors.border }]}
                    >
                      {/* Physical Left: Color Swatch + Name */}
                      <View style={styles.companionColorRowLeft}>
                        <View
                          style={[
                            styles.colorSwatch,
                            {
                              width: 18,
                              height: 18,
                              borderRadius: 9,
                              backgroundColor: color?.hex ?? "#ccc",
                              borderColor: colors.border,
                              borderWidth:
                                color?.hex === "#FFFFFF" || color?.hex === "#FEFEFE" ? 1 : 0,
                            },
                          ]}
                        />
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.companionColorRowName,
                            { color: colors.foreground, fontFamily: "Cairo_600SemiBold" },
                          ]}
                        >
                          {colorName}
                        </Text>
                      </View>

                      {/* Physical Right: Weight + Percentage Input + % */}
                      <View style={styles.companionColorRowRight}>
                        {colorWeight > 0 ? (
                          <Text
                            style={[
                              styles.companionColorRowWeight,
                              { color: colors.success, fontFamily: "Cairo_700Bold" },
                            ]}
                          >
                            {formatCompanionAmount(colorWeight)} كغ
                          </Text>
                        ) : null}
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <AppTextInput
                            value={pctVal}
                            onChangeText={(value) => {
                              if (!/^\d*([.]\d*)?$/.test(value)) return;
                              const num = Number(value);
                              const nextVal =
                                value !== "" && Number.isFinite(num) && num > maxPct
                                  ? String(maxPct)
                                  : value;
                              setCompanionEditor((c) =>
                                c
                                  ? {
                                      ...c,
                                      perColorValues: {
                                        ...c.perColorValues,
                                        [colorName]: nextVal,
                                      },
                                    }
                                  : c
                              );
                            }}
                            keyboardType="decimal-pad"
                            placeholder="0"
                            placeholderTextColor={colors.mutedForeground}
                            textAlign="center"
                            style={[
                              styles.companionRowInput,
                              {
                                color: colors.foreground,
                                backgroundColor: colors.input,
                                borderColor: colors.border,
                              },
                            ]}
                          />
                          <Text
                            style={{
                              color: colors.mutedForeground,
                              fontFamily: "Cairo_600SemiBold",
                              fontSize: 14,
                            }}
                          >
                            %
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}

            {/* Total Weight at the bottom (A4) */}
            {companionEditor && (
              <View style={[styles.companionTotalRow, { borderTopColor: colors.border }]}>
                <Text
                  style={[
                    styles.companionTotalLabel,
                    { color: colors.foreground, fontFamily: "Cairo_700Bold" },
                  ]}
                >
                  الوزن الإجمالي
                </Text>
                {(() => {
                  const maxPct = Math.min(
                    100,
                    Math.max(0, companionMaterials[0]?.maxPercentage ?? 100)
                  );
                  let totalW = 0;
                  if (companionEditor.mode === "all") {
                    const pct = Math.min(maxPct, Number(companionEditor.allPercentage) || 0);
                    const totalBase = selectedOrderColors.reduce(
                      (sum, c) => sum + getColorBaseAmount(c),
                      0
                    );
                    totalW = (totalBase * pct) / 100;
                  } else {
                    selectedOrderColors.forEach((c) => {
                      const pct = Math.min(
                        maxPct,
                        Number(companionEditor.perColorValues[c]) || 0
                      );
                      totalW += (getColorBaseAmount(c) * pct) / 100;
                    });
                  }
                  return (
                    <Text
                      style={[
                        styles.companionTotalValue,
                        { color: colors.success, fontFamily: "Cairo_700Bold" },
                      ]}
                    >
                      {formatCompanionAmount(totalW)} كغ
                    </Text>
                  );
                })()}
              </View>
            )}

            {/* Actions: Cancel & Save */}
            <View style={styles.companionModalActions}>
              <Pressable
                onPress={() => setCompanionEditor(null)}
                style={[
                  styles.companionModalButton,
                  styles.companionModalCancel,
                  { borderColor: colors.border, backgroundColor: colors.surface },
                ]}
              >
                <Text
                  style={[
                    styles.companionModalButtonText,
                    { color: colors.mutedForeground, fontFamily: "Cairo_600SemiBold" },
                  ]}
                >
                  إلغاء
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (!companionEditor) return;
                  const materialId = companionMaterials[0]?.id;
                  if (!materialId) {
                    setCompanionEditor(null);
                    return;
                  }
                  setCompanionPercentages((current) => {
                    const next = { ...current };
                    const maxPct = Math.min(
                      100,
                      Math.max(0, companionMaterials[0]?.maxPercentage ?? 100)
                    );

                    if (companionEditor.mode === "all") {
                      const val = companionEditor.allPercentage.trim();
                      const numVal = Math.min(maxPct, Number(val) || 0);
                      selectedOrderColors.forEach((colorName) => {
                        if (val && numVal > 0) {
                          next[colorName] = {
                            ...(next[colorName] ?? {}),
                            [materialId]: String(numVal),
                          };
                        } else {
                          if (next[colorName]) {
                            delete next[colorName][materialId];
                            if (Object.keys(next[colorName]).length === 0) delete next[colorName];
                          }
                        }
                      });
                    } else {
                      selectedOrderColors.forEach((colorName) => {
                        const val = (companionEditor.perColorValues[colorName] ?? "").trim();
                        const numVal = Math.min(maxPct, Number(val) || 0);
                        if (val && numVal > 0) {
                          next[colorName] = {
                            ...(next[colorName] ?? {}),
                            [materialId]: String(numVal),
                          };
                        } else {
                          if (next[colorName]) {
                            delete next[colorName][materialId];
                            if (Object.keys(next[colorName]).length === 0) delete next[colorName];
                          }
                        }
                      });
                    }
                    return next;
                  });
                  setCompanionEditor(null);
                }}
                style={[styles.companionModalButton, { backgroundColor: colors.success }]}
              >
                <Text
                  style={[
                    styles.companionModalButtonText,
                    { color: "#fff", fontFamily: "Cairo_700Bold" },
                  ]}
                >
                  حفظ الخامة المرافقة
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={viewerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerVisible(false)}
      >
        <View style={styles.viewerBackdrop}>
          <Pressable
            style={[styles.viewerClose, { top: insets.top + 12 }]}
            onPress={() => setViewerVisible(false)}
            hitSlop={12}
          >
            <Icon name="x" size={24} color="#fff" />
          </Pressable>
          <ScrollView
            ref={viewerScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onLayout={() =>
              viewerScrollRef.current?.scrollTo({ x: viewerIdx * windowWidth, animated: false })
            }
          >
            {(product.images ?? []).map((uri, i) => (
              <Pressable
                key={i}
                style={{ width: windowWidth, height: windowHeight, justifyContent: "center" }}
                onPress={() => setViewerVisible(false)}
              >
                <Image
                  source={{ uri }}
                  style={{ width: windowWidth, height: windowHeight }}
                  resizeMode="contain"
                />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  viewerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
  },
  viewerClose: {
    position: "absolute",
    right: 16,
    zIndex: 10,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  content: { gap: 16, padding: 16 },
  notFound: { flex: 1, alignItems: "center", justifyContent: "center" },
  imageCarousel: {
    height: 220,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
  },
  imageDots: {
    position: "absolute",
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  imageDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  imagePlaceholder: {
    height: 220,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  category: { fontSize: 14, letterSpacing: 1 },
  priceSection: { gap: 10 },
  priceLabel: { fontSize: 12, textAlign: "right" },
  price: { fontSize: 24, textAlign: "right" },
  desc: { fontSize: 14, textAlign: "right", lineHeight: 22 },
  section: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 14 },
  sectionTitle: { fontSize: 16, textAlign: "right" },
  specLine: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 10 },
  companionColorBox: { borderWidth: 1, borderRadius: 10, padding: 10, gap: 10 },
  companionRow: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  companionInput: { width: 70, borderWidth: 1, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 6, fontSize: 14 },
  companionChainButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  companionModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.48)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  companionOptionBox: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  companionRowInput: {
    width: 60,
    minHeight: 38,
    height: 38,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 4,
    fontSize: 15,
    fontFamily: "Cairo_700Bold",
  },
  companionColorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  companionColorRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
    marginRight: 8,
  },
  companionColorRowName: {
    fontSize: 14,
  },
  companionColorRowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  companionColorRowWeight: {
    fontSize: 13,
  },
  companionTotalRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 1,
  },
  companionTotalLabel: {
    fontSize: 14,
  },
  companionTotalValue: {
    fontSize: 15,
  },
  companionModalCard: {
    width: "100%",
    maxWidth: 430,
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    gap: 16,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  companionModalHeader: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 12 },
  companionModalTitle: { fontSize: 20, textAlign: "right" },
  companionModalSubtitle: { fontSize: 13, textAlign: "right" },
  companionModalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  companionModalColor: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  companionModalColorText: { flex: 1, textAlign: "right", fontSize: 15 },
  companionTargetsRow: { flexDirection: "row-reverse", gap: 8, paddingVertical: 2 },
  companionTargetChip: { minHeight: 36, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 10, borderRadius: 18, borderWidth: 1 },
  companionTargetText: { fontSize: 12 },
  companionModalMaterial: { gap: 8 },
  companionModalMaterialName: { textAlign: "right", fontSize: 14 },
  companionModalInputRow: { flexDirection: "row-reverse", alignItems: "center", gap: 8 },
  companionModalInput: { flex: 1, minHeight: 46, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 16 },
  companionModalPercent: { fontSize: 15 },
  companionModalAmount: { textAlign: "right", fontSize: 13 },
  companionModalLimit: { textAlign: "right", fontSize: 11 },
  companionModalActions: { flexDirection: "row-reverse", gap: 10, marginTop: 2 },
  companionModalButton: { flex: 1, minHeight: 46, borderRadius: 11, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  companionModalCancel: { borderWidth: 1 },
  companionModalButtonText: { fontSize: 13, textAlign: "center" },
  specLabel: { fontSize: 13 },
  specValue: { fontSize: 14 },
  orderTypeRow: { flexDirection: "row-reverse", gap: 10 },
  typeBtn: { paddingVertical: 12, alignItems: "center", borderWidth: 1 },
  typeBtnText: { fontSize: 14 },
  colorsSection: { gap: 10 },
  colorsDropdown: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    gap: 10,
  },
  dropdownText: { flex: 1, fontSize: 14 },
  colorsList: { borderWidth: 1, overflow: "hidden" },
  colorRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  colorRowRight: { flexDirection: "row-reverse", alignItems: "center", gap: 8, flex: 1 },
  colorRowLeft: { flexDirection: "row-reverse", alignItems: "center", gap: 6 },
  colorSwatch: { width: 30, height: 30, borderRadius: 15 },
  colorRing: {
    padding: 2,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  colorName: { fontSize: 13, flex: 1, flexShrink: 1, textAlign: "right" },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  qtyText: { fontSize: 15, minWidth: 22, textAlign: "center" },
  weightInput: {
    fontSize: 16,
    width: 104,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    textAlign: "center",
    textAlignVertical: "center",
  },
  weightTotalBox: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderWidth: 1,
    gap: 10,
  },
  weightTotalLabel: { fontSize: 12 },
  weightTotalValue: { fontSize: 16, flex: 1, textAlign: "center" },
  weightTotalPrice: { fontSize: 15 },
  piecesNote: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderWidth: 1,
  },
  piecesNoteText: { fontSize: 12, textAlign: "right" },
  footer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, borderTopWidth: 1 },
  outOfStockBanner: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  outOfStockBannerText: {
    color: "#C0392B",
    fontSize: 15,
    flex: 1,
    textAlign: "right",
  },
  outOfStockFooterBtn: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  outOfStockFooterText: {
    color: "#C0392B",
    fontSize: 15,
  },
});
