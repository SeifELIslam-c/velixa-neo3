import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';

import { firebaseDb } from './firebase';

const BLT_COLLECTION_IMAGE = 'https://ik.imagekit.io/sanqe8dszx/Velixa.neo/main.png';
const VRAK_COLLECTION_IMAGE = 'https://ik.imagekit.io/sanqe8dszx/Velixa.neo/VRAK3.png';

const normalizeProduct = (product: any) => {
  if (product?.id === '1' || product?.name === 'BLT Airpods PRO 2.2') {
    return {
      ...product,
      image: BLT_COLLECTION_IMAGE,
    };
  }

  if (product?.id === '2' || product?.name === 'Airpods Pro VRAK') {
    return {
      ...product,
      image: VRAK_COLLECTION_IMAGE,
    };
  }

  return product;
};

export const subscribeToProducts = (callback: (products: any[]) => void) => {
  const productsQuery = query(collection(firebaseDb, 'products'), orderBy('name'));
  return onSnapshot(productsQuery, (snapshot) => {
    callback(snapshot.docs.map((doc) => normalizeProduct({ id: doc.id, ...doc.data() })));
  });
};

export const subscribeToOrders = (callback: (orders: any[]) => void) => {
  const ordersQuery = query(collection(firebaseDb, 'orders'), orderBy('createdAt', 'desc'));
  return onSnapshot(ordersQuery, (snapshot) => {
    callback(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  });
};

export const subscribeToSupportTickets = (callback: (tickets: any[]) => void) => {
  const ticketsQuery = query(collection(firebaseDb, 'supportTickets'), orderBy('createdAt', 'desc'));
  return onSnapshot(ticketsQuery, (snapshot) => {
    callback(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  });
};
