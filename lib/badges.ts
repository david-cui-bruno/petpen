import { Badge, Behavioral, Medical } from "./types";

export function deriveBadges(
  behavioral: Behavioral,
  medical: Medical
): Badge[] {
  const badges: Badge[] = [];
  if (behavioral.house_trained)
    badges.push({ emoji: "🏠", label: "House Trained" });
  if (behavioral.crate_trained)
    badges.push({ emoji: "📦", label: "Crate Trained" });
  if (behavioral.good_with_kids)
    badges.push({ emoji: "👶", label: "Good with Kids" });
  if (behavioral.good_with_dogs)
    badges.push({ emoji: "🐕", label: "Good with Dogs" });
  if (behavioral.good_with_cats)
    badges.push({ emoji: "🐈", label: "Good with Cats" });
  if (behavioral.energy && behavioral.energy <= 2)
    badges.push({ emoji: "🛋️", label: "Couch Potato" });
  if (behavioral.energy && behavioral.energy >= 4)
    badges.push({ emoji: "🏃", label: "Active" });
  if (medical.vaccinated)
    badges.push({ emoji: "💉", label: "Vaccinated" });
  return badges;
}
