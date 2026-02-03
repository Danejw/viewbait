import { toast } from "sonner";

const DEFAULT_SUCCESS_MESSAGE = "Copied to clipboard";
const DEFAULT_ERROR_MESSAGE = "Could not copy to clipboard";

/**
 * Copies text to the clipboard and shows a success or error toast.
 * Use this instead of ad-hoc navigator.clipboard.writeText + toast calls.
 *
 * @param text - Text to copy
 * @param successMessage - Message for success toast (default: "Copied to clipboard")
 * @returns Promise<true> if copy succeeded, <false> otherwise (toast is always shown)
 */
export async function copyToClipboardWithToast(
  text: string,
  successMessage: string = DEFAULT_SUCCESS_MESSAGE
): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(successMessage);
    return true;
  } catch {
    toast.error(DEFAULT_ERROR_MESSAGE);
    return false;
  }
}
