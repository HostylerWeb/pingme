import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Visible tab bar content height (icons + labels), excluding system nav inset. */
export const TAB_BAR_CONTENT_HEIGHT = 56;
/** Extra padding above/below tab bar icons — keep in sync with `(tabs)/_layout.tsx`. */
export const TAB_BAR_VERTICAL_PADDING = 8;

/** Many Android devices report 0 bottom inset unless edge-to-edge is configured. */
const ANDROID_NAV_FALLBACK = 48;

export function useBottomInset() {
  const insets = useSafeAreaInsets();
  return Platform.OS === 'android' && insets.bottom < 20
    ? Math.max(insets.bottom, ANDROID_NAV_FALLBACK)
    : insets.bottom;
}

export function useTabBarInsets() {
  const bottomInset = useBottomInset();
  const tabBarHeight = TAB_BAR_CONTENT_HEIGHT + bottomInset + TAB_BAR_VERTICAL_PADDING;

  return {
    safeBottom: bottomInset,
    tabBarHeight,
    /** Use for ScrollView paddingBottom and FAB `bottom` on tab screens. */
    contentBottom: tabBarHeight + TAB_BAR_VERTICAL_PADDING,
  };
}
