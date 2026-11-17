import type { CollectionEntry } from 'astro:content';
import type { Lang } from '@/i18n/ui';

export type RecipeEntry = CollectionEntry<'recipes'>;
export type RecipeData = RecipeEntry['data'];

export interface LocalizedRecipe {
  title: string;
  description: string;
  ingredients: string[];
  steps: string[];
  story: string;
}

/** Pick the recipe text for one language, falling back to the English fields. */
export function localizeRecipe(recipe: RecipeEntry, lang: Lang): LocalizedRecipe {
  const { data } = recipe;
  const body = recipe.body ?? '';
  const usePt = lang === 'pt';

  return {
    title: usePt && data.titlePt ? data.titlePt : data.title,
    description: usePt && data.descriptionPt ? data.descriptionPt : data.description,
    ingredients:
      usePt && data.ingredientsPt && data.ingredientsPt.length > 0
        ? data.ingredientsPt
        : data.ingredients,
    steps: usePt && data.stepsPt && data.stepsPt.length > 0 ? data.stepsPt : data.steps,
    story: usePt && data.storyPt ? data.storyPt : body,
  };
}

/** Both languages at once — used to render the switchable markup. */
export function bilingualRecipe(recipe: RecipeEntry) {
  return {
    en: localizeRecipe(recipe, 'en'),
    pt: localizeRecipe(recipe, 'pt'),
  };
}

/** Everything searchable for a recipe, in both languages. */
export function recipeSearchText(recipe: RecipeEntry): string {
  const { data } = recipe;
  return [
    data.title,
    data.description,
    data.author,
    data.family,
    data.category,
    ...data.ingredients,
    data.titlePt ?? '',
    data.descriptionPt ?? '',
    ...(data.ingredientsPt ?? []),
  ]
    .join(' ')
    .toLowerCase();
}

/** True when the recipe still only exists in English. */
export function missingPortuguese(recipe: RecipeEntry): boolean {
  const { data } = recipe;
  return !data.titlePt || !data.descriptionPt || !data.ingredientsPt?.length || !data.stepsPt?.length;
}

/** Split a plain-text story (frontmatter) into paragraphs. */
export function storyParagraphs(story: string): string[] {
  return story
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}
