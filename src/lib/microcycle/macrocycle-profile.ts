import type { AgeGroup } from '@/generated/prisma';
import { calculateAgeData, isValidBirthDate } from '@/lib/age-utils';

export function macrocycleAgeGroup(profile: { ageGroup: AgeGroup | null; birthDate: Date | null }): AgeGroup | null {
  if (profile.birthDate) {
    return isValidBirthDate(profile.birthDate) ? calculateAgeData(profile.birthDate).ageGroup : null;
  }
  return profile.ageGroup;
}
