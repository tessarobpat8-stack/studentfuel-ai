
import { GoogleGenAI, Type } from "@google/genai";
import { Recipe, Equipment, UserSettings, PantryItem } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const RECIPE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    purpose: { type: Type.STRING },
    equipment: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING, enum: Object.values(Equipment) } 
    },
    prepTime: { type: Type.INTEGER },
    cookTime: { type: Type.INTEGER },
    totalTime: { type: Type.INTEGER },
    servings: { type: Type.INTEGER },
    ingredients: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          quantity: { type: Type.NUMBER },
          unit: { type: Type.STRING }
        },
        required: ["name", "quantity", "unit"]
      }
    },
    instructions: { type: Type.ARRAY, items: { type: Type.STRING } },
    tags: { type: Type.ARRAY, items: { type: Type.STRING } },
    ingredientBenefits: { type: Type.OBJECT, additionalProperties: { type: Type.STRING } },
    mealType: { type: Type.STRING, enum: ['breakfast', 'lunch', 'dinner', 'snack', 'late-night', 'pre-workout', 'post-workout', 'dessert'] }
  },
  required: ["name", "purpose", "equipment", "prepTime", "cookTime", "totalTime", "servings", "ingredients", "instructions", "tags", "ingredientBenefits", "mealType"]
};

export const normalizeRecipe = async (rawInput: string): Promise<Partial<Recipe>> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Normalize this recipe text into the StudentFuel schema. 
    Ensure it is beginner-proof and follows the energy/focus philosophy. 
    Convert ingredient quantities to numbers. 
    Recipe: ${rawInput}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: RECIPE_SCHEMA
    }
  });
  return JSON.parse(response.text);
};

export const generateMealPlan = async (
  recipes: Recipe[], 
  settings: UserSettings, 
  pantry: PantryItem[]
): Promise<any> => {
  const prompt = `
    Act as StudentFuel AI. Generate a 7-day meal plan for a college student.
    Available Equipment: ${settings.equipment.join(", ")}
    Meals to Plan: ${settings.selectedMealTypes.join(", ")}
    Time Constraint: Max ${settings.maxMinutesPerMeal} mins per meal.
    No-Cook Mode: ${settings.noCookOnly}
    Meal Prep Mode: ${settings.mealPrepMode}
    Budget: ${settings.budgetRange}
    Pantry: ${pantry.map(i => i.name).join(", ")}
    
    Current Recipe Library: ${recipes.map(r => r.name).join(", ")}

    Rules:
    1. Only use recipes that match the equipment.
    2. Optimize for ingredient overlap across the week.
    3. If Meal Prep Mode is on, suggest using leftovers.
    4. Provide the result as an array of 7 objects, one for each day. 
       Each day object should have keys matching the selected meal types (e.g., "breakfastRecipeId", "lunchRecipeId").
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            day: { type: Type.STRING },
            breakfastRecipeId: { type: Type.STRING },
            lunchRecipeId: { type: Type.STRING },
            dinnerRecipeId: { type: Type.STRING },
            snackRecipeId: { type: Type.STRING },
            lateNightRecipeId: { type: Type.STRING },
            preWorkoutRecipeId: { type: Type.STRING },
            postWorkoutRecipeId: { type: Type.STRING },
            dessertRecipeId: { type: Type.STRING }
          },
          required: ["day"]
        }
      }
    }
  });
  return JSON.parse(response.text);
};
