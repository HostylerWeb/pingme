import { useEffect, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useBottomInset } from '../../hooks/use-tab-bar-insets';
import { PHONE_COUNTRIES, type PhoneCountry } from '../../lib/phone-countries';
import {
  buildE164,
  getDefaultPhoneCountry,
  parseE164,
} from '../../lib/phone-e164';
import { radius, spacing, typography, useTheme } from '../../theme';
import { useThemedStyles } from '../../theme/use-themed-styles';
import { AppIcon } from './app-icon';

function CountryPickerModal({
  visible,
  selectedIso2,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selectedIso2: string;
  onSelect: (country: PhoneCountry) => void;
  onClose: () => void;
}) {
  const safeBottom = useBottomInset();
  const { colors } = useTheme();
  const styles = useThemedStyles(({ colors, shadows }) => ({
    backdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'flex-end',
    },
    dismissArea: { flex: 1 },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.xl + 4,
      borderTopRightRadius: radius.xl + 4,
      maxHeight: '85%',
      ...shadows.sheet,
    },
    header: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
    },
    handle: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.outlineVariant,
      marginBottom: spacing.lg,
    },
    title: {
      ...typography.headlineMd,
      color: colors.ink,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      gap: spacing.md,
    },
    rowPressed: { backgroundColor: colors.surfaceMuted },
    rowSelected: { backgroundColor: colors.accentSoft },
    flag: { fontSize: 24, lineHeight: 28 },
    name: {
      ...typography.bodyMd,
      color: colors.ink,
      flex: 1,
    },
    dial: {
      ...typography.bodyMd,
      color: colors.inkSecondary,
    },
    listFooter: { height: spacing.xl + safeBottom },
  }));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.dismissArea} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.handle} />
            <Text style={styles.title}>Select country</Text>
          </View>
          <FlatList
            data={PHONE_COUNTRIES}
            keyExtractor={(item) => item.iso2}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            initialNumToRender={24}
            getItemLayout={(_, index) => ({ length: 52, offset: 52 * index, index })}
            ListFooterComponent={<View style={styles.listFooter} />}
            renderItem={({ item }) => {
              const selected = item.iso2 === selectedIso2;
              return (
                <Pressable
                  onPress={() => {
                    onSelect(item);
                    onClose();
                  }}
                  style={({ pressed }) => [
                    styles.row,
                    selected && styles.rowSelected,
                    pressed && styles.rowPressed,
                  ]}
                >
                  <Text style={styles.flag}>{item.flag}</Text>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.dial}>{item.dialCode}</Text>
                  {selected ? (
                    <AppIcon name="check" size={18} color={colors.accent} />
                  ) : null}
                </Pressable>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

export function PhoneInput({
  label,
  hint,
  value,
  onChangeText,
  containerStyle,
}: {
  label?: string;
  hint?: string;
  value: string;
  onChangeText: (e164: string) => void;
  containerStyle?: object;
}) {
  const { colors } = useTheme();
  const [country, setCountry] = useState<PhoneCountry>(() => {
    const parsed = value ? parseE164(value) : null;
    return parsed?.country ?? getDefaultPhoneCountry();
  });
  const [national, setNational] = useState(() => {
    const parsed = value ? parseE164(value) : null;
    return parsed?.national ?? '';
  });
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (!value) {
      setCountry(getDefaultPhoneCountry());
      setNational('');
      return;
    }
    const parsed = parseE164(value);
    if (parsed) {
      setCountry(parsed.country);
      setNational(parsed.national);
    }
  }, [value]);

  const styles = useThemedStyles(({ colors }) => ({
    wrap: { marginBottom: spacing.lg },
    label: {
      ...typography.labelSm,
      color: colors.inkSecondary,
      marginBottom: spacing.sm,
      textTransform: 'none',
      letterSpacing: 0,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    countryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md + 2,
      minWidth: 96,
    },
    countryBtnPressed: { backgroundColor: colors.surfaceElevated },
    flag: { fontSize: 20, lineHeight: 24 },
    dial: {
      ...typography.bodyMd,
      color: colors.ink,
    },
    input: {
      ...typography.bodyMd,
      flex: 1,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md + 2,
      color: colors.ink,
    },
    hint: {
      ...typography.caption,
      color: colors.inkTertiary,
      marginTop: spacing.sm,
      textAlign: 'right',
    },
  }));

  const emitChange = (nextCountry: PhoneCountry, nextNational: string) => {
    onChangeText(buildE164(nextCountry, nextNational));
  };

  return (
    <View style={[styles.wrap, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.row}>
        <Pressable
          onPress={() => setPickerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Select country"
          style={({ pressed }) => [styles.countryBtn, pressed && styles.countryBtnPressed]}
        >
          <Text style={styles.flag}>{country.flag}</Text>
          <Text style={styles.dial}>{country.dialCode}</Text>
        </Pressable>
        <TextInput
          value={national}
          onChangeText={(text) => {
            const digits = text.replace(/\D/g, '');
            setNational(digits);
            emitChange(country, digits);
          }}
          placeholder="Phone number"
          placeholderTextColor={colors.inkMuted}
          keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'phone-pad'}
          autoComplete="tel-national"
          textContentType="telephoneNumber"
          style={styles.input}
        />
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <CountryPickerModal
        visible={pickerOpen}
        selectedIso2={country.iso2}
        onSelect={(next) => {
          setCountry(next);
          emitChange(next, national);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  );
}
