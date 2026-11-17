import { defineCollection, z } from 'astro:content';

const recipes = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    image: z.string(),
    author: z.string(),
    family: z.enum(['Grandma', 'Mom', 'Family']),
    category: z.enum(['Mains', 'Desserts', 'Baking', 'Sides']),
    prepTime: z.string(),
    cookTime: z.string(),
    totalTime: z.string(),
    servings: z.string(),
    video: z.string().url().optional(),
    ingredients: z.array(z.string()).min(1),
    steps: z.array(z.string()).min(1),
    featured: z.boolean().optional().default(false),

    // Portuguese translation (optional — the English fields are the fallback).
    titlePt: z.string().optional(),
    descriptionPt: z.string().optional(),
    ingredientsPt: z.array(z.string()).optional(),
    stepsPt: z.array(z.string()).optional(),
    /** Portuguese version of the markdown story kept in the body. */
    storyPt: z.string().optional(),
  }),
});

export const collections = {
  recipes,
};