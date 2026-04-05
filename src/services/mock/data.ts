import type {
  User,
  Household,
  HouseholdMember,
  InviteToken,
  Recipe,
  MealSlot,
  ShoppingListItem,
} from '@/types'

// ─── Current User ─────────────────────────────────────────────
export const mockCurrentUser: User = {
  id: 'u1',
  email: 'sarah@example.com',
  displayName: 'Sarah Chen',
  avatarUrl: undefined,
  createdAt: '2025-12-01T10:00:00Z',
}

// ─── Household ────────────────────────────────────────────────
export const mockHousehold: Household = {
  id: 'h1',
  name: 'The Chen-Park Home',
  color: '#22c55e',
  createdAt: '2025-12-01T10:00:00Z',
  memberCount: 3,
}

export const mockMembers: HouseholdMember[] = [
  {
    id: 'm1',
    userId: 'u1',
    householdId: 'h1',
    displayName: 'Sarah Chen',
    role: 'admin',
    joinedAt: '2025-12-01T10:00:00Z',
  },
  {
    id: 'm2',
    userId: 'u2',
    householdId: 'h1',
    displayName: 'Mike Park',
    role: 'member',
    joinedAt: '2025-12-05T14:30:00Z',
  },
  {
    id: 'm3',
    userId: 'u3',
    householdId: 'h1',
    displayName: 'Emma Park',
    role: 'member',
    joinedAt: '2026-01-10T09:15:00Z',
  },
]

export const mockInvite: InviteToken = {
  code: 'CHEN-PARK-7X2K',
  householdId: 'h1',
  expiresAt: '2026-04-01T00:00:00Z',
  createdBy: 'u1',
}

