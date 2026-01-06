
import { Recipe, Equipment, Difficulty, MealType, PackageFormat } from './types';

export const INITIAL_RECIPES: Recipe[] = [
  {
    id: '1',
    name: 'Creamy Overnight Oats',
    purpose: 'Zero-effort focus fuel that stabilizes blood sugar for hours.',
    equipment: [],
    difficulty: Difficulty.BeginnerSafe,
    prepTime: 5,
    cookTime: 0,
    totalTime: 5,
    servings: 1,
    ingredients: [
      { name: 'Rolled oats', quantity: 0.5, unit: 'cup' },
      { name: 'Milk', quantity: 0.5, unit: 'cup' },
      { name: 'Plain yogurt', quantity: 0.25, unit: 'cup' },
      { name: 'Honey', quantity: 1, unit: 'tsp' }
    ],
    instructions: [
      'Add oats to a jar.',
      'Pour in milk and yogurt.',
      'Add honey and stir well.',
      'Refrigerate overnight.'
    ],
    condensedInstructions: [
      'Mix oats, milk, yogurt, honey in jar. Chill overnight.'
    ],
    tags: ['no-cook', 'breakfast', 'focus'],
    ingredientBenefits: {
      'Oats': 'Complex carbs for steady mental energy.',
      'Yogurt': 'Protein and probiotics for gut-brain health.'
    },
    mealType: 'breakfast'
  },
  {
    id: '7',
    name: 'Simple Chicken Rice Bowl',
    purpose: 'Balanced protein/carb combo for heavy study days.',
    equipment: [Equipment.Stove],
    difficulty: Difficulty.Moderate,
    prepTime: 10,
    cookTime: 15,
    totalTime: 25,
    servings: 2,
    ingredients: [
      { name: 'Chicken breast', quantity: 250, unit: 'g' },
      { name: 'Cooked rice', quantity: 2, unit: 'cups' },
      { name: 'Frozen vegetables', quantity: 1, unit: 'cup' },
      { name: 'Olive oil', quantity: 1, unit: 'tbsp' }
    ],
    instructions: [
      'Heat oil in pan.',
      'Cut chicken into bite-sized pieces.',
      'Sauté chicken until cooked through.',
      'Add frozen veg and cook 4 mins.',
      'Serve over warmed rice.'
    ],
    condensedInstructions: [
      'Sauté chicken in oil. Add veg. Serve over rice.'
    ],
    tags: ['meal-prep', 'dinner', 'energy'],
    ingredientBenefits: {
      'Chicken': 'Lean protein for focus.',
      'Rice': 'Quick energy supply.'
    },
    mealType: 'dinner'
  }
];

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const CURRENCIES = [
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
  { code: 'GBP', symbol: '£' },
  { code: 'INR', symbol: '₹' },
  { code: 'JPY', symbol: '¥' },
  { code: 'CAD', symbol: 'CA$' },
  { code: 'AUD', symbol: 'A$' }
];
export const MEAL_TYPES: { type: MealType; label: string; icon: string }[] = [
  { type: 'breakfast', label: 'Breakfast', icon: '☀️' },
  { type: 'lunch', label: 'Lunch', icon: '🥪' },
  { type: 'dinner', label: 'Dinner', icon: '🍲' },
  { type: 'snack', label: 'Snack', icon: '🍎' },
  { type: 'late-night', label: 'Late-Night Snack', icon: '🌙' },
  { type: 'pre-workout', label: 'Pre-Workout', icon: '💪' },
  { type: 'post-workout', label: 'Post-Workout', icon: '⚡' },
  { type: 'dessert', label: 'Dessert', icon: '🍰' }
];

export const PACKAGE_FORMATS: PackageFormat[] = ['jar', 'bag', 'box', 'bottle', 'carton', 'package', 'pieces'];
