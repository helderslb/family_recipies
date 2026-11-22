import { ensureSchema, getDb } from '@/lib/db';
import type { Restaurant } from '@/lib/restaurants';

export interface RestaurantRow {
  id: number;
  data: Restaurant;
}

export async function listRestaurants(): Promise<RestaurantRow[]> {
  const db = getDb();
  if (!db) return [];

  await ensureSchema();
  const result = await db.execute('SELECT id, data FROM restaurants');

  return result.rows
    .map((row) => ({ id: Number(row.id), data: JSON.parse(String(row.data)) as Restaurant }))
    .sort((a, b) => a.data.name.localeCompare(b.data.name));
}

export async function createRestaurant(data: Restaurant): Promise<void> {
  const db = getDb();
  if (!db) return;

  await ensureSchema();
  await db.execute({
    sql: 'INSERT INTO restaurants (data, updated_at) VALUES (?, ?)',
    args: [JSON.stringify(data), Date.now()],
  });
}

export async function updateRestaurant(id: number, data: Restaurant): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  await ensureSchema();
  const result = await db.execute({
    sql: 'UPDATE restaurants SET data = ?, updated_at = ? WHERE id = ?',
    args: [JSON.stringify(data), Date.now(), id],
  });
  return result.rowsAffected > 0;
}

export async function deleteRestaurant(id: number): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  await ensureSchema();
  const result = await db.execute({ sql: 'DELETE FROM restaurants WHERE id = ?', args: [id] });
  return result.rowsAffected > 0;
}

function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

export function restaurantFromFormData(form: FormData): Restaurant {
  return {
    name: field(form, 'name'),
    location: field(form, 'location'),
    type: field(form, 'type'),
    qualityPrice: field(form, 'qualityPrice'),
    ambience: field(form, 'ambience'),
    rating: field(form, 'rating'),
    tripadvisor: field(form, 'tripadvisor') || undefined,
    description: field(form, 'description'),
    price: field(form, 'price'),
    date: field(form, 'date'),
    link: field(form, 'link'),
    notes: field(form, 'notes'),
    lat: Number.parseFloat(field(form, 'lat')) || 0,
    lng: Number.parseFloat(field(form, 'lng')) || 0,
  };
}

export function validateRestaurant(input: Restaurant): string | null {
  if (!input.name) return 'A name is required';
  return null;
}