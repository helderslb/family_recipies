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
    // YouTube links and direct .mp4 URLs are both supported. We also accept
    // relative public paths (e.g. /videos/feijoada.mp4) so local videos render.
    video: z.string().optional(),
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