// ─── Recipes ──────────────────────────────────────────────────
export const mockRecipes: Recipe[] = [
  {
    id: 'r1',
    householdId: 'h1',
    title: 'Grilled Chicken Caesar Salad',
    description: 'A classic Caesar salad topped with juicy grilled chicken breast, crunchy croutons, and a creamy homemade dressing.',
    imageUrl: 'https://images.unsplash.com/photo-1546793665-c74683f339c1?w=600&h=400&fit=crop',
    prepTime: 15,
    cookTime: 20,
    servings: 4,
    tags: ['healthy', 'salad', 'quick', 'high-protein'],
    ingredients: [
      { id: 'i1', quantity: 2, unit: 'lbs', name: 'chicken breast' },
      { id: 'i2', quantity: 1, unit: 'head', name: 'romaine lettuce' },
      { id: 'i3', quantity: 0.5, unit: 'cup', name: 'parmesan cheese, shaved' },
      { id: 'i4', quantity: 1, unit: 'cup', name: 'croutons' },
      { id: 'i5', quantity: 0.25, unit: 'cup', name: 'Caesar dressing' },
      { id: 'i6', quantity: 1, unit: 'tbsp', name: 'olive oil' },
      { id: 'i7', quantity: 1, unit: 'pinch', name: 'salt and pepper' },
    ],
    instructions: [
      'Season chicken breasts with olive oil, salt, and pepper.',
      'Preheat grill or grill pan to medium-high heat.',
      'Grill chicken for 6-7 minutes per side until internal temperature reaches 165°F.',
      'Let chicken rest for 5 minutes, then slice into strips.',
      'Wash and chop romaine lettuce into bite-sized pieces.',
      'Toss lettuce with Caesar dressing in a large bowl.',
      'Top with sliced chicken, parmesan shavings, and croutons.',
      'Serve immediately with extra dressing on the side.',
    ],
    createdBy: 'u1',
    createdAt: '2026-01-15T08:00:00Z',
    updatedAt: '2026-01-15T08:00:00Z',
  },
  {
    id: 'r2',
    householdId: 'h1',
    title: 'Creamy Pasta Carbonara',
    description: 'An authentic Italian carbonara with crispy pancetta, eggs, pecorino, and fresh cracked pepper.',
    imageUrl: 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=600&h=400&fit=crop',
    prepTime: 10,
    cookTime: 20,
    servings: 4,
    tags: ['italian', 'pasta', 'comfort-food', 'dinner'],
    ingredients: [
      { id: 'i8', quantity: 1, unit: 'lb', name: 'spaghetti' },
      { id: 'i9', quantity: 6, unit: 'oz', name: 'pancetta or guanciale' },
      { id: 'i10', quantity: 4, unit: 'large', name: 'eggs' },
      { id: 'i11', quantity: 1, unit: 'cup', name: 'pecorino romano, grated' },
      { id: 'i12', quantity: 1, unit: 'tsp', name: 'black pepper, freshly cracked' },
      { id: 'i13', quantity: 1, unit: 'pinch', name: 'salt' },
    ],
    instructions: [
      'Bring a large pot of salted water to a boil. Cook spaghetti according to package directions.',
      'While pasta cooks, dice pancetta and cook in a large skillet over medium heat until crispy (8-10 min).',
      'In a bowl, whisk together eggs, grated pecorino, and black pepper.',
      'Reserve 1 cup of pasta water before draining.',
      'Add hot drained pasta to the skillet with pancetta (heat OFF).',
      'Quickly pour egg mixture over hot pasta and toss vigorously, adding pasta water as needed.',
      'The residual heat will create a creamy sauce. Do not scramble the eggs.',
      'Serve immediately with extra pecorino and pepper on top.',
    ],
    createdBy: 'u2',
    createdAt: '2026-01-20T12:00:00Z',
    updatedAt: '2026-01-20T12:00:00Z',
  },
  {
    id: 'r3',
    householdId: 'h1',
    title: 'Thai Green Curry',
    description: 'Fragrant and creamy Thai green curry with chicken, bamboo shoots, and fresh basil served over jasmine rice.',
    imageUrl: 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=600&h=400&fit=crop',
    prepTime: 15,
    cookTime: 25,
    servings: 4,
    tags: ['thai', 'curry', 'spicy', 'dinner'],
    ingredients: [
      { id: 'i14', quantity: 1.5, unit: 'lbs', name: 'chicken thighs, sliced' },
      { id: 'i15', quantity: 3, unit: 'tbsp', name: 'green curry paste' },
      { id: 'i16', quantity: 1, unit: 'can', name: 'coconut milk (14 oz)' },
      { id: 'i17', quantity: 1, unit: 'cup', name: 'bamboo shoots' },
      { id: 'i18', quantity: 1, unit: 'cup', name: 'Thai basil leaves' },
      { id: 'i19', quantity: 2, unit: 'tbsp', name: 'fish sauce' },
      { id: 'i20', quantity: 1, unit: 'tbsp', name: 'brown sugar' },
      { id: 'i21', quantity: 2, unit: 'cups', name: 'jasmine rice' },
    ],
    instructions: [
      'Cook jasmine rice according to package directions.',
      'Heat a splash of coconut cream (thick part from top of can) in a large pan over medium-high heat.',
      'Add green curry paste and fry for 1-2 minutes until fragrant.',
      'Add sliced chicken and cook until lightly browned on all sides.',
      'Pour in remaining coconut milk and bring to a gentle simmer.',
      'Add bamboo shoots, fish sauce, and brown sugar. Simmer for 15 minutes.',
      'Stir in Thai basil leaves just before serving.',
      'Serve curry over jasmine rice.',
    ],
    createdBy: 'u1',
    createdAt: '2026-02-01T16:00:00Z',
    updatedAt: '2026-02-01T16:00:00Z',
  },
  {
    id: 'r4',
    householdId: 'h1',
    title: 'Overnight Oats with Berries',
    description: 'No-cook overnight oats layered with mixed berries, honey, and a touch of vanilla. Perfect grab-and-go breakfast.',
    imageUrl: 'https://images.unsplash.com/photo-1517673400267-0251440c45dc?w=600&h=400&fit=crop',
    prepTime: 5,
    cookTime: 0,
    servings: 2,
    tags: ['breakfast', 'healthy', 'no-cook', 'meal-prep'],
    ingredients: [
      { id: 'i22', quantity: 1, unit: 'cup', name: 'rolled oats' },
      { id: 'i23', quantity: 1, unit: 'cup', name: 'milk (any type)' },
      { id: 'i24', quantity: 0.5, unit: 'cup', name: 'Greek yogurt' },
      { id: 'i25', quantity: 1, unit: 'cup', name: 'mixed berries' },
      { id: 'i26', quantity: 2, unit: 'tbsp', name: 'honey' },
      { id: 'i27', quantity: 1, unit: 'tsp', name: 'vanilla extract' },
      { id: 'i28', quantity: 2, unit: 'tbsp', name: 'chia seeds' },
    ],
    instructions: [
      'In a jar or container, combine rolled oats, milk, yogurt, chia seeds, honey, and vanilla.',
      'Stir well to combine everything.',
      'Top with mixed berries (or layer them).',
      'Cover and refrigerate overnight (at least 4 hours).',
      'In the morning, stir and add more milk if too thick.',
      'Top with additional berries and a drizzle of honey.',
    ],
    createdBy: 'u3',
    createdAt: '2026-02-05T07:00:00Z',
    updatedAt: '2026-02-05T07:00:00Z',
  },
  {
    id: 'r5',
    householdId: 'h1',
    title: 'Black Bean Tacos',
    description: 'Quick vegetarian tacos with seasoned black beans, fresh pico, avocado, and a squeeze of lime.',
    imageUrl: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=600&h=400&fit=crop',
    prepTime: 10,
    cookTime: 10,
    servings: 4,
    tags: ['vegetarian', 'mexican', 'quick', 'dinner'],
    ingredients: [
      { id: 'i29', quantity: 2, unit: 'cans', name: 'black beans, drained' },
      { id: 'i30', quantity: 8, unit: '', name: 'small corn tortillas' },
      { id: 'i31', quantity: 2, unit: '', name: 'avocados' },
      { id: 'i32', quantity: 1, unit: 'cup', name: 'pico de gallo' },
      { id: 'i33', quantity: 1, unit: 'cup', name: 'shredded lettuce' },
      { id: 'i34', quantity: 0.5, unit: 'cup', name: 'sour cream' },
      { id: 'i35', quantity: 2, unit: '', name: 'limes' },
      { id: 'i36', quantity: 1, unit: 'tsp', name: 'cumin' },
      { id: 'i37', quantity: 1, unit: 'tsp', name: 'chili powder' },
    ],
    instructions: [
      'Heat black beans in a saucepan with cumin and chili powder over medium heat.',
      'Mash about half the beans for a creamier texture, leave the rest whole.',
      'Warm tortillas in a dry skillet or directly over a gas flame.',
      'Slice avocados and squeeze lime juice over them.',
      'Assemble tacos: beans, lettuce, pico, avocado, and a dollop of sour cream.',
      'Serve with lime wedges on the side.',
    ],
    createdBy: 'u2',
    createdAt: '2026-02-10T18:00:00Z',
    updatedAt: '2026-02-10T18:00:00Z',
  },
  {
    id: 'r6',
    householdId: 'h1',
    title: 'Honey Garlic Salmon',
    description: 'Pan-seared salmon glazed with a sweet and savory honey garlic sauce, served with roasted vegetables.',
    imageUrl: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=600&h=400&fit=crop',
    prepTime: 10,
    cookTime: 20,
    servings: 4,
    tags: ['seafood', 'healthy', 'dinner', 'high-protein'],
    ingredients: [
      { id: 'i38', quantity: 4, unit: '', name: 'salmon fillets (6 oz each)' },
      { id: 'i39', quantity: 3, unit: 'tbsp', name: 'honey' },
      { id: 'i40', quantity: 3, unit: 'cloves', name: 'garlic, minced' },
      { id: 'i41', quantity: 2, unit: 'tbsp', name: 'soy sauce' },
      { id: 'i42', quantity: 1, unit: 'lb', name: 'broccoli florets' },
      { id: 'i43', quantity: 2, unit: '', name: 'bell peppers, sliced' },
      { id: 'i44', quantity: 2, unit: 'tbsp', name: 'olive oil' },
    ],
    instructions: [
      'Preheat oven to 400°F. Toss broccoli and bell peppers with olive oil, salt, and pepper on a baking sheet.',
      'Roast vegetables for 20 minutes.',
      'Mix honey, minced garlic, and soy sauce in a small bowl.',
      'Heat a skillet over medium-high heat. Season salmon with salt and pepper.',
      'Sear salmon skin-side up for 3-4 minutes until golden.',
      'Flip salmon and pour honey garlic sauce over the fillets.',
      'Cook 3-4 more minutes, spooning sauce over the fish.',
      'Serve salmon over roasted vegetables with extra sauce.',
    ],
    createdBy: 'u1',
    createdAt: '2026-02-14T19:00:00Z',
    updatedAt: '2026-02-14T19:00:00Z',
  },
  {
    id: 'r7',
    householdId: 'h1',
    title: 'French Toast with Maple Syrup',
    description: 'Thick-cut brioche French toast with cinnamon, vanilla, and real maple syrup.',
    imageUrl: 'https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=600&h=400&fit=crop',
    prepTime: 10,
    cookTime: 15,
    servings: 4,
    tags: ['breakfast', 'brunch', 'sweet', 'weekend'],
    ingredients: [
      { id: 'i45', quantity: 8, unit: 'slices', name: 'brioche bread, thick cut' },
      { id: 'i46', quantity: 4, unit: 'large', name: 'eggs' },
      { id: 'i47', quantity: 0.75, unit: 'cup', name: 'whole milk' },
      { id: 'i48', quantity: 1, unit: 'tsp', name: 'cinnamon' },
      { id: 'i49', quantity: 1, unit: 'tsp', name: 'vanilla extract' },
      { id: 'i50', quantity: 2, unit: 'tbsp', name: 'butter' },
      { id: 'i51', quantity: 0.5, unit: 'cup', name: 'maple syrup' },
    ],
    instructions: [
      'Whisk eggs, milk, cinnamon, and vanilla in a shallow bowl.',
      'Heat butter in a large skillet or griddle over medium heat.',
      'Dip each slice of brioche into the egg mixture, coating both sides.',
      'Cook on the griddle for 2-3 minutes per side until golden brown.',
      'Repeat with remaining slices, adding more butter as needed.',
      'Serve stacked with maple syrup and fresh berries if desired.',
    ],
    createdBy: 'u3',
    createdAt: '2026-02-18T08:00:00Z',
    updatedAt: '2026-02-18T08:00:00Z',
  },
  {
    id: 'r8',
    householdId: 'h1',
    title: 'Mushroom Risotto',
    description: 'Creamy arborio rice slowly cooked with mixed mushrooms, white wine, parmesan, and fresh thyme.',
    imageUrl: 'https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=600&h=400&fit=crop',
    prepTime: 10,
    cookTime: 35,
    servings: 4,
    tags: ['italian', 'vegetarian', 'dinner', 'comfort-food'],
    ingredients: [
      { id: 'i52', quantity: 1.5, unit: 'cups', name: 'arborio rice' },
      { id: 'i53', quantity: 1, unit: 'lb', name: 'mixed mushrooms, sliced' },
      { id: 'i54', quantity: 4, unit: 'cups', name: 'vegetable broth, warm' },
      { id: 'i55', quantity: 0.5, unit: 'cup', name: 'dry white wine' },
      { id: 'i56', quantity: 1, unit: '', name: 'onion, finely diced' },
      { id: 'i57', quantity: 3, unit: 'cloves', name: 'garlic, minced' },
      { id: 'i58', quantity: 0.75, unit: 'cup', name: 'parmesan, grated' },
      { id: 'i59', quantity: 2, unit: 'tbsp', name: 'butter' },
      { id: 'i60', quantity: 1, unit: 'tbsp', name: 'fresh thyme' },
    ],
    instructions: [
      'Sauté mushrooms in butter over high heat until golden. Set aside.',
      'In the same pan, cook onion and garlic in olive oil until soft (3-4 min).',
      'Add arborio rice and stir for 1 minute to toast the grains.',
      'Pour in white wine and stir until absorbed.',
      'Add warm broth one ladle at a time, stirring frequently and waiting until each addition is absorbed.',
      'Continue for about 18-20 minutes until rice is creamy and al dente.',
      'Stir in cooked mushrooms, parmesan, butter, and thyme.',
      'Season with salt and pepper. Serve immediately.',
    ],
    createdBy: 'u1',
    createdAt: '2026-02-22T17:00:00Z',
    updatedAt: '2026-02-22T17:00:00Z',
  },
  {
    id: 'r9',
    householdId: 'h1',
    title: 'Chicken Stir Fry',
    description: 'Fast and flavorful chicken stir fry with colorful vegetables in a savory ginger-soy sauce.',
    imageUrl: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=600&h=400&fit=crop',
    prepTime: 15,
    cookTime: 10,
    servings: 4,
    tags: ['asian', 'quick', 'dinner', 'healthy'],
    ingredients: [
      { id: 'i61', quantity: 1.5, unit: 'lbs', name: 'chicken breast, sliced thin' },
      { id: 'i62', quantity: 2, unit: 'cups', name: 'broccoli florets' },
      { id: 'i63', quantity: 1, unit: '', name: 'red bell pepper, sliced' },
      { id: 'i64', quantity: 1, unit: 'cup', name: 'snap peas' },
      { id: 'i65', quantity: 3, unit: 'tbsp', name: 'soy sauce' },
      { id: 'i66', quantity: 1, unit: 'tbsp', name: 'sesame oil' },
      { id: 'i67', quantity: 1, unit: 'tbsp', name: 'fresh ginger, grated' },
      { id: 'i68', quantity: 2, unit: 'cloves', name: 'garlic, minced' },
      { id: 'i69', quantity: 1, unit: 'tbsp', name: 'cornstarch' },
    ],
    instructions: [
      'Mix soy sauce, sesame oil, ginger, garlic, and cornstarch for the sauce.',
      'Heat oil in a wok or large skillet over high heat.',
      'Stir-fry chicken until golden and cooked through (4-5 min). Remove and set aside.',
      'Add broccoli, bell pepper, and snap peas. Stir-fry for 2-3 minutes.',
      'Return chicken to the wok and pour sauce over everything.',
      'Toss until sauce thickens and coats all ingredients (1-2 min).',
      'Serve over steamed rice or noodles.',
    ],
    createdBy: 'u2',
    createdAt: '2026-03-01T15:00:00Z',
    updatedAt: '2026-03-01T15:00:00Z',
  },
  {
    id: 'r10',
    householdId: 'h1',
    title: 'Greek Yogurt Parfait',
    description: 'Layered Greek yogurt with homemade granola, fresh fruit, and a drizzle of honey.',
    imageUrl: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=600&h=400&fit=crop',
    prepTime: 5,
    cookTime: 0,
    servings: 2,
    tags: ['breakfast', 'healthy', 'no-cook', 'snack'],
    ingredients: [
      { id: 'i70', quantity: 2, unit: 'cups', name: 'Greek yogurt' },
      { id: 'i71', quantity: 0.5, unit: 'cup', name: 'granola' },
      { id: 'i72', quantity: 1, unit: 'cup', name: 'mixed fresh fruit' },
      { id: 'i73', quantity: 2, unit: 'tbsp', name: 'honey' },
      { id: 'i74', quantity: 2, unit: 'tbsp', name: 'sliced almonds' },
    ],
    instructions: [
      'Spoon a layer of Greek yogurt into the bottom of a glass or jar.',
      'Add a layer of granola.',
      'Add a layer of fresh fruit.',
      'Repeat layers until the glass is full.',
      'Top with sliced almonds and a drizzle of honey.',
      'Serve immediately or refrigerate for up to 2 hours.',
    ],
    createdBy: 'u1',
    createdAt: '2026-03-05T07:30:00Z',
    updatedAt: '2026-03-05T07:30:00Z',
  },
]

