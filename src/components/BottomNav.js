import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

// Finalized 5-item footer — see specs/mobile/01-bottom-navigation.md.
const TABS = [
  { id: 'Home', label: 'Home', icon: 'home-outline', iconActive: 'home', route: 'PatientDashboard' },
  { id: 'LogSymptoms', label: 'Log Symptoms', icon: 'pulse-outline', iconActive: 'pulse', route: 'Symptom' },
  { id: 'CareTeam', label: 'Care Team', icon: 'people-outline', iconActive: 'people', route: 'CareTeam' },
  { id: 'Documents', label: 'Documents', icon: 'folder-outline', iconActive: 'folder', route: 'MedicalRecords' },
  { id: 'Profile', label: 'Profile', icon: 'person-outline', iconActive: 'person', route: 'Profile' },
];

export default function BottomNav({ active, navigation }) {
  return (
    <SafeAreaView edges={['bottom']} style={s.bar}>
      <View style={s.row}>
        {TABS.map((tab) => {
          const isActive = active === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={s.item}
              onPress={() => { if (!isActive) navigation.navigate(tab.route); }}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isActive ? tab.iconActive : tab.icon}
                size={22}
                color={isActive ? colors.primary : colors.textMuted}
              />
              <Text style={[s.label, isActive && s.labelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  bar: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  row: { flexDirection: 'row' },
  item: { flex: 1, alignItems: 'center', paddingTop: 8, paddingBottom: 6 },
  label: { fontSize: 10, color: colors.textMuted, marginTop: 3, fontWeight: '600' },
  labelActive: { color: colors.primary },
});
