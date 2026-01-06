
export enum Equipment {
  Microwave = 'Microwave',
  Stove = 'Stove',
  Oven = 'Oven',
  AirFryer = 'Air fryer',
  Blender = 'Blender',
  FoodProcessor = 'Food processor',
  RiceCooker = 'Rice cooker',
  SlowCooker = 'Slow cooker / Instant Pot',
  Toaster = 'Toaster',
  Kettle = 'Kettle'
}

export enum Difficulty {
  BeginnerSafe = 'Beginner-safe',
  Moderate = 'Moderate attention',
  HighFocus = 'High focus'
}

export type PackageFormat = 'jar' | 'bag' | 'box' | 'bottle' | 'carton' | 'package' | 'pieces';

export type MealType = 
  | 'breakfast' 
  | 'lunch' 
  | 'dinner' 
  | 'snack' 
  | 'late-night' 
  | 'pre-workout' 
  | 'post-workout'
  | 'dessert';

export interface Ingredient {
  name: string;
  quantity: number;
  unit: string;
}

export interface Recipe {
  id: string;
  name: string;
  purpose: string;
  equipment: Equipment[];
  difficulty: Difficulty;
  prepTime: number;
  cookTime: number;
  totalTime: number;
  servings: number;
  ingredients: Ingredient[];
  instructions: string[];
  condensedInstructions?: string[];
  tags: string[];
  ingredientBenefits: { [key: string]: string };
  mealType: MealType;
}

export interface UserSettings {
  hasOnboarded: boolean;
  equipment: Equipment[];
  selectedMealTypes: MealType[];
  currency: string;
  maxMinutesPerMeal: number;
  noCookOnly: boolean;
  mealPrepMode: boolean;
  examMode: boolean;
  budgetRange: string;
  pantryEnabled: boolean;
}

export interface PantryItem {
  id: string;
  name: string;
  quantityRemaining: number;
  unit: string;
  packageSize: number;
  packagePrice: number;
  packageFormat: PackageFormat;
  lastUsed?: number;
  category: string;
}

export interface GroceryItem {
  id: string;
  name: string;
  quantityRequired: number; // Sum of recipe needs
  unit: string;
  packageSize: number; // Based on known pantry data or defaults
  packageFormat: PackageFormat;
  packagePrice: number;
  checked: boolean;
}

export interface MealPlanDay {
  day: string;
  slots: { [K in MealType]?: string }; // Map of MealType to Recipe ID
  cooked: { [K in MealType]?: boolean };
  feedback: { [K in MealType]?: 'Made' | 'Skipped' | 'Modified' };
}