// ─── Meal Plan (current week: March 9-15, 2026) ───────────────
function generateWeekSlots(weekStartDate: string): MealSlot[] {
  const start = new Date(weekStartDate)
  const slots: MealSlot[] = []
  const mealTypes: Array<'breakfast' | 'lunch' | 'dinner'> = ['breakfast', 'lunch', 'dinner']

  for (let d = 0; d < 7; d++) {
    const date = new Date(start)
    date.setDate(start.getDate() + d)
    const dateStr = date.toISOString().split('T')[0]

    for (const mealType of mealTypes) {
      slots.push({
        id: `slot-${dateStr}-${mealType}`,
        date: dateStr,
        mealType,
        recipeId: undefined,
        recipe: undefined,
      })
    }
  }
  return slots
}

export const mockMealSlots: MealSlot[] = (() => {
  const slots = generateWeekSlots('2026-03-09')

  // Assign some recipes to slots
  const assignments: Record<string, string> = {
    'slot-2026-03-09-breakfast': 'r4',  // Overnight Oats
    'slot-2026-03-09-dinner': 'r1',     // Grilled Chicken Salad
    'slot-2026-03-10-breakfast': 'r10',  // Greek Yogurt Parfait
    'slot-2026-03-10-dinner': 'r2',     // Pasta Carbonara
    'slot-2026-03-11-breakfast': 'r7',   // French Toast
    'slot-2026-03-11-dinner': 'r3',     // Thai Green Curry (tonight!)
    'slot-2026-03-12-dinner': 'r6',     // Honey Garlic Salmon
    'slot-2026-03-13-breakfast': 'r4',   // Overnight Oats
    'slot-2026-03-13-dinner': 'r5',     // Black Bean Tacos
    'slot-2026-03-14-dinner': 'r8',     // Mushroom Risotto
    'slot-2026-03-15-breakfast': 'r7',   // French Toast
    'slot-2026-03-15-dinner': 'r9',     // Chicken Stir Fry
  }

  return slots.map(slot => {
    const recipeId = assignments[slot.id]
    if (recipeId) {
      const recipe = mockRecipes.find(r => r.id === recipeId)
      return { ...slot, recipeId, recipe }
    }
    return slot
  })
})()

