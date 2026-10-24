import AppTextInput from "@/components/AppTextInput";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Animated,
  FlatList,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import Icon from "@/components/Icon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useCartPulse } from "@/hooks/useCartPulse";
import { useTranslation } from "@/lib/i18n";
import { sortColorsByGlobal } from "@/lib/colorUtils";
import { discountPercent, displayPriceFor, isOnOffer } from "@/lib/pricing";
import { cardShadow } from "@/constants/shadows";
import type { Product } from "@/context/AppContext";

const VIEW_MODE_STORAGE_KEY = "@shamstex/products_view_mode";

// -------------------------------------------------------------
// Row View Card (Talabat-style: Image on the right, details on the left)
// -------------------------------------------------------------
function ProductRowCard({ product, onPress }: { product: Product; onPress: () => void }) {
  const colors = useColors();
  const { effectivePriceMode, user, favorites, toggleFavorite, settings } = useApp();
  const fav = favorites.includes(product.id);
  const specsText = [
    product.width != null ? `عرض ${product.width}سم` : null,
    product.gsm != null ? `${product.gsm} جم/م²` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const displayPrice = displayPriceFor(product, effectivePriceMode);
  const onOffer = effectivePriceMode !== "wholesale" && isOnOffer(product);
  const offerPct = discountPercent(product);
  const isOutOfStock = !product.inStock;

  return (
    <View
      style={[
        styles.rowCardShadow,
        {
          backgroundColor: colors.surface,
          borderRadius: colors.radius,
        },
        cardShadow(colors.isDark, "soft"),
      ]}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.rowCard,
          {
            backgroundColor: colors.surface,
            borderColor: isOutOfStock ? "#C0392B66" : colors.border,
            borderRadius: colors.radius,
            opacity: pressed ? 0.9 : 1,
          },
        ]}
      >
        {/* Right side: Image thumbnail */}
        <View style={styles.rowImageWrap}>
          {product.images.length > 0 ? (
            <Image source={{ uri: product.images[0] }} style={styles.rowImage} resizeMode="cover" />
          ) : (
            <View style={[styles.rowPlaceholderImage, { backgroundColor: colors.input }]}>
              <Icon name="layers" size={28} color={isOutOfStock ? "#C0392B88" : colors.goldDark} />
            </View>
          )}

          {product.priceMenuNew && (
            <View style={styles.rowNewBadge} pointerEvents="none">
              <Text style={styles.rowNewBadgeText}>NEW</Text>
            </View>
          )}

          {isOutOfStock && (
            <View style={styles.rowOutOfStockBadge}>
              <Text style={styles.rowOutOfStockText}>نفذ المخزون</Text>
            </View>
          )}

          {!isOutOfStock && onOffer && (
            <View style={styles.rowOfferBadge} pointerEvents="none">
              <Text style={styles.rowOfferText}>خصم {offerPct}%</Text>
            </View>
          )}
        </View>

        {/* Left side: Product Info */}
        <View style={styles.rowInfoWrap}>
          {/* Top line: Category & Favorite */}
          <View style={styles.rowTopLine}>
            <View style={[styles.rowCatPill, { backgroundColor: colors.gold + "18" }]}>
              <Text style={[styles.rowCatText, { color: colors.goldLight }]} numberOfLines={1}>
                {product.category}
              </Text>
            </View>
            {user && (
              <Pressable
                onPress={() => toggleFavorite(product.id)}
                hitSlop={10}
                style={styles.rowFavBtn}
              >
                <Icon name="heart" size={18} color={fav ? "#E74C3C" : colors.mutedForeground} />
              </Pressable>
            )}
          </View>

          {/* Name */}
          <Text style={[styles.rowName, { color: colors.foreground }]} numberOfLines={2}>
            {product.name}
          </Text>

          {/* Specs */}
          {!!specsText && (
            <Text style={[styles.rowSpecs, { color: colors.mutedForeground }]} numberOfLines={1}>
              {specsText}
            </Text>
          )}

          {/* Bottom line: Colors & Price */}
          <View style={styles.rowBottomLine}>
            {/* Colors */}
            <View style={styles.rowColorsWrap}>
              {sortColorsByGlobal(product.colors, settings?.globalColors).slice(0, 4).map((c, i) => (
                <View
                  key={i}
                  style={[
                    styles.rowColorDot,
                    {
                      backgroundColor: c.hex,
                      borderColor: "rgba(150,150,150,0.5)",
                      borderWidth: c.hex === "#FFFFFF" || c.hex === "#FEFEFE" ? 1 : 0,
                    },
                  ]}
                />
              ))}
              {product.colors.length > 4 && (
                <Text style={[styles.rowMoreColors, { color: colors.mutedForeground }]}>
                  +{product.colors.length - 4}
                </Text>
              )}
            </View>

            {/* Price */}
            <View style={styles.rowPriceWrap}>
              {onOffer ? (
                <View style={styles.rowPriceCol}>
                  <Text style={styles.rowOldPrice}>{product.retailPrice}</Text>
                  <Text style={[styles.rowPrice, { color: colors.goldLight }]}>
                    {displayPrice} ج.م
                  </Text>
                </View>
              ) : (
                <Text style={[styles.rowPrice, { color: colors.goldLight }]}>
                  {displayPrice} ج.م
                </Text>
              )}
            </View>
          </View>
        </View>
      </Pressable>
    </View>
  );
}

