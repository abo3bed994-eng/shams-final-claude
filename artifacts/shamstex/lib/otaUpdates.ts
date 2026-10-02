import * as Updates from "expo-updates";

/**
 * Checks for OTA (Over-The-Air) updates quietly in the background without freezing or slowing down the UI.
 * Never throws an unhandled exception.
 */
export async function checkSilentOtaUpdate(): Promise<void> {
  if (__DEV__) return;

  try {
    const check = await Updates.checkForUpdateAsync();
    if (check.isAvailable) {
      await Updates.fetchUpdateAsync();
      // Update is downloaded safely and will apply on the user's next launch
    }
  } catch (_err) {
    // Silent fail - network issues or offline mode should never block the user
  }
}
