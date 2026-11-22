// Data from Restaurantes.xlsx (tab: Restaurantes). Coordinates looked up per restaurant.

export interface Restaurant {
  name: string;
  location: string;
  type: string;
  qualityPrice: string;
  ambience: string;
  rating: string;
  tripadvisor?: string;
  description: string;
  price: string;
  date: string;
  link: string;
  notes: string;
  lat: number;
  lng: number;
}
