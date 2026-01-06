
import React, { useState, useEffect, useMemo } from 'react';
import { Recipe, UserSettings, PantryItem, Equipment, MealPlanDay, GroceryItem, Ingredient, Difficulty, MealType, PackageFormat } from './types';
import { INITIAL_RECIPES, DAYS, CURRENCIES, MEAL_TYPES, PACKAGE_FORMATS } from './constants';
import { generateMealPlan, normalizeRecipe } from './services/geminiService';

export default function App() {
  const [view, setView] = useState('dashboard');
  const [recipes, setRecipes] = useState<Recipe[]>(() => {
    const saved = localStorage.getItem('sf_v5_recipes');
    return saved ? JSON.parse(saved) : INITIAL_RECIPES;
  });
  const [pantry, setPantry] = useState<PantryItem[]>(() => {
    const saved = localStorage.getItem('sf_v5_pantry');
    return saved ? JSON.parse(saved) : [];
  });
  const [groceries, setGroceries] = useState<GroceryItem[]>(() => {
    const saved = localStorage.getItem('sf_v5_groceries');
    return saved ? JSON.parse(saved) : [];
  });
  const [settings, setSettings] = useState<UserSettings>(() => {
    const saved = localStorage.getItem('sf_v5_settings');
    return saved ? JSON.parse(saved) : {
      hasOnboarded: false,
      equipment: [],
      selectedMealTypes: ['breakfast', 'lunch', 'dinner'],
      currency: 'USD',
      maxMinutesPerMeal: 30,
      noCookOnly: false,
      mealPrepMode: false,
      examMode: false,
      budgetRange: '$30 - $50',
      pantryEnabled: true,
    };
  });
  const [mealPlan, setMealPlan] = useState<MealPlanDay[]>(() => {
    const saved = localStorage.getItem('sf_v5_mealplan');
    if (saved) return JSON.parse(saved);
    return DAYS.map(d => ({
      day: d,
      slots: {},
      cooked: {},
      feedback: {}
    }));
  });
  
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [instructionMode, setInstructionMode] = useState<'detailed' | 'condensed'>('detailed');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreatingRecipe, setIsCreatingRecipe] = useState(false);
  const [creatorMode, setCreatorMode] = useState<'ai' | 'manual'>('ai');
  const [groceryCheckoutItem, setGroceryCheckoutItem] = useState<GroceryItem | null>(null);

  // Assignment states (for multi-select)
  const [assignmentDays, setAssignmentDays] = useState<string[]>([]);
  const [assignmentSlots, setAssignmentSlots] = useState<MealType[]>([]);

  useEffect(() => {
    localStorage.setItem('sf_v5_recipes', JSON.stringify(recipes));
    localStorage.setItem('sf_v5_pantry', JSON.stringify(pantry));
    localStorage.setItem('sf_v5_groceries', JSON.stringify(groceries));
    localStorage.setItem('sf_v5_settings', JSON.stringify(settings));
    localStorage.setItem('sf_v5_mealplan', JSON.stringify(mealPlan));
  }, [recipes, pantry, groceries, settings, mealPlan]);

  const formatCurrency = (val: number) => {
    const symbol = CURRENCIES.find(c => c.code === settings.currency)?.symbol || '$';
    return `${symbol}${val.toFixed(2)}`;
  };

  const calculateRecipeCost = (recipe: Recipe) => {
    let total = 0;
    let missingData = false;
    recipe.ingredients.forEach(ing => {
      const p = pantry.find(item => item.name.toLowerCase() === ing.name.toLowerCase());
      if (p && p.packagePrice > 0 && p.packageSize > 0) {
        const unitCost = p.packagePrice / p.packageSize;
        total += unitCost * ing.quantity;
      } else {
        missingData = true;
      }
    });
    return missingData ? null : total;
  };

  const markMealCooked = (dayIdx: number, slot: MealType, feedback: 'Made' | 'Skipped' | 'Modified') => {
    const newPlan = [...mealPlan];
    const day = newPlan[dayIdx];
    day.cooked[slot] = true;
    day.feedback[slot] = feedback;

    if (feedback !== 'Skipped') {
      const recipeId = day.slots[slot];
      const recipe = recipes.find(r => r.id === recipeId);
      if (recipe) {
        const newPantry = [...pantry];
        recipe.ingredients.forEach(ing => {
          const idx = newPantry.findIndex(p => p.name.toLowerCase() === ing.name.toLowerCase());
          if (idx > -1) {
            newPantry[idx].quantityRemaining = Math.max(0, newPantry[idx].quantityRemaining - ing.quantity);
            newPantry[idx].lastUsed = Date.now();
          }
        });
        setPantry(newPantry);
      }
    }
    setMealPlan(newPlan);
  };

  const generateWeeklyGroceryList = () => {
    const requirements: { [name: string]: { qty: number, unit: string } } = {};
    
    mealPlan.forEach(day => {
      Object.entries(day.slots).forEach(([slot, recipeId]) => {
        const recipe = recipes.find(r => r.id === recipeId);
        if (recipe) {
          recipe.ingredients.forEach(ing => {
            const key = ing.name.toLowerCase();
            if (!requirements[key]) requirements[key] = { qty: 0, unit: ing.unit };
            requirements[key].qty += ing.quantity;
          });
        }
      });
    });

    const newList: GroceryItem[] = Object.entries(requirements).map(([name, data]) => {
      const existingPantry = pantry.find(p => p.name.toLowerCase() === name);
      const stock = existingPantry ? existingPantry.quantityRemaining : 0;
      const needed = Math.max(0, data.qty - stock);

      return {
        id: Math.random().toString(36).substr(2, 9),
        name,
        quantityRequired: needed,
        unit: data.unit,
        packageSize: existingPantry?.packageSize || 1,
        packageFormat: existingPantry?.packageFormat || 'package',
        packagePrice: existingPantry?.packagePrice || 0,
        checked: false
      };
    }).filter(item => item.quantityRequired > 0);

    setGroceries(newList);
    setView('grocery');
  };

  const finalizePurchase = (id: string, size: number, price: number, format: PackageFormat) => {
    const item = groceries.find(g => g.id === id);
    if (!item) return;

    const newPantry = [...pantry];
    const idx = newPantry.findIndex(p => p.name.toLowerCase() === item.name.toLowerCase());
    if (idx > -1) {
      newPantry[idx].quantityRemaining += size;
      newPantry[idx].packagePrice = price;
      newPantry[idx].packageSize = size;
      newPantry[idx].packageFormat = format;
    } else {
      newPantry.push({
        id: Date.now().toString(),
        name: item.name,
        quantityRemaining: size,
        unit: item.unit,
        packageSize: size,
        packagePrice: price,
        packageFormat: format,
        category: 'Purchased'
      });
    }
    setPantry(newPantry);
    setGroceries(groceries.filter(g => g.id !== id));
    setGroceryCheckoutItem(null);
  };

  const applyAssignment = () => {
    if (!selectedRecipe) return;
    const newPlan = [...mealPlan];
    assignmentDays.forEach(dayName => {
      const dIdx = newPlan.findIndex(d => d.day === dayName);
      if (dIdx > -1) {
        assignmentSlots.forEach(slot => {
          newPlan[dIdx].slots[slot] = selectedRecipe.id;
          newPlan[dIdx].cooked[slot] = false;
        });
      }
    });
    setMealPlan(newPlan);
    // Reset selections but keep modal open as per requirements
    setAssignmentDays([]);
    setAssignmentSlots([]);
    alert(`Assigned ${selectedRecipe.name} to selected slots.`);
  };

  const activeMealTypes = MEAL_TYPES.filter(mt => settings.selectedMealTypes.includes(mt.type));

  // --- Insight Calculations ---
  const lowStock = pantry.filter(p => p.quantityRemaining < (p.packageSize * 0.2));
  const underused = pantry.filter(p => p.lastUsed && (Date.now() - p.lastUsed > 7 * 24 * 60 * 60 * 1000));

  if (!settings.hasOnboarded) {
    return (
      <div className="max-w-md mx-auto min-h-screen p-8 flex flex-col justify-center gap-8 bg-white">
        <header className="text-center">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl mx-auto mb-6 flex items-center justify-center text-3xl">🥣</div>
          <h1 className="text-4xl font-black text-slate-900 mb-2">StudentFuel AI</h1>
          <p className="text-slate-400 font-medium">Bulk-aware, focus-first nutrition.</p>
        </header>
        <section className="space-y-6">
          <div className="space-y-4">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Which meals do you plan?</label>
            <div className="grid grid-cols-2 gap-2">
              {MEAL_TYPES.map(mt => (
                <button 
                  key={mt.type}
                  onClick={() => toggleMealType(mt.type)}
                  className={`p-3 rounded-xl border-2 text-xs font-bold transition-all flex items-center gap-2 ${settings.selectedMealTypes.includes(mt.type) ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : 'border-slate-50 text-slate-400'}`}
                >
                  <span>{mt.icon}</span>
                  <span className="truncate">{mt.label}</span>
                </button>
              ))}
            </div>
          </div>
          <button onClick={() => setSettings({...settings, hasOnboarded: true})} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-100">Enter Kitchen</button>
        </section>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto pb-32 pt-6 px-4 selection:bg-indigo-100">
      <header className="flex justify-between items-center mb-8 bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Dashboard</h1>
          <p className="text-[10px] text-indigo-600 font-black uppercase tracking-widest">
            {settings.examMode ? '⚠️ EXAM MODE ACTIVE' : 'CONSISTENCY LOOP'}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={generateWeeklyGroceryList} className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center border border-indigo-100 text-xl">🛒</button>
          <button onClick={() => setView('settings')} className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100 text-xl text-slate-400">⚙️</button>
        </div>
      </header>

      <main className="space-y-8">
        {view === 'dashboard' && (
          <>
            {/* Insights Section */}
            {(lowStock.length > 0 || underused.length > 0) && (
              <section className="bg-indigo-600 text-white p-6 rounded-[32px] shadow-lg space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest opacity-80">Kitchen Insights</h3>
                <div className="grid grid-cols-2 gap-4">
                  {lowStock.length > 0 && (
                    <div className="bg-white/10 p-4 rounded-2xl">
                      <p className="text-[10px] font-black uppercase">Low Stock</p>
                      <p className="text-sm font-bold truncate">{lowStock[0].name}</p>
                    </div>
                  )}
                  {underused.length > 0 && (
                    <div className="bg-white/10 p-4 rounded-2xl">
                      <p className="text-[10px] font-black uppercase">Underused</p>
                      <p className="text-sm font-bold truncate">{underused[0].name}</p>
                    </div>
                  )}
                </div>
              </section>
            )}

            <div className="flex justify-between items-center px-2">
              <h2 className="text-xl font-black text-slate-900">Weekly Plan</h2>
              <button 
                onClick={async () => {
                  setIsGenerating(true);
                  try {
                    const result = await generateMealPlan(recipes, settings, pantry);
                    const newPlan = DAYS.map(d => {
                      const dayData = result.find((item: any) => item.day === d);
                      const slots: any = {};
                      settings.selectedMealTypes.forEach(t => {
                        const key = `${t}RecipeId`;
                        slots[t] = dayData[key];
                      });
                      return {
                        day: d,
                        slots,
                        cooked: {},
                        feedback: {}
                      };
                    });
                    setMealPlan(newPlan);
                  } catch (e) {
                    alert("Planning failed. Check your connection.");
                  } finally {
                    setIsGenerating(false);
                  }
                }}
                disabled={isGenerating}
                className="text-[10px] font-black uppercase text-indigo-600"
              >
                {isGenerating ? 'AI PLANNING...' : '⚡ SMART AUTO-GEN'}
              </button>
            </div>

            <div className="space-y-4">
              {mealPlan.map((dayPlan, dIdx) => (
                <div key={dIdx} className="bg-white rounded-[32px] border border-slate-100 overflow-hidden shadow-sm">
                  <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                    <span className="font-black text-slate-900 uppercase text-xs tracking-widest">{dayPlan.day}</span>
                  </div>
                  <div className="p-4 space-y-2">
                    {activeMealTypes.map(({ type, label, icon }) => {
                      const rid = dayPlan.slots[type];
                      const recipe = recipes.find(r => r.id === rid);
                      const isCooked = dayPlan.cooked[type];
                      
                      return (
                        <div key={type} className={`p-4 rounded-2xl flex items-center gap-4 border transition-all ${isCooked ? 'bg-slate-50 border-transparent opacity-60' : 'bg-white border-slate-50 hover:border-indigo-100'}`}>
                          <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-xl">{icon}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
                            {recipe ? (
                              <p className="font-bold text-slate-800 text-sm truncate">{recipe.name}</p>
                            ) : (
                              <button onClick={() => setView('recipes')} className="text-sm text-slate-300 italic">Assign meal</button>
                            )}
                          </div>
                          {recipe && !isCooked && (
                            <div className="flex gap-2">
                              <button onClick={() => markMealCooked(dIdx, type, 'Made')} className="p-2 bg-green-50 text-green-600 rounded-lg text-xs font-black">COOK</button>
                              <button onClick={() => {
                                const newPlan = [...mealPlan];
                                delete newPlan[dIdx].slots[type];
                                setMealPlan(newPlan);
                              }} className="text-slate-300 hover:text-red-400">×</button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {view === 'grocery' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-black text-slate-900">Grocery List</h2>
              <button onClick={generateWeeklyGroceryList} className="text-[10px] font-black uppercase text-indigo-600">REFRESH FROM PLAN</button>
            </div>
            <div className="bg-white rounded-[32px] p-8 border border-slate-100 shadow-sm space-y-4">
              {groceries.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-slate-300 font-bold uppercase tracking-widest text-xs">Everything is stocked</p>
                </div>
              ) : (
                groceries.map(item => (
                  <div key={item.id} className="flex items-center gap-4 group">
                    <button onClick={() => setGroceryCheckoutItem(item)} className="w-8 h-8 rounded-xl border-2 border-slate-100 hover:bg-green-500 hover:border-green-500 flex items-center justify-center transition-all">✅</button>
                    <div className="flex-1 flex justify-between items-center">
                      <div>
                        <p className="font-black text-slate-800 capitalize text-sm">{item.name}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Need: {item.quantityRequired} {item.unit}</p>
                      </div>
                      <p className="text-xs font-black text-indigo-600">
                        {Math.ceil(item.quantityRequired / (item.packageSize || 1))} {item.packageFormat}(s)
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {view === 'pantry' && (
          <div className="space-y-6">
            <h2 className="text-xl font-black text-slate-900">Pantry</h2>
            <div className="grid grid-cols-1 gap-4">
              {pantry.length === 0 && <p className="text-center text-slate-400 py-12 italic">Your pantry is empty.</p>}
              {pantry.map(item => {
                const percent = (item.quantityRemaining / item.packageSize) * 100;
                return (
                  <div key={item.id} className="bg-white p-6 rounded-[32px] border border-slate-100 flex flex-col gap-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-black text-slate-800 capitalize">{item.name}</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">{item.packageFormat} of {item.packageSize} {item.unit}</p>
                      </div>
                      <p className="text-sm font-black text-indigo-600">{item.quantityRemaining.toFixed(1)} {item.unit} left</p>
                    </div>
                    <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, percent)}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase">
                      <span>Unit Cost: {formatCurrency(item.packagePrice / item.packageSize)}/{item.unit}</span>
                      <button onClick={() => setPantry(pantry.filter(i => i.id !== item.id))} className="text-red-400">Remove</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {view === 'recipes' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center px-2">
              <h2 className="text-xl font-black text-slate-900">Cookbook</h2>
              <button onClick={() => setIsCreatingRecipe(true)} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-xs">ADD NEW</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {recipes.map(recipe => (
                <div key={recipe.id} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-4">
                   <div className="flex justify-between">
                    <span className="text-[8px] font-black uppercase bg-indigo-50 text-indigo-600 px-2 py-1 rounded-md">{recipe.mealType}</span>
                    <span className="text-[8px] font-black uppercase bg-slate-50 text-slate-400 px-2 py-1 rounded-md">{recipe.difficulty}</span>
                   </div>
                   <h3 className="font-black text-lg text-slate-800 leading-tight cursor-pointer" onClick={() => setSelectedRecipe(recipe)}>{recipe.name}</h3>
                   <div className="flex justify-between items-center mt-auto pt-4 border-t border-slate-50">
                    <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">⏱️ {recipe.totalTime}m</span>
                    <button onClick={() => setSelectedRecipe(recipe)} className="text-[10px] font-black uppercase text-indigo-600">VIEW & PLAN</button>
                   </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'settings' && (
          <div className="space-y-6">
            <h2 className="text-xl font-black text-slate-900">Settings</h2>
            <div className="bg-white p-8 rounded-[32px] border border-slate-100 space-y-8 shadow-sm">
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Currency</label>
                <div className="grid grid-cols-4 gap-2">
                  {CURRENCIES.map(c => (
                    <button 
                      key={c.code}
                      onClick={() => setSettings({...settings, currency: c.code})}
                      className={`p-2 rounded-xl border-2 text-xs font-bold transition-all ${settings.currency === c.code ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : 'border-slate-50 text-slate-400'}`}
                    >
                      {c.code}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="w-full py-4 text-red-500 font-black text-xs bg-red-50 rounded-2xl uppercase tracking-widest">Wipe System Data</button>
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-100 z-50 px-8 py-4 flex justify-around items-center rounded-t-[40px]">
        {[
          { id: 'dashboard', icon: '🏠' },
          { id: 'recipes', icon: '📖' },
          { id: 'pantry', icon: '🧊' },
          { id: 'settings', icon: '⚙️' }
        ].map(tab => (
          <button 
            key={tab.id} 
            onClick={() => setView(tab.id)}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl transition-all ${view === tab.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-300'}`}
          >
            {tab.icon}
          </button>
        ))}
      </nav>

      {/* Grocery Checkout Modal */}
      {groceryCheckoutItem && (
        <div className="fixed inset-0 z-[150] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm p-10 rounded-[48px] shadow-2xl space-y-6">
            <h3 className="text-xl font-black text-slate-900">Purchased Bulk Details</h3>
            <p className="text-sm text-slate-500">Define how you bought <span className="font-bold text-slate-800 capitalize">{groceryCheckoutItem.name}</span></p>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              finalizePurchase(
                groceryCheckoutItem.id,
                parseFloat(f.get('size') as string),
                parseFloat(f.get('price') as string),
                f.get('format') as PackageFormat
              );
            }} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase">Package Format</label>
                <select name="format" className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none">
                  {PACKAGE_FORMATS.map(f => <option key={f} value={f}>{f.toUpperCase()}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase">Size ({groceryCheckoutItem.unit})</label>
                  <input name="size" type="number" step="0.1" defaultValue={groceryCheckoutItem.packageSize} required className="w-full p-4 bg-slate-50 rounded-2xl" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase">Total Price ({settings.currency})</label>
                  <input name="price" type="number" step="0.01" defaultValue={groceryCheckoutItem.packagePrice} required className="w-full p-4 bg-slate-50 rounded-2xl" />
                </div>
              </div>
              <button type="submit" className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black shadow-lg">CONFIRM PURCHASE</button>
              <button type="button" onClick={() => setGroceryCheckoutItem(null)} className="w-full py-3 text-slate-400 font-bold text-xs uppercase tracking-widest">Cancel</button>
            </form>
          </div>
        </div>
      )}

      {/* Multi-Assign Recipe Modal */}
      {selectedRecipe && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-t-[48px] sm:rounded-[48px] shadow-2xl relative animate-in slide-in-from-bottom duration-300">
            <button onClick={() => { setSelectedRecipe(null); setAssignmentDays([]); setAssignmentSlots([]); }} className="absolute top-8 right-8 w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-2xl">×</button>
            <div className="p-10 space-y-10">
              <header>
                <div className="flex gap-2 mb-4">
                  <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full uppercase">{selectedRecipe.mealType}</span>
                </div>
                <h2 className="text-3xl font-black text-slate-900 leading-tight mb-4">{selectedRecipe.name}</h2>
                <p className="text-slate-500 text-sm italic border-l-4 border-indigo-200 pl-4">{selectedRecipe.purpose}</p>
              </header>

              {/* Multi-Assignment Section */}
              <section className="bg-indigo-50/50 p-8 rounded-[40px] border border-indigo-100 space-y-6">
                <h3 className="text-sm font-black text-indigo-600 uppercase tracking-widest text-center">Assign to your week</h3>
                <div className="space-y-4">
                  <div className="flex flex-wrap justify-center gap-2">
                    {DAYS.map(d => (
                      <button 
                        key={d}
                        onClick={() => setAssignmentDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])}
                        className={`w-10 h-10 rounded-xl text-[10px] font-black flex items-center justify-center transition-all ${assignmentDays.includes(d) ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-400 border border-slate-100'}`}
                      >
                        {d.charAt(0)}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {activeMealTypes.map(mt => (
                      <button 
                        key={mt.type}
                        onClick={() => setAssignmentSlots(prev => prev.includes(mt.type) ? prev.filter(x => x !== mt.type) : [...prev, mt.type])}
                        className={`px-3 py-2 rounded-xl text-[10px] font-black flex items-center gap-2 transition-all ${assignmentSlots.includes(mt.type) ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-400 border border-slate-100'}`}
                      >
                        <span>{mt.icon}</span>
                        <span>{mt.label.toUpperCase()}</span>
                      </button>
                    ))}
                  </div>
                  <button 
                    onClick={applyAssignment}
                    disabled={assignmentDays.length === 0 || assignmentSlots.length === 0}
                    className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black shadow-lg disabled:bg-slate-300 disabled:shadow-none transition-all"
                  >
                    APPLY TO SCHEDULE
                  </button>
                </div>
              </section>

              <section>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Preparation</h3>
                  <div className="flex gap-2">
                    <button onClick={() => setInstructionMode('detailed')} className={`text-[8px] font-black px-2 py-1 rounded-md ${instructionMode === 'detailed' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400'}`}>DETAILED</button>
                    <button onClick={() => setInstructionMode('condensed')} className={`text-[8px] font-black px-2 py-1 rounded-md ${instructionMode === 'condensed' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400'}`}>QUICK</button>
                  </div>
                </div>
                <div className="space-y-4">
                  {(instructionMode === 'detailed' ? selectedRecipe.instructions : (selectedRecipe.condensedInstructions || selectedRecipe.instructions)).map((step, i) => (
                    <div key={i} className="flex gap-4">
                      <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-[10px] font-black flex-shrink-0">{i+1}</div>
                      <p className="text-slate-600 text-sm leading-relaxed">{step}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4">Ingredients</h3>
                <div className="space-y-2">
                  {selectedRecipe.ingredients.map((ing, i) => (
                    <div key={i} className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl">
                      <span className="text-sm font-bold text-slate-700 capitalize">{ing.name}</span>
                      <span className="text-xs font-black text-indigo-600">{ing.quantity} {ing.unit}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {/* Recipe Creator */}
      {isCreatingRecipe && (
        <div className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-[48px] p-10 shadow-2xl relative">
            <button onClick={() => setIsCreatingRecipe(false)} className="absolute top-8 right-8 text-2xl text-slate-400">×</button>
            <h2 className="text-2xl font-black mb-8">Add Recipe</h2>
            
            <div className="flex gap-4 mb-8">
              <button onClick={() => setCreatorMode('ai')} className={`flex-1 py-3 rounded-2xl font-black text-xs ${creatorMode === 'ai' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400'}`}>AI PASTE</button>
              <button onClick={() => setCreatorMode('manual')} className={`flex-1 py-3 rounded-2xl font-black text-xs ${creatorMode === 'manual' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400'}`}>MANUAL</button>
            </div>

            {creatorMode === 'ai' ? (
              <form onSubmit={handleAIParse} className="space-y-6">
                <textarea name="rawtext" placeholder="Paste full recipe here..." required className="w-full h-64 bg-slate-50 rounded-3xl p-6 outline-none text-sm" />
                <button type="submit" disabled={isGenerating} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black shadow-lg">PARSE & SAVE</button>
              </form>
            ) : (
              <form onSubmit={handleManualRecipeSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase">Recipe Name</label>
                    <input name="name" required className="w-full p-4 bg-slate-50 rounded-2xl" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase">Meal Type</label>
                    <select name="mealType" className="w-full p-4 bg-slate-50 rounded-2xl">
                      {MEAL_TYPES.map(m => <option key={m.type} value={m.type}>{m.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase">Ingredients (Name, Qty, Unit)</label>
                  <textarea name="ingredients_raw" placeholder="Chicken, 200, g" className="w-full h-32 p-4 bg-slate-50 rounded-2xl" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase">Instructions</label>
                  <textarea name="instructions" className="w-full h-32 p-4 bg-slate-50 rounded-2xl" />
                </div>
                <button type="submit" className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black shadow-lg">SAVE RECIPE</button>
              </form>
            )}
          </div>
        </div>
      )}

      {isGenerating && (
        <div className="fixed inset-0 z-[200] bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-4" />
          <h2 className="text-lg font-black text-slate-900">StudentFuel AI Processing</h2>
          <p className="text-xs text-slate-400 max-w-xs mt-2">Connecting loops and focusing your brain...</p>
        </div>
      )}
    </div>
  );

  function toggleMealType(type: MealType) {
    setSettings(prev => {
      const types = prev.selectedMealTypes.includes(type)
        ? prev.selectedMealTypes.filter(t => t !== type)
        : [...prev.selectedMealTypes, type];
      return { ...prev, selectedMealTypes: types };
    });
  }

  async function handleAIParse(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const raw = formData.get('rawtext') as string;
    setIsGenerating(true);
    try {
      const normalized = await normalizeRecipe(raw);
      if (normalized.name) {
        setRecipes([...recipes, { ...normalized as Recipe, id: Date.now().toString() }]);
        setIsCreatingRecipe(false);
      }
    } catch (e) {
      alert("Failed to parse. Try Manual Entry.");
    } finally {
      setIsGenerating(false);
    }
  }

  function handleManualRecipeSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newRecipe: Recipe = {
      id: Date.now().toString(),
      name: formData.get('name') as string,
      purpose: "Manual entry",
      equipment: [],
      difficulty: Difficulty.Moderate,
      prepTime: 10,
      cookTime: 10,
      totalTime: 20,
      servings: 1,
      ingredients: (formData.get('ingredients_raw') as string).split('\n').map(l => {
        const p = l.split(',');
        return { name: p[0]?.trim() || '', quantity: parseFloat(p[1]) || 1, unit: p[2]?.trim() || 'unit' };
      }).filter(i => i.name),
      instructions: (formData.get('instructions') as string).split('\n').filter(Boolean),
      tags: [],
      ingredientBenefits: {},
      mealType: formData.get('mealType') as MealType,
    };
    setRecipes([...recipes, newRecipe]);
    setIsCreatingRecipe(false);
  }
}
