import { Switch, SwitchProps } from 'react-native';
import { useTheme } from '../../theme/theme-context';

type AppSwitchVariant = 'accent' | 'online' | 'premium' | 'icebreaker';

export function AppSwitch({
  variant = 'accent',
  value,
  ...props
}: SwitchProps & { variant?: AppSwitchVariant }) {
  const { colors } = useTheme();

  const trackColor = {
    accent: { false: colors.switchTrackOff, true: colors.accentSoft },
    online: { false: colors.switchTrackOff, true: colors.onlineSoft },
    premium: { false: colors.switchTrackOff, true: colors.premiumSurfaceMuted },
    icebreaker: { false: colors.switchTrackOff, true: colors.icebreakerSoft },
  }[variant];

  const thumbColor = {
    accent: value ? colors.accent : colors.switchThumbOff,
    online: value ? colors.online : colors.switchThumbOff,
    premium: value ? colors.premiumStart : colors.switchThumbOff,
    icebreaker: value ? colors.icebreakerStart : colors.switchThumbOff,
  }[variant];

  return (
    <Switch
      value={value}
      trackColor={trackColor}
      thumbColor={thumbColor}
      ios_backgroundColor={colors.switchTrackOff}
      {...props}
    />
  );
}
