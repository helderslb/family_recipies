import fs from 'node:fs';
import path from 'node:path';

export const FAMILIES = ['Grandma', 'Mom', 'Family'] as const;
export const CATEGORIES = ['Mains', 'Desserts', 'Baking', 'Sides'] as const;

export type RecipeFamily = (typeof FAMILIES)[number];
export type RecipeCategory = (typeof CATEGORIES)[number];

export interface RecipeInput {
  title: string;
  description: string;
  image: string;
  author: string;
  family: string;
  category: string;
  prepTime: string;
  cookTime: string;
  totalTime: string;
  servings: string;
  video?: string;
  featured: boolean;
  ingredients: string[];
  steps: string[];
  titlePt?: string;
  descriptionPt?: string;
  ingredientsPt?: string[];
  stepsPt?: string[];
  /** English story — written as the markdown body. */
  story?: string;
  /** Portuguese story — kept in frontmatter so the body stays markdown. */
  storyPt?: string;
}

export function recipesDir(): string {
  return path.join(process.cwd(), 'src', 'content', 'recipes');
}

/** Resolve a slug to a file inside the recipes directory (or null if unsafe/missing). */
export function recipeFilePath(slug: string): string | null {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  const filePath = path.join(recipesDir(), `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;
  return filePath;
}

export function slugify(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function splitLines(raw: unknown): string[] {
  if (typeof raw !== 'string') return [];
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

export function recipeFromFormData(form: FormData): RecipeInput {
  const ingredientsPt = splitLines(form.get('ingredientsPt'));
  const stepsPt = splitLines(form.get('stepsPt'));

  return {
    title: field(form, 'title'),
    description: field(form, 'description'),
    image: field(form, 'image'),
    author: field(form, 'author'),
    family: field(form, 'family'),
    category: field(form, 'category'),
    prepTime: field(form, 'prepTime'),
    cookTime: field(form, 'cookTime'),
    totalTime: field(form, 'totalTime'),
    servings: field(form, 'servings'),
    video: field(form, 'video') || undefined,
    featured: form.get('featured') === 'on' || form.get('featured') === 'true',
    ingredients: splitLines(form.get('ingredients')),
    steps: splitLines(form.get('steps')),
    titlePt: field(form, 'titlePt') || undefined,
    descriptionPt: field(form, 'descriptionPt') || undefined,
    ingredientsPt: ingredientsPt.length > 0 ? ingredientsPt : undefined,
    stepsPt: stepsPt.length > 0 ? stepsPt : undefined,
    story: field(form, 'story') || undefined,
    storyPt: field(form, 'storyPt') || undefined,
  };
}

export function validateRecipe(input: RecipeInput): string | null {
  if (!input.title || !input.description || !input.author || !input.image) {
    return 'Missing required fields';
  }
  if (!FAMILIES.includes(input.family as RecipeFamily)) return 'Invalid family';
  if (!CATEGORIES.includes(input.category as RecipeCategory)) return 'Invalid category';
  if (input.ingredients.length === 0) return 'At least one ingredient is required';
  if (input.steps.length === 0) return 'At least one step is required';
  return null;
}

const RESERVED_SCALAR = /^(true|false|null|yes|no|on|off|~|-?\d+(\.\d+)?)$/i;

function yamlScalar(value: string): string {
  const needsQuotes =
    value === '' ||
    /[\n\r]/.test(value) ||
    /[:#\[\]{}&*!|>'"%@`]/.test(value) ||
    /^[-,?:>|]/.test(value) ||
    value.trim() !== value ||
    RESERVED_SCALAR.test(value);

  return needsQuotes ? JSON.stringify(value) : value;
}

function yamlLine(key: string, value: string): string {
  if (value.includes('\n')) {
    const block = value
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((line) => (line.length > 0 ? `  ${line}` : ''))
      .join('\n');
    return `${key}: |\n${block}`;
  }

  return `${key}: ${yamlScalar(value)}`;
}

function yamlList(key: string, values: string[]): string {
  const items = values.map((value) => `  - ${yamlScalar(value)}`).join('\n');
  return `${key}:\n${items}`;
}

/** Serialise a recipe to the markdown file format the content collection expects. */
export function buildRecipeMarkdown(input: RecipeInput): string {
  const frontmatter: string[] = ['---'];

  frontmatter.push(yamlLine('title', input.title));
  frontmatter.push(yamlLine('description', input.description));
  frontmatter.push(yamlLine('image', input.image));
  frontmatter.push(yamlLine('author', input.author));
  frontmatter.push(`family: ${yamlScalar(input.family)}`);
  frontmatter.push(`category: ${yamlScalar(input.category)}`);
  frontmatter.push(`prepTime: ${yamlScalar(input.prepTime)}`);
  frontmatter.push(`cookTime: ${yamlScalar(input.cookTime)}`);
  frontmatter.push(`totalTime: ${yamlScalar(input.totalTime)}`);
  frontmatter.push(`servings: ${yamlScalar(input.servings)}`);

  if (input.video) frontmatter.push(yamlLine('video', input.video));
  if (input.featured) frontmatter.push('featured: true');

  if (input.titlePt) frontmatter.push(yamlLine('titlePt', input.titlePt));
  if (input.descriptionPt) frontmatter.push(yamlLine('descriptionPt', input.descriptionPt));

  frontmatter.push(yamlList('ingredients', input.ingredients));
  frontmatter.push(yamlList('steps', input.steps));

  if (input.ingredientsPt?.length) frontmatter.push(yamlList('ingredientsPt', input.ingredientsPt));
  if (input.stepsPt?.length) frontmatter.push(yamlList('stepsPt', input.stepsPt));
  if (input.storyPt) frontmatter.push(yamlLine('storyPt', input.storyPt));

  frontmatter.push('---');

  const story = input.story?.trim();
  return `${frontmatter.join('\n')}\n${story ? `\n${story}\n` : '\n'}`;
}

/** Create or overwrite a recipe file. Returns false when the slug is unsafe. */
export function writeRecipeFile(slug: string, input: RecipeInput): boolean {
  if (!/^[a-z0-9-]+$/.test(slug)) return false;

  const dir = recipesDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${slug}.md`), buildRecipeMarkdown(input), 'utf8');
  return true;
}

/** Delete a recipe file. Best-effort: returns false only when the slug is unsafe. */
export function deleteRecipeFile(slug: string): boolean {
  if (!/^[a-z0-9-]+$/.test(slug)) return false;
  fs.rmSync(path.join(recipesDir(), `${slug}.md`), { force: true });
  return true;
}

