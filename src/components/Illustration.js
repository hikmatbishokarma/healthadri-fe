import { View, StyleSheet } from 'react-native';

import CaregiverEmpty from '@/assets/illustrations/caregiver_empty.svg';
import CaregiverConnected from '@/assets/illustrations/caregiver_connected.svg';
import HospitalEmpty from '@/assets/illustrations/hospital_empty.svg';
import MedicationEmpty from '@/assets/illustrations/medication_empty.svg';
import AppointmentEmpty from '@/assets/illustrations/appointment_empty.svg';
import ReportsEmpty from '@/assets/illustrations/reports_empty.svg';
import RegistrationSuccess from '@/assets/illustrations/registration_success.svg';
import WelcomePatient from '@/assets/illustrations/welcome_patient.svg';

// Canonical sizes used across the app
export const ILLUSTRATION_SIZE = {
  sm: 120,
  md: 160,
  lg: 200,
  xl: 240,
};

const MAP = {
  caregiver_empty: CaregiverEmpty,
  caregiver_connected: CaregiverConnected,
  hospital_empty: HospitalEmpty,
  medication_empty: MedicationEmpty,
  appointment_empty: AppointmentEmpty,
  reports_empty: ReportsEmpty,
  registration_success: RegistrationSuccess,
  welcome_patient: WelcomePatient,
};

/**
 * Renders a named SVG illustration at a consistent size.
 *
 * @param {'caregiver_empty'|'caregiver_connected'|'hospital_empty'|
 *         'medication_empty'|'appointment_empty'|'reports_empty'|
 *         'registration_success'|'welcome_patient'} name
 * @param {number} [size=160]  width and height in dp
 * @param {object} [style]     extra style applied to the wrapping View
 */
export default function Illustration({ name, size = ILLUSTRATION_SIZE.md, style }) {
  const SvgComponent = MAP[name];
  if (!SvgComponent) return null;

  return (
    <View style={[styles.wrap, style]}>
      <SvgComponent width={size} height={size} />
    </View>
  );
}

// Named re-exports so screens can also import SVGs directly when needed.
export {
  CaregiverEmpty,
  CaregiverConnected,
  HospitalEmpty,
  MedicationEmpty,
  AppointmentEmpty,
  ReportsEmpty,
  RegistrationSuccess,
  WelcomePatient,
};

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
