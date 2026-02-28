import { Product, Category } from './types';

export const CATEGORIES: Category[] = [
  { id: '1', name: 'Кухонне приладдя', slug: 'kitchen', image: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&q=80&w=800' },
  { id: '2', name: 'Посуд', slug: 'tableware', image: 'https://images.unsplash.com/photo-1517705008128-361805f42e86?auto=format&fit=crop&q=80&w=800' },
  { id: '3', name: 'Текстиль', slug: 'textile', image: 'https://images.unsplash.com/photo-1528906819430-d155e7078556?auto=format&fit=crop&q=80&w=800' },
  { id: '4', name: 'Організація простору', slug: 'organization', image: 'https://images.unsplash.com/photo-1594404341023-29419573f5ec?auto=format&fit=crop&q=80&w=800' },
  { id: '5', name: 'Термоси та пляшки', slug: 'bottles', image: 'https://images.unsplash.com/photo-1592089416462-2b0cb7da8379?auto=format&fit=crop&q=80&w=800' },
  { id: '6', name: 'Декор', slug: 'decor', image: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&q=80&w=800' },
];

export const MOCK_PRODUCTS: Product[] = [
  {
    id: 'p1',
    name: 'Керамічна чашка "Ранкова кава"',
    category: 'tableware',
    price: 350,
    image: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&q=80&w=800',
    description: 'Ручна робота, тепла кераміка, що зберігає тепло вашого напою.',
    material: 'Кераміка',
    brand: 'HomeCraft',
    isPopular: true,
    stock: 12,
    rating: 4.8,
    reviewCount: 24
  },
  {
    id: 'p2',
    name: 'Лляний рушник "Еко-стиль"',
    category: 'textile',
    price: 280,
    image: 'https://images.unsplash.com/photo-1605000797499-95a51c5269ae?auto=format&fit=crop&q=80&w=800',
    description: 'Натуральний льон, висока поглинальна здатність.',
    material: 'Льон',
    brand: 'EcoHome',
    isPopular: true,
    stock: 3,
    rating: 4.9,
    reviewCount: 15
  },
  {
    id: 'p3',
    name: 'Набір для сніданку "Затишок"',
    category: 'tableware',
    price: 1200,
    image: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&q=80&w=800',
    description: 'Комплект: чашка, тарілка та дерев\'яна підставка.',
    isBundle: true,
    bundleItems: ['p1', 'p4'],
    stock: 5,
    rating: 5.0,
    reviewCount: 8
  },
  {
    id: 'p4',
    name: 'Дерев\'яна дошка для сервірування',
    category: 'kitchen',
    price: 450,
    image: 'https://images.unsplash.com/photo-1533777857419-377a70617714?auto=format&fit=crop&q=80&w=800',
    description: 'Дубова дошка, оброблена натуральною олією.',
    material: 'Дуб',
    brand: 'WoodSoul',
    stock: 20,
    rating: 4.7,
    reviewCount: 32
  },
  {
    id: 'p5',
    name: 'Термос "Мандрівник" 500мл',
    category: 'bottles',
    price: 650,
    image: 'https://images.unsplash.com/photo-1592089416462-2b0cb7da8379?auto=format&fit=crop&q=80&w=800',
    description: 'Тримає тепло до 12 годин. Стильний матовий дизайн.',
    material: 'Нержавіюча сталь',
    brand: 'Traveler',
    stock: 15,
    rating: 4.6,
    reviewCount: 18
  }
];
