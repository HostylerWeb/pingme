import Svg, { Path } from 'react-native-svg';
import { iconData, type AppIconName } from './icon-data';

export type { AppIconName } from './icon-data';

export function AppIcon({
  name,
  size = 24,
  color,
  accessibilityLabel,
}: {
  name: AppIconName;
  size?: number;
  color: string;
  accessibilityLabel?: string;
}) {
  const icon = iconData[name];

  return (
    <Svg
      width={size}
      height={size}
      viewBox={icon.viewBox}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
    >
      {icon.paths.map((path, index) => (
        <Path
          key={index}
          d={path.d}
          fill={color}
          fillRule={path.fillRule}
          clipRule={path.clipRule}
        />
      ))}
    </Svg>
  );
}
