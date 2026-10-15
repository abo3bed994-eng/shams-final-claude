// Unified Phone Auth wrapper that uses:
//   • Firebase JS SDK (web) — signInWithPhoneNumber + RecaptchaVerifier
//   • @react-native-firebase/auth (native iOS/Android) — signInWithPhoneNumber
//
// Both flows return a "confirmation" handle whose .confirm(code) verifies the OTP.

import { Platform } from "react-native";
import { auth as webAuth, setupRecaptcha } from "./firebase";
import {
  signInWithPhoneNumber as webSignInWithPhone,
  ConfirmationResult as WebConfirmationResult,
} from "@firebase/auth";

export type PhoneAuthConfirmation = {
  confirm: (code: string) => Promise<{ uid: string; phoneNumber: string | null }>;
};

let nativeAuthModule: any = null;
function getNativeAuth() {
  if (nativeAuthModule) return nativeAuthModule;
  try {
    // Lazy require so web bundle never tries to load native module.
    const mod = require("@react-native-firebase/auth");
    nativeAuthModule = mod;
    return mod;
  } catch (e) {
    return null;
  }
}

export async function startPhoneSignIn(
  e164Phone: string,
  options: { disableAppVerificationForTesting?: boolean } = {}
): Promise<PhoneAuthConfirmation> {
  if (Platform.OS === "web") {
    // Firebase fictional test numbers can skip reCAPTCHA in development. This
    // must never be enabled for normal numbers or production builds.
    webAuth.settings.appVerificationDisabledForTesting =
      __DEV__ && options.disableAppVerificationForTesting === true;
    const verifier = setupRecaptcha();
    const result: WebConfirmationResult = await webSignInWithPhone(webAuth, e164Phone, verifier);
    return {
      confirm: async (code: string) => {
        const cred = await result.confirm(code);
        return {
          uid: cred.user.uid,
          phoneNumber: cred.user.phoneNumber,
        };
      },
    };
  }

  // Native (iOS / Android)
  const rnAuthModule = getNativeAuth();
  if (!rnAuthModule) {
    throw new Error("@react-native-firebase/auth is not available in this build");
  }

  let confirmation: any;
  if (typeof rnAuthModule.signInWithPhoneNumber === "function" && typeof rnAuthModule.getAuth === "function") {
    // Modular API (@react-native-firebase/auth v26+)
    const auth = rnAuthModule.getAuth();
    confirmation = await rnAuthModule.signInWithPhoneNumber(auth, e164Phone);
  } else if (typeof rnAuthModule.default === "function") {
    // Legacy namespaced API
    confirmation = await rnAuthModule.default().signInWithPhoneNumber(e164Phone);
  } else if (typeof rnAuthModule === "function") {
    confirmation = await rnAuthModule().signInWithPhoneNumber(e164Phone);
  } else {
    throw new Error("Unable to initialize native phone auth");
  }

  return {
    confirm: async (code: string) => {
      const cred = await confirmation.confirm(code);
      return {
        uid: cred?.user?.uid ?? "",
        phoneNumber: cred?.user?.phoneNumber ?? null,
      };
    },
  };
}

// Returns the E.164 phone number of the Firebase auth session persisted on
// THIS device, or null if the device has never completed a phone OTP sign-in.
export function getCurrentAuthPhone(): string | null {
  try {
    if (Platform.OS === "web") {
      return webAuth.currentUser?.phoneNumber ?? null;
    }
    const rnAuthModule = getNativeAuth();
    if (!rnAuthModule) return null;
    if (typeof rnAuthModule.getAuth === "function") {
      return rnAuthModule.getAuth().currentUser?.phoneNumber ?? null;
    }
    if (typeof rnAuthModule.default === "function") {
      return rnAuthModule.default().currentUser?.phoneNumber ?? null;
    }
    if (typeof rnAuthModule === "function") {
      return rnAuthModule().currentUser?.phoneNumber ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

// Subscribes to Firebase auth state changes. Crucial on Android where Google Play Services
// can auto-verify the SMS code in the background without manual code entry.
export function subscribeAuthChange(
  callback: (user: { uid: string; phoneNumber: string | null } | null) => void
): () => void {
  try {
    if (Platform.OS === "web") {
      const { onAuthStateChanged } = require("@firebase/auth");
      return onAuthStateChanged(webAuth, (user: any) => {
        if (user) {
          callback({ uid: user.uid, phoneNumber: user.phoneNumber ?? null });
        } else {
          callback(null);
        }
      });
    }

    const rnAuthModule = getNativeAuth();
    if (!rnAuthModule) return () => {};

    if (typeof rnAuthModule.onAuthStateChanged === "function" && typeof rnAuthModule.getAuth === "function") {
      const auth = rnAuthModule.getAuth();
      return rnAuthModule.onAuthStateChanged(auth, (user: any) => {
        if (user) {
          callback({ uid: user.uid, phoneNumber: user.phoneNumber ?? null });
        } else {
          callback(null);
        }
      });
    } else if (typeof rnAuthModule.default === "function") {
      return rnAuthModule.default().onAuthStateChanged((user: any) => {
        if (user) {
          callback({ uid: user.uid, phoneNumber: user.phoneNumber ?? null });
        } else {
          callback(null);
        }
      });
    } else if (typeof rnAuthModule === "function") {
      return rnAuthModule().onAuthStateChanged((user: any) => {
        if (user) {
          callback({ uid: user.uid, phoneNumber: user.phoneNumber ?? null });
        } else {
          callback(null);
        }
      });
    }
  } catch (e) {
    if (__DEV__) console.warn("[subscribeAuthChange] failed:", e);
  }
  return () => {};
}

export async function signOut(): Promise<void> {
  try {
    if (Platform.OS === "web") {
      await webAuth.signOut();
    } else {
      const rnAuthModule = getNativeAuth();
      if (!rnAuthModule) return;
      if (typeof rnAuthModule.signOut === "function" && typeof rnAuthModule.getAuth === "function") {
        await rnAuthModule.signOut(rnAuthModule.getAuth());
      } else if (typeof rnAuthModule.default === "function") {
        await rnAuthModule.default().signOut();
      } else if (typeof rnAuthModule === "function") {
        await rnAuthModule().signOut();
      }
    }
  } catch {}
}
