export const medicalCompanionDescription =
  "A medical companion is a person who provides non-medical support, emotional comfort, and practical assistance to patients. They accompany individuals to medical appointments, help navigate hospital stays, and ensure patients feel safe, informed, and capable of following their healthcare instructions.";

export const providerServiceOptions = [
  { value: "meal-prep", label: "Meal Prep" },
  {
    value: "medical_companion",
    label: "Medical Companion",
    description: medicalCompanionDescription,
    suggested: true,
  },
  { value: "errands", label: "Errands" },
  { value: "walks", label: "Walks" },
  { value: "pickleball-lessons", label: "Pickleball Lessons" },
  { value: "music-lessons", label: "Music Lessons" },
];

export const providerServiceValues = providerServiceOptions.map((option) => option.value);

export const providerServiceLabels = new Map(
  providerServiceOptions.map((option) => [option.value, option.label]),
);

export function getProviderServiceOption(serviceType) {
  return providerServiceOptions.find((option) => option.value === serviceType);
}
