import { create } from 'zustand';

export interface Product {
  id: string;
  name: string;
  price: number;
  oldPrice?: number;
  category: string;
  stock: number;
  image: string;
  splineScene?: string;
  model3d?: boolean;
  buyPrice?: number;
}

export interface CartItem extends Product {
  quantity: number;
}

interface EcommerceState {
  products: Product[];
  cart: CartItem[];
  user: any | null;
  language: string;
  setProducts: (products: Product[]) => void;
  addToCart: (product: Product) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  setUser: (user: any | null) => void;
  setLanguage: (lang: string) => void;
  updateStock: (productId: string, quantity: number) => void;
  updateQuantity: (productId: string, delta: number) => void;
}

const mockProducts: Product[] = [
  { id: '1', name: 'BLT Airpods PRO 2.2', price: 1650, oldPrice: 2300, category: 'Audio', stock: 15, image: 'https://ik.imagekit.io/sanqe8dszx/Velixa.neo/main.png', model3d: true },
  { id: '2', name: 'Airpods Pro VRAK', price: 1000, oldPrice: 1900, category: 'Audio', stock: 20, image: 'https://ik.imagekit.io/sanqe8dszx/Velixa.neo/VRAK3.png' },
];

export const useStore = create<EcommerceState>((set) => ({
  products: mockProducts,
  cart: [],
  user: null,
  language: 'en',
  setProducts: (products) => set({ products }),
  addToCart: (product) =>
    set((state) => {
      const existing = state.cart.find((c) => c.id === product.id);
      if (existing) {
        return {
          cart: state.cart.map((c) =>
            c.id === product.id ? { ...c, quantity: c.quantity + 1 } : c
          ),
        };
      }
      return { cart: [...state.cart, { ...product, quantity: 1 }] };
    }),
  removeFromCart: (productId) =>
    set((state) => ({
      cart: state.cart.filter((c) => c.id !== productId),
    })),
  clearCart: () => set({ cart: [] }),
  setUser: (user) => set({ user }),
  setLanguage: (lang) => set({ language: lang }),
  updateStock: (productId, qty) => 
    set((state) => ({
      products: state.products.map(p => p.id === productId ? { ...p, stock: p.stock - qty } : p)
    })),
  updateQuantity: (productId, delta) =>
    set((state) => {
      const existing = state.cart.find((c) => c.id === productId);
      if (!existing) return state;
      const newQty = existing.quantity + delta;
      if (newQty <= 0) {
        return { cart: state.cart.filter((c) => c.id !== productId) };
      }
      return {
        cart: state.cart.map((c) => (c.id === productId ? { ...c, quantity: newQty } : c)),
      };
    }),
}));
