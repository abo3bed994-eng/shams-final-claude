/**
 * Expo Push Notification Service
 * Handles token registration and sending push notifications via Expo Push API.
 * Uses lazy imports to avoid crashing on Android Expo Go (SDK 53+).
 */

import { Platform } from "react-native";
import { FS } from "@/lib/firebase";
import { migrateLocalToE164, samePhone } from "@/lib/phoneUtils";

let _Notifications: typeof import("expo-notifications") | null = null;
let _Device: typeof import("expo-device") | null = null;
let _initDone = false;

async function getNotifications() {
  if (!_Notifications) {
    try {
      _Notifications = await import("expo-notifications");
    } catch (_) {
      return null;
    }
  }
  return _Notifications;
}

async function getDevice() {
  if (!_Device) {
    try {
      _Device = await import("expo-device");
    } catch (_) {
      return null;
    }
  }
  return _Device;
}

async function initHandler() {
  if (_initDone) return;
  _initDone = true;
  try {
    const Notif = await getNotifications();
    if (!Notif) return;
    Notif.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldShowAlert: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch (_) {}
}

/**
 * Register this device for push notifications.
 * Saves the Expo push token to Firestore.
 * Totally safe — will not throw even if push is unavailable.
 */
export async function registerForPushNotifications(
  phone: string,
  role: string,
  extra?: {
    branchId?: string;
    canHandleShipping?: boolean;
    supervisorScope?: "branch" | "all";
    permissions?: string[];
  }
): Promise<string | null> {
  try {
    const Device = await getDevice();
    if (!Device || !Device.isDevice) return null;

    await initHandler();
    const Notifications = await getNotifications();
    if (!Notifications) return null;

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return null;

    if (Platform.OS === "android") {
      const SHAMS_VIBRATION_PATTERN = [0, 150, 100, 150, 100, 450, 100, 150];
      await Notifications.setNotificationChannelAsync("orders_v2", {
        name: "طلبات جديدة",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: SHAMS_VIBRATION_PATTERN,
        sound: "notification.wav",
        lightColor: "#C9A84C",
        enableVibrate: true,
        showBadge: true,
      });
      await Notifications.setNotificationChannelAsync("messages_v3", {
        name: "رسائل وتحديثات",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: SHAMS_VIBRATION_PATTERN,
        sound: "notification.wav",
        lightColor: "#C9A84C",
        enableVibrate: true,
        showBadge: true,
      });
      await Notifications.setNotificationChannelAsync("default_v2", {
        name: "إشعارات عامة",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: SHAMS_VIBRATION_PATTERN,
        sound: "notification.wav",
        lightColor: "#C9A84C",
        enableVibrate: true,
        showBadge: true,
      });
    }

    let expoPushToken: string | null = null;
    try {
      let projectId = "259a6c4c-4501-4ab4-ab35-62ebc9a4ba9d";
      try {
        const Constants = (await import("expo-constants")).default;
        projectId =
          Constants?.expoConfig?.extra?.eas?.projectId ??
          Constants?.easConfig?.projectId ??
          projectId;
      } catch (_) {}

      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      expoPushToken = tokenData.data;
    } catch (e1) {
      console.warn("Could not get Expo push token with projectId, trying without args:", e1);
      try {
        const tokenData = await Notifications.getExpoPushTokenAsync();
        expoPushToken = tokenData.data;
      } catch (e2) {
        console.warn("Could not get Expo push token fallback:", e2);
        return null;
      }
    }

    if (expoPushToken) {
      // Push-token documents are keyed by phone. Keep the key canonical so
      // status notifications can find the token even when an old order stores
      // the customer's local-format phone.
      await FS.savePushToken(migrateLocalToE164(phone), role, expoPushToken, extra);
    }
    return expoPushToken;
  } catch (err) {
    console.warn("registerForPushNotifications error:", err);
    return null;
  }
}

/**
 * Send push notifications via Expo Push API.
 * Can be called from the client — no server required.
 */
export async function sendExpoPush(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, any>,
  channelId = "messages_v3"
): Promise<void> {
  const validTokens = Array.from(
    new Set(
      tokens.filter(
        (t) => t && (t.startsWith("ExponentPushToken[") || t.startsWith("ExpoPushToken["))
      )
    )
  );
  if (validTokens.length === 0) return;

  const messages = validTokens.map((to) => ({
    to,
    title,
    body,
    sound: "notification.wav",
    priority: "high",
    channelId,
    data: data ?? {},
    badge: 1,
  }));

  // Send individually via Promise.allSettled so a token mismatch or error on one
  // recipient (e.g. PUSH_TOO_MANY_EXPERIENCE_IDS) never blocks other staff members.
  await Promise.allSettled(
    messages.map(async (msg) => {
      try {
        const res = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Accept-Encoding": "gzip, deflate",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(msg),
        });
        if (!res.ok) {
          console.warn("Expo push single recipient error:", res.status, await res.text().catch(() => ""));
        }
      } catch (err) {
        console.warn("Expo push fetch error:", err);
      }
    })
  );
}

