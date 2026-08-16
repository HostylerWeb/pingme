import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { useTheme } from '../../theme';

export type EmptySceneName = 'wall' | 'ice' | 'chats' | 'location';

export function EmptyScene({ name, size = 148 }: { name: EmptySceneName; size?: number }) {
  const { colors } = useTheme();
  const paper = colors.surfaceMuted;
  const ink = colors.ink;
  const coral = colors.accent;
  const apricot = colors.icebreakerStart;
  const forest = colors.online;
  const muted = colors.inkMuted;

  if (name === 'wall') {
    return (
      <Svg width={size} height={size} viewBox="0 0 148 148" accessibilityLabel="Quiet café table">
        <Circle cx="74" cy="74" r="68" fill={paper} />
        <Ellipse cx="74" cy="108" rx="42" ry="8" fill={colors.outlineVariant} />
        <Rect x="48" y="78" width="52" height="28" rx="4" fill={colors.surface} stroke={colors.cardBorder} />
        <Path d="M56 78 V62 H92 V78" fill="none" stroke={muted} strokeWidth="2" />
        <Circle cx="68" cy="70" r="7" fill={coral} opacity={0.85} />
        <Circle cx="82" cy="68" r="6" fill={forest} opacity={0.7} />
        <Rect x="62" y="92" width="24" height="4" rx="2" fill={ink} opacity={0.12} />
      </Svg>
    );
  }

  if (name === 'ice') {
    return (
      <Svg width={size} height={size} viewBox="0 0 148 148" accessibilityLabel="Two people just out of range">
        <Circle cx="74" cy="74" r="68" fill={paper} />
        <Circle cx="52" cy="70" r="16" fill={apricot} opacity={0.9} />
        <Circle cx="96" cy="70" r="16" fill={coral} opacity={0.55} />
        <Path
          d="M70 70 H78"
          stroke={muted}
          strokeWidth="2"
          strokeDasharray="3 4"
          strokeLinecap="round"
        />
        <Ellipse cx="52" cy="102" rx="18" ry="10" fill={apricot} opacity={0.25} />
        <Ellipse cx="96" cy="102" rx="18" ry="10" fill={coral} opacity={0.18} />
      </Svg>
    );
  }

  if (name === 'chats') {
    return (
      <Svg width={size} height={size} viewBox="0 0 148 148" accessibilityLabel="Empty conversation">
        <Circle cx="74" cy="74" r="68" fill={paper} />
        <Path
          d="M42 54 H88 C94 54 98 58 98 64 V82 C98 88 94 92 88 92 H62 L50 104 V92 H42 C36 92 32 88 32 82 V64 C32 58 36 54 42 54 Z"
          fill={colors.surface}
          stroke={colors.cardBorder}
        />
        <Path
          d="M60 70 H106 C112 70 116 74 116 80 V96 C116 102 112 106 106 106 H96 L108 118 V106 H60 C54 106 50 102 50 96 V80 C50 74 54 70 60 70 Z"
          fill={coral}
          opacity={0.88}
        />
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 148 148" accessibilityLabel="Location needed">
      <Circle cx="74" cy="74" r="68" fill={paper} />
      <Circle cx="74" cy="70" r="28" fill="none" stroke={coral} strokeWidth="1.5" opacity={0.25} />
      <Circle cx="74" cy="70" r="18" fill="none" stroke={coral} strokeWidth="1.75" opacity={0.45} />
      <Path
        d="M74 48 C64 48 56 56 56 66 C56 78 74 96 74 96 C74 96 92 78 92 66 C92 56 84 48 74 48 Z"
        fill={coral}
      />
      <Circle cx="74" cy="66" r="6" fill={colors.onAccent} />
    </Svg>
  );
}
