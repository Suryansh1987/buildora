export interface Pizza {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: 'vegetarian' | 'non-vegetarian' | 'specialty';
  size: 'small' | 'medium' | 'large';
  ingredients: string[];
}

export interface Category {
  id: string;
  name: string;
  description: string;
  image: string;
}

export interface Testimonial {
  id: string;
  name: string;
  rating: number;
  comment: string;
  avatar: string;
}

export interface CartItem {
  pizza: Pizza;
  quantity: number;
  selectedSize: 'small' | 'medium' | 'large';
}

export interface OrderItem {
  id: string;
  pizzaId: string;
  quantity: number;
  size: 'small' | 'medium' | 'large';
  price: number;
}