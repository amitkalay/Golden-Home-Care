export const providerServiceOptions = [
  { value: "meal-prep", label: "Meal Prep" },
  { value: "companionship", label: "Companionship" },
  { value: "errands", label: "Errands" },
  { value: "walks", label: "Walks" },
  { value: "pickleball-lessons", label: "Pickleball Lessons" },
  { value: "music-lessons", label: "Music Lessons" },
];

export const providerServiceValues = providerServiceOptions.map((option) => option.value);

export const providerServiceLabels = new Map(
  providerServiceOptions.map((option) => [option.value, option.label]),
);

