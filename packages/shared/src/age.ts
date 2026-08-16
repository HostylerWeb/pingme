import { MIN_AGE_YEARS } from './constants';

export function meetsMinimumAge(dateOfBirth: Date, minYears = MIN_AGE_YEARS): boolean {
  const today = new Date();
  const minBirthDate = new Date(today.getFullYear() - minYears, today.getMonth(), today.getDate());
  const dob = new Date(dateOfBirth);
  return dob <= minBirthDate;
}