// -------------------------------------------------------------
// Grid View Card (2-column: Image on top, details below)
// -------------------------------------------------------------
function ProductGridCard({ product, onPress }: { product: Product; onPress: () => void }) {
  const colors = useColors();
  const { effectivePriceMode, user, favorites, toggleFavorite, settings } = useApp();
  const fav = favorites.includes(product.id);
  const specsText = [
    product.width != null ? `عرض ${product.width}سم` : null,
    product.gsm != null ? `${product.gsm} جم/م²` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const displayPrice = displayPriceFor(product, effectivePriceMode);
  const onOffer = effectivePriceMode !== "wholesale" && isOnOffer(product);
  const offerPct = discountPercent(product);
  const isOutOfStock = !product.inStock;

  return (
    <View
      style={[
        styles.gridCardShadow,
        {
          backgroundColor: colors.surface,
          borderRadius: colors.radius,
        },
        cardShadow(colors.isDark, "soft"),
      ]}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.gridCard,
          {
            backgroundColor: colors.surface,
            borderColor: isOutOfStock ? "#C0392B66" : colors.border,
            borderRadius: colors.radius,
            opacity: pressed ? 0.9 : 1,
          },
        ]}
      >
        {/* Top: Image */}
        <View style={styles.gridImageWrap}>
          {product.images.length > 0 ? (
            <Image source={{ uri: product.images[0] }} style={styles.gridImage} resizeMode="cover" />
          ) : (
            <View style={[styles.gridPlaceholderImage, { backgroundColor: colors.input }]}>
              <Icon name="layers" size={32} color={isOutOfStock ? "#C0392B88" : colors.goldDark} />
            </View>
          )}

          {product.priceMenuNew && (
            <View style={styles.gridNewBadge} pointerEvents="none">
              <Text style={styles.gridNewBadgeText}>NEW</Text>
            </View>
          )}

          {isOutOfStock && (
            <View style={styles.gridOutOfStockBadge}>
              <Text style={styles.gridOutOfStockText}>نفذ المخزون</Text>
            </View>
          )}

          {!isOutOfStock && onOffer && (
            <View style={styles.gridOfferBadge} pointerEvents="none">
              <Text style={styles.gridOfferText}>خصم {offerPct}%</Text>
            </View>
          )}

          {user && (
            <Pressable
              onPress={() => toggleFavorite(product.id)}
              hitSlop={8}
              style={styles.gridFavBtn}
            >
              <Icon name="heart" size={17} color={fav ? "#E74C3C" : "#fff"} />
            </Pressable>
          )}
        </View>

        {/* Bottom: Details */}
        <View style={styles.gridInfoWrap}>
          <Text style={[styles.gridCatText, { color: colors.goldLight }]} numberOfLines={1}>
            {product.category}
          </Text>

          <Text style={[styles.gridName, { color: colors.foreground }]} numberOfLines={2}>
            {product.name}
          </Text>

          {!!specsText && (
            <Text style={[styles.gridSpecs, { color: colors.mutedForeground }]} numberOfLines={1}>
              {specsText}
            </Text>
          )}

          {/* Price Line */}
          <View style={styles.gridPriceLine}>
            {onOffer ? (
              <View style={styles.gridPriceCol}>
                <Text style={styles.gridOldPrice}>{product.retailPrice}</Text>
                <Text style={[styles.gridPrice, { color: colors.goldLight }]}>
                  {displayPrice} ج.م
                </Text>
              </View>
            ) : (
              <Text style={[styles.gridPrice, { color: colors.goldLight }]}>
                {displayPrice} ج.م
              </Text>
            )}
          </View>

          {/* Colors */}
          <View style={styles.gridColorsRow}>
            {sortColorsByGlobal(product.colors, settings?.globalColors).slice(0, 4).map((c, i) => (
              <View
                key={i}
                style={[
                  styles.gridColorDot,
                  {
                    backgroundColor: c.hex,
                    borderColor: "rgba(150,150,150,0.5)",
                    borderWidth: c.hex === "#FFFFFF" || c.hex === "#FEFEFE" ? 1 : 0,
                  },
                ]}
              />
            ))}
            {product.colors.length > 4 && (
              <Text style={[styles.gridMoreColors, { color: colors.mutedForeground }]}>
                +{product.colors.length - 4}
              </Text>
            )}
          </View>
        </View>
      </Pressable>
    </View>
  );
}