/**
 * Send push to all employees and supervisors (for new orders).
 */
export async function notifyStaffNewOrder(
  orderId: string,
  customerName: string,
  orderInfo?: { branchId?: string; fulfillmentType?: string }
): Promise<void> {
  try {
    let targetTokens: string[] = [];
    const isShipping = orderInfo?.fulfillmentType === "shipping";
    const orderBranchId = orderInfo?.branchId;

    try {
      const staffTokens = await FS.getStaffPushTokens();

      for (const st of staffTokens) {
        if (!st.expoPushToken) continue;

        if (st.role === "admin") {
          targetTokens.push(st.expoPushToken);
        } else if (st.role === "supervisor") {
          if (st.supervisorScope === "branch" && st.branchId) {
            if (isShipping && st.canHandleShipping) {
              targetTokens.push(st.expoPushToken);
            } else if (!isShipping && st.branchId === orderBranchId) {
              targetTokens.push(st.expoPushToken);
            }
          } else {
            targetTokens.push(st.expoPushToken);
          }
        } else if (st.role === "employee") {
          if (isShipping && st.canHandleShipping) {
            targetTokens.push(st.expoPushToken);
          } else if (!isShipping && (!st.branchId || st.branchId === orderBranchId)) {
            targetTokens.push(st.expoPushToken);
          }
        }
      }
    } catch (e) {
      console.warn("Error filtering staff tokens by branch:", e);
    }

    // Fallback: if no tokens matched, ensure all staff roles receive notification
    if (targetTokens.length === 0) {
      targetTokens = await FS.getPushTokensByRoles(["admin", "supervisor", "employee"]);
    } else {
      targetTokens = Array.from(new Set(targetTokens));
    }

    await sendExpoPush(
      targetTokens,
      "🛍️ طلب جديد!",
      `طلب جديد من ${customerName} — #${orderId.slice(0, 8)}`,
      { type: "new_order", orderId },
      "orders_v2"
    );
  } catch (err) {
    console.warn("notifyStaffNewOrder error:", err);
  }
}

/**
 * Send push notification to admins and supervisors who have 'approve_upgrades' permission.
 */
export async function notifyUpgradeRequest(
  userName: string,
  userPhone: string,
  userId: string
): Promise<void> {
  try {
    let targetTokens: string[] = [];
    try {
      const staffTokens = await FS.getStaffPushTokens();

      for (const st of staffTokens) {
        if (!st.expoPushToken) continue;

        if (st.role === "admin") {
          targetTokens.push(st.expoPushToken);
        } else if (st.role === "supervisor") {
          const perms: string[] = st.permissions || [];
          if (perms.includes("approve_upgrades") || !st.permissions) {
            targetTokens.push(st.expoPushToken);
          }
        }
      }
    } catch (e) {
      console.warn("Error finding upgrade request tokens:", e);
    }

    if (targetTokens.length === 0) {
      targetTokens = await FS.getPushTokensByRoles(["admin"]);
    } else {
      targetTokens = Array.from(new Set(targetTokens));
    }

    await sendExpoPush(
      targetTokens,
      "👑 طلب ترقية إلى تاجر",
      `طلب من ${userName} (${userPhone}) للترقية إلى حساب تاجر`,
      { type: "upgrade_request", actionType: "upgrade_request", actionUserId: userId },
      "messages_v3"
    );
  } catch (err) {
    console.warn("notifyUpgradeRequest error:", err);
  }
}

export async function notifyUserByPhone(
  phone: string,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  try {
    const normalizedPhone = migrateLocalToE164(phone);
    // Prefer the canonical key, but keep the raw key as a compatibility
    // fallback for tokens saved by older app versions.
    const token =
      await FS.getPushTokenByPhone(normalizedPhone) ||
      (normalizedPhone !== phone ? await FS.getPushTokenByPhone(phone) : null);
    if (token) await sendExpoPush([token], title, body, data, "messages_v3");
  } catch (err) {
    console.warn("notifyUserByPhone error:", err);
  }
}

/**
 * Send push to all users with given roles.
 */
export async function notifyByRoles(
  roles: string[],
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  try {
    const tokens = await FS.getPushTokensByRoles(roles);
    await sendExpoPush(tokens, title, body, data, "messages_v3");
  } catch (err) {
    console.warn("notifyByRoles error:", err);
  }
}

/**
 * Send push to ALL registered users.
 */
export async function notifyAll(
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  try {
    const all = await FS.getAllPushTokens();
    await sendExpoPush(all.map((t) => t.expoPushToken), title, body, data, "messages_v3");
  } catch (err) {
    console.warn("notifyAll error:", err);
  }
}