// ─── Shopping List ────────────────────────────────────────────
export const mockShoppingItems: ShoppingListItem[] = [
  // Produce
  { id: 'si1', householdId: 'h1', name: 'Romaine lettuce', quantity: 2, unit: 'heads', category: 'produce', checked: false, sourceRecipeId: 'r1', sourceRecipeName: 'Grilled Chicken Caesar Salad', addedBy: 'u1', addedAt: '2026-03-09T10:00:00Z', syncStatus: 'synced' },
  { id: 'si2', householdId: 'h1', name: 'Fresh basil', quantity: 1, unit: 'bunch', category: 'produce', checked: false, sourceRecipeId: 'r3', sourceRecipeName: 'Thai Green Curry', addedBy: 'u1', addedAt: '2026-03-09T10:00:00Z', syncStatus: 'synced' },
  { id: 'si3', householdId: 'h1', name: 'Broccoli', quantity: 2, unit: 'lbs', category: 'produce', checked: true, addedBy: 'u2', addedAt: '2026-03-09T10:05:00Z', syncStatus: 'synced' },
  { id: 'si4', householdId: 'h1', name: 'Bell peppers', quantity: 4, unit: '', category: 'produce', checked: false, addedBy: 'u1', addedAt: '2026-03-09T10:05:00Z', syncStatus: 'synced' },
  { id: 'si5', householdId: 'h1', name: 'Avocados', quantity: 3, unit: '', category: 'produce', checked: false, sourceRecipeId: 'r5', sourceRecipeName: 'Black Bean Tacos', addedBy: 'u2', addedAt: '2026-03-09T10:10:00Z', syncStatus: 'synced' },
  { id: 'si6', householdId: 'h1', name: 'Limes', quantity: 4, unit: '', category: 'produce', checked: true, addedBy: 'u2', addedAt: '2026-03-09T10:10:00Z', syncStatus: 'synced' },
  { id: 'si7', householdId: 'h1', name: 'Mixed mushrooms', quantity: 1, unit: 'lb', category: 'produce', checked: false, sourceRecipeId: 'r8', sourceRecipeName: 'Mushroom Risotto', addedBy: 'u1', addedAt: '2026-03-10T08:00:00Z', syncStatus: 'synced' },

  // Dairy
  { id: 'si8', householdId: 'h1', name: 'Greek yogurt', quantity: 2, unit: 'cups', category: 'dairy', checked: false, sourceRecipeId: 'r4', sourceRecipeName: 'Overnight Oats', addedBy: 'u3', addedAt: '2026-03-09T10:00:00Z', syncStatus: 'synced' },
  { id: 'si9', householdId: 'h1', name: 'Parmesan cheese', quantity: 1, unit: 'block', category: 'dairy', checked: false, addedBy: 'u1', addedAt: '2026-03-09T10:00:00Z', syncStatus: 'synced' },
  { id: 'si10', householdId: 'h1', name: 'Eggs (dozen)', quantity: 1, unit: '', category: 'dairy', checked: true, addedBy: 'u1', addedAt: '2026-03-09T10:00:00Z', syncStatus: 'synced' },
  { id: 'si11', householdId: 'h1', name: 'Whole milk', quantity: 1, unit: 'gallon', category: 'dairy', checked: false, addedBy: 'u3', addedAt: '2026-03-10T08:00:00Z', syncStatus: 'synced' },
  { id: 'si12', householdId: 'h1', name: 'Sour cream', quantity: 1, unit: 'container', category: 'dairy', checked: false, sourceRecipeId: 'r5', sourceRecipeName: 'Black Bean Tacos', addedBy: 'u2', addedAt: '2026-03-10T08:00:00Z', syncStatus: 'synced' },

  // Meat
  { id: 'si13', householdId: 'h1', name: 'Chicken breast', quantity: 3, unit: 'lbs', category: 'meat', checked: false, addedBy: 'u1', addedAt: '2026-03-09T10:00:00Z', syncStatus: 'synced' },
  { id: 'si14', householdId: 'h1', name: 'Salmon fillets', quantity: 4, unit: '', category: 'meat', checked: false, sourceRecipeId: 'r6', sourceRecipeName: 'Honey Garlic Salmon', addedBy: 'u1', addedAt: '2026-03-09T10:00:00Z', syncStatus: 'synced' },
  { id: 'si15', householdId: 'h1', name: 'Pancetta', quantity: 6, unit: 'oz', category: 'meat', checked: false, sourceRecipeId: 'r2', sourceRecipeName: 'Pasta Carbonara', addedBy: 'u2', addedAt: '2026-03-10T08:00:00Z', syncStatus: 'synced' },

  // Pantry
  { id: 'si16', householdId: 'h1', name: 'Arborio rice', quantity: 1, unit: 'bag', category: 'pantry', checked: false, sourceRecipeId: 'r8', sourceRecipeName: 'Mushroom Risotto', addedBy: 'u1', addedAt: '2026-03-09T10:00:00Z', syncStatus: 'synced' },
  { id: 'si17', householdId: 'h1', name: 'Spaghetti', quantity: 1, unit: 'lb', category: 'pantry', checked: true, addedBy: 'u2', addedAt: '2026-03-09T10:00:00Z', syncStatus: 'synced' },
  { id: 'si18', householdId: 'h1', name: 'Coconut milk', quantity: 2, unit: 'cans', category: 'pantry', checked: false, sourceRecipeId: 'r3', sourceRecipeName: 'Thai Green Curry', addedBy: 'u1', addedAt: '2026-03-09T10:05:00Z', syncStatus: 'synced' },
  { id: 'si19', householdId: 'h1', name: 'Green curry paste', quantity: 1, unit: 'jar', category: 'pantry', checked: false, sourceRecipeId: 'r3', sourceRecipeName: 'Thai Green Curry', addedBy: 'u1', addedAt: '2026-03-09T10:05:00Z', syncStatus: 'synced' },
  { id: 'si20', householdId: 'h1', name: 'Black beans', quantity: 2, unit: 'cans', category: 'pantry', checked: false, sourceRecipeId: 'r5', sourceRecipeName: 'Black Bean Tacos', addedBy: 'u2', addedAt: '2026-03-10T08:00:00Z', syncStatus: 'synced' },
  { id: 'si21', householdId: 'h1', name: 'Honey', quantity: 1, unit: 'bottle', category: 'pantry', checked: true, addedBy: 'u3', addedAt: '2026-03-10T08:00:00Z', syncStatus: 'synced' },
  { id: 'si22', householdId: 'h1', name: 'Soy sauce', quantity: 1, unit: 'bottle', category: 'pantry', checked: false, addedBy: 'u1', addedAt: '2026-03-10T09:00:00Z', syncStatus: 'pending' },

  // Bakery
  { id: 'si23', householdId: 'h1', name: 'Brioche bread', quantity: 1, unit: 'loaf', category: 'bakery', checked: false, sourceRecipeId: 'r7', sourceRecipeName: 'French Toast', addedBy: 'u3', addedAt: '2026-03-10T08:00:00Z', syncStatus: 'synced' },
  { id: 'si24', householdId: 'h1', name: 'Corn tortillas', quantity: 1, unit: 'pack', category: 'bakery', checked: false, sourceRecipeId: 'r5', sourceRecipeName: 'Black Bean Tacos', addedBy: 'u2', addedAt: '2026-03-10T08:00:00Z', syncStatus: 'synced' },

  // Frozen
  { id: 'si25', householdId: 'h1', name: 'Mixed berries', quantity: 1, unit: 'bag', category: 'frozen', checked: false, sourceRecipeId: 'r4', sourceRecipeName: 'Overnight Oats', addedBy: 'u3', addedAt: '2026-03-09T10:00:00Z', syncStatus: 'synced' },

  // Household
  { id: 'si26', householdId: 'h1', name: 'Paper towels', quantity: 2, unit: 'rolls', category: 'household', checked: false, addedBy: 'u2', addedAt: '2026-03-10T12:00:00Z', syncStatus: 'synced' },
  { id: 'si27', householdId: 'h1', name: 'Dish soap', quantity: 1, unit: '', category: 'household', checked: true, addedBy: 'u1', addedAt: '2026-03-09T10:00:00Z', syncStatus: 'synced' },
]

// ─── Helper to get today's dinner recipe ──────────────────────
export function getTonightsDinner(): Recipe | undefined {
  const today = '2026-03-11'
  const dinnerSlot = mockMealSlots.find(s => s.date === today && s.mealType === 'dinner')
  return dinnerSlot?.recipe
}

// ─── All unique tags from recipes ─────────────────────────────
export function getAllTags(): string[] {
  const tags = new Set<string>()
  mockRecipes.forEach(r => r.tags.forEach(t => tags.add(t)))
  return Array.from(tags).sort()
}