// -------------------------------------------------------------
// Main ProductsScreen
// -------------------------------------------------------------
export default function ProductsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { products, user, cart, settings, pricingView, setPricingView, canTogglePricing, effectivePriceMode, favorites } = useApp();
  const cartCount = cart.length;
  const cartPulse = useCartPulse(cartCount);
  const { t, isRTL } = useTranslation();
  const CATEGORIES = settings.categories.length > 0 ? settings.categories : [isRTL ? "الكل" : "All"];
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState(isRTL ? "الكل" : "All");
  const [activeSubcategory, setActiveSubcategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  useEffect(() => {
    AsyncStorage.getItem(VIEW_MODE_STORAGE_KEY)
      .then((saved) => {
        if (saved === "grid" || saved === "list") {
          setViewMode(saved);
        }
      })
      .catch(() => {});
  }, []);

  const handleToggleViewMode = useCallback(() => {
    setViewMode((prev) => {
      const next = prev === "grid" ? "list" : "grid";
      AsyncStorage.setItem(VIEW_MODE_STORAGE_KEY, next).catch(() => {});
      return next;
    });
  }, []);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const subcategoriesForActive: string[] = useMemo(
    () => activeCategory !== "الكل"
      ? (settings.subcategories ?? {})[activeCategory] ?? []
      : [],
    [activeCategory, settings.subcategories]
  );

  const filtered = useMemo(() => products.filter((p) => {
      const matchCategory = activeCategory === "الكل" || p.category === activeCategory;
      if (!matchCategory) return false;
      if (activeSubcategory && p.subcategory !== activeSubcategory) return false;
      const matchSearch = !search || p.name.includes(search) || p.category.includes(search);
      return matchSearch;
    }), [products, activeCategory, activeSubcategory, search]);

  const handleProductPress = useCallback((productId: string) => {
    router.push(`/product/${productId}`);
  }, []);

  const renderProduct = useCallback(
    ({ item }: { item: Product }) => {
      if (viewMode === "grid") {
        return (
          <ProductGridCard
            product={item}
            onPress={() => handleProductPress(item.id)}
          />
        );
      }
      return (
        <ProductRowCard
          product={item}
          onPress={() => handleProductPress(item.id)}
        />
      );
    },
    [viewMode, handleProductPress]
  );

  const handleCategoryPress = (cat: string) => {
    setActiveCategory(cat);
    setActiveSubcategory(null);
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
          style={[styles.title, { color: colors.foreground, fontFamily: "Cairo_700Bold" }]}
        >
          {t("products")}
        </Text>
        <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 8 }}>
          {/* Cart button for customers/merchants */}
          {(user?.role === "customer" || user?.role === "merchant") && (
            <Pressable
              onPress={() => router.push("/cart")}
              style={({ pressed }) => [styles.cartHeaderBtn, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Animated.View style={[styles.cartHeaderIconWrap, { transform: [{ scale: cartPulse }] }]}>
                <Icon name="shopping-cart" size={22} color={colors.foreground} />
                {cartCount > 0 && (
                  <View style={[styles.cartBadge, { backgroundColor: "#E74C3C" }]}>
                    <Text style={[styles.cartBadgeText, { color: "#fff" }]}>
                      {cartCount > 99 ? "99+" : cartCount}
                    </Text>
                  </View>
                )}
              </Animated.View>
            </Pressable>
          )}
          {/* Favorites button for customers/merchants */}
          {(user?.role === "customer" || user?.role === "merchant") && (
            <Pressable
              onPress={() => router.push("/favorites")}
              style={({ pressed }) => [styles.cartHeaderBtn, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Icon name="heart" size={22} color={colors.foreground} />
              {favorites.length > 0 && (
                <View style={[styles.cartBadge, { backgroundColor: colors.gold, top: -5, right: -4 }]}>
                  <Text style={[styles.cartBadgeText, { color: colors.background }]}>
                    {favorites.length}
                  </Text>
                </View>
              )}
            </Pressable>
          )}
          {/* Add product button for admin/employee */}
          {(user?.role === "admin" || user?.role === "employee") && (
            <Pressable
              onPress={() => router.push("/admin/add-product")}
              style={({ pressed }) => [
                styles.addBtn,
                {
                  backgroundColor: colors.gold,
                  borderRadius: colors.radius - 4,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Icon name="plus" size={18} color={colors.background} />
            </Pressable>
          )}
        </View>
      </View>

      <FlatList
        key={viewMode}
        numColumns={viewMode === "grid" ? 2 : 1}
        columnWrapperStyle={viewMode === "grid" ? styles.gridColWrap : undefined}
        data={filtered}
        renderItem={renderProduct}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View
            style={[
              styles.searchWrapper,
              {
                backgroundColor: colors.surface,
                borderBottomColor: colors.border,
                marginHorizontal: -16,
                marginTop: -16,
              },
            ]}
          >
            {canTogglePricing && (
              <View style={{ flexDirection: "row-reverse", gap: 6, paddingHorizontal: 16, paddingTop: 10, alignItems: "center" }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: "Cairo_500Medium" }}>
                  عرض الأسعار:
                </Text>
                {([
                  { v: "wholesale", l: "تجار" },
                  { v: "retail", l: "عملاء" },
                ] as const).map((opt) => {
                  const active = effectivePriceMode === opt.v;
                  return (
                    <Pressable
                      key={opt.v}
                      onPress={() => setPricingView(opt.v)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 5,
                        borderRadius: 14,
                        borderWidth: 1,
                        backgroundColor: active ? colors.gold + "33" : "transparent",
                        borderColor: active ? colors.gold : colors.border,
                      }}
                    >
                      <Text style={{
                        color: active ? colors.gold : colors.mutedForeground,
                        fontFamily: active ? "Cairo_600SemiBold" : "Cairo_400Regular",
                        fontSize: 12,
                      }}>
                        {opt.l}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {/* Search row with view mode toggle button */}
            <View style={styles.searchRow}>
              <View
                style={[
                  styles.searchBar,
                  {
                    backgroundColor: colors.input,
                    borderColor: colors.border,
                    borderRadius: colors.radius,
                  },
                ]}
              >
                <Icon name="search" size={18} color={colors.mutedForeground} />
                <AppTextInput
                  style={[styles.searchInput, { color: colors.foreground, fontFamily: "Cairo_400Regular" }]}
                  placeholder={t("searchProducts")}
                  placeholderTextColor={colors.mutedForeground}
                  value={search}
                  onChangeText={setSearch}
                  textAlign="right"
                />
              </View>
              <Pressable
                onPress={handleToggleViewMode}
                style={({ pressed }) => [
                  styles.viewToggleBtn,
                  {
                    backgroundColor: colors.input,
                    borderColor: colors.border,
                    borderRadius: colors.radius,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
                hitSlop={6}
                accessibilityLabel="تغيير طريقة العرض"
              >
                <Icon
                  name={viewMode === "grid" ? "list" : "grid"}
                  size={20}
                  color={colors.gold}
                />
              </Pressable>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.catScroll}
            >
              {CATEGORIES.map((cat) => (
                <Pressable
                  key={cat}
                  onPress={() => handleCategoryPress(cat)}
                  style={({ pressed }) => [
                    styles.catChip,
                    {
                      backgroundColor: activeCategory === cat ? colors.gold : colors.surface,
                      borderColor: activeCategory === cat ? colors.gold : colors.border,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.catText,
                      {
                        color: activeCategory === cat ? colors.background : colors.foreground,
                        fontFamily: activeCategory === cat ? "Cairo_600SemiBold" : "Cairo_400Regular",
                      },
                    ]}
                  >
                    {cat}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {subcategoriesForActive.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.subCatScroll}
              >
                {subcategoriesForActive.map((sub) => (
                  <Pressable
                    key={sub}
                    onPress={() => setActiveSubcategory(sub)}
                    style={({ pressed }) => [
                      styles.subCatChip,
                      {
                        backgroundColor: activeSubcategory === sub ? colors.gold + "33" : "transparent",
                        borderColor: activeSubcategory === sub ? colors.gold : colors.border,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.subCatText, {
                      color: activeSubcategory === sub ? colors.gold : colors.mutedForeground,
                      fontFamily: activeSubcategory === sub ? "Cairo_600SemiBold" : "Cairo_400Regular",
                    }]}>
                      {sub}
                    </Text>
                  </Pressable>
                ))}
                <Pressable
                  onPress={() => setActiveSubcategory(null)}
                  style={({ pressed }) => [
                    styles.subCatChip,
                    {
                      backgroundColor: !activeSubcategory ? colors.gold + "33" : "transparent",
                      borderColor: !activeSubcategory ? colors.gold : colors.border,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.subCatText, {
                    color: !activeSubcategory ? colors.gold : colors.mutedForeground,
                    fontFamily: !activeSubcategory ? "Cairo_600SemiBold" : "Cairo_400Regular",
                  }]}>
                    {t("allCategories")}
                  </Text>
                </Pressable>
              </ScrollView>
            )}
          </View>
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.list, { paddingBottom: bottomPad + 100 }]}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews={Platform.OS !== "web"}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="layers" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Cairo_500Medium" }]}>
              {t("noProducts")}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 22,
  },
  addBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  cartHeaderBtn: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  cartHeaderIconWrap: { position: "relative", width: 24, height: 24, overflow: "visible" },
  cartBadge: {
    position: "absolute",
    top: -10,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  cartBadgeText: { fontSize: 10, fontFamily: "Cairo_700Bold" },
  searchWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: 1,
  },
  searchRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingHorizontal: 14,
    height: 46,
    borderWidth: 1,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    height: "100%",
  },
  viewToggleBtn: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  catScroll: {
    gap: 8,
    flexDirection: "row-reverse",
    flexGrow: 1,
    justifyContent: "flex-start",
  },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  catText: {
    fontSize: 13,
  },
  subCatScroll: {
    gap: 8,
    flexDirection: "row-reverse",
    flexGrow: 1,
    justifyContent: "flex-start",
  },
  subCatChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
  },
  subCatText: {
    fontSize: 11,
  },
  list: {
    padding: 14,
  },
  gridColWrap: {
    justifyContent: "space-between",
  },
  empty: {
    alignItems: "center",
    paddingTop: 80,
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
  },

  // Row Card (Talabat Style)
  rowCardShadow: {
    marginBottom: 12,
  },
  rowCard: {
    flexDirection: "row-reverse",
    borderWidth: 1,
    overflow: "hidden",
    padding: 10,
    gap: 12,
  },
  rowImageWrap: {
    width: 108,
    height: 108,
    borderRadius: 10,
    overflow: "hidden",
    position: "relative",
    flexShrink: 0,
  },
  rowImage: {
    width: "100%",
    height: "100%",
  },
  rowPlaceholderImage: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  rowNewBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "#D32F2F",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderBottomLeftRadius: 8,
  },
  rowNewBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontFamily: "Cairo_700Bold",
  },
  rowOutOfStockBadge: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(192, 57, 43, 0.9)",
    paddingVertical: 2,
    alignItems: "center",
  },
  rowOutOfStockText: {
    color: "#fff",
    fontSize: 9,
    fontFamily: "Cairo_700Bold",
  },
  rowOfferBadge: {
    position: "absolute",
    top: 0,
    left: 0,
    backgroundColor: "#27AE60",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderBottomRightRadius: 8,
  },
  rowOfferText: {
    color: "#fff",
    fontSize: 9,
    fontFamily: "Cairo_700Bold",
  },
  rowInfoWrap: {
    flex: 1,
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  rowTopLine: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowCatPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  rowCatText: {
    fontSize: 10,
    fontFamily: "Cairo_600SemiBold",
  },
  rowFavBtn: {
    padding: 2,
  },
  rowName: {
    fontSize: 14.5,
    fontFamily: "Cairo_700Bold",
    textAlign: "right",
    lineHeight: 20,
    marginTop: 2,
  },
  rowSpecs: {
    fontSize: 11,
    fontFamily: "Cairo_500Medium",
    textAlign: "right",
    marginTop: 2,
  },
  rowBottomLine: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  rowColorsWrap: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
  },
  rowColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  rowMoreColors: {
    fontSize: 10,
    fontFamily: "Cairo_500Medium",
  },
  rowPriceWrap: {
    alignItems: "flex-end",
  },
  rowPriceCol: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
  },
  rowOldPrice: {
    fontSize: 11,
    fontFamily: "Cairo_500Medium",
    color: "rgba(150,150,150,0.8)",
    textDecorationLine: "line-through",
  },
  rowPrice: {
    fontSize: 15,
    fontFamily: "Cairo_700Bold",
  },

  // Grid Card (2-column)
  gridCardShadow: {
    flex: 1,
    margin: 5,
    maxWidth: "48.5%",
  },
  gridCard: {
    borderWidth: 1,
    overflow: "hidden",
    flex: 1,
  },
  gridImageWrap: {
    width: "100%",
    height: 126,
    position: "relative",
  },
  gridImage: {
    width: "100%",
    height: "100%",
  },
  gridPlaceholderImage: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  gridNewBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "#D32F2F",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderBottomLeftRadius: 8,
    zIndex: 2,
  },
  gridNewBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontFamily: "Cairo_700Bold",
  },
  gridOutOfStockBadge: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(192, 57, 43, 0.9)",
    paddingVertical: 2,
    alignItems: "center",
    zIndex: 2,
  },
  gridOutOfStockText: {
    color: "#fff",
    fontSize: 9,
    fontFamily: "Cairo_700Bold",
  },
  gridOfferBadge: {
    position: "absolute",
    top: 0,
    left: 0,
    backgroundColor: "#27AE60",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderBottomRightRadius: 8,
    zIndex: 2,
  },
  gridOfferText: {
    color: "#fff",
    fontSize: 9,
    fontFamily: "Cairo_700Bold",
  },
  gridFavBtn: {
    position: "absolute",
    bottom: 8,
    left: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 3,
  },
  gridInfoWrap: {
    padding: 9,
    gap: 3,
  },
  gridCatText: {
    fontSize: 10,
    fontFamily: "Cairo_600SemiBold",
    textAlign: "right",
  },
  gridName: {
    fontSize: 13,
    fontFamily: "Cairo_700Bold",
    textAlign: "right",
    lineHeight: 18,
    minHeight: 36,
  },
  gridSpecs: {
    fontSize: 10.5,
    fontFamily: "Cairo_500Medium",
    textAlign: "right",
  },
  gridPriceLine: {
    marginTop: 3,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  gridPriceCol: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
  },
  gridOldPrice: {
    fontSize: 10,
    fontFamily: "Cairo_500Medium",
    color: "rgba(150,150,150,0.8)",
    textDecorationLine: "line-through",
  },
  gridPrice: {
    fontSize: 14,
    fontFamily: "Cairo_700Bold",
  },
  gridColorsRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  gridColorDot: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
  },
  gridMoreColors: {
    fontSize: 9,
    fontFamily: "Cairo_500Medium",
  },
});
