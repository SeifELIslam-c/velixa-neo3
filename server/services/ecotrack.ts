import axios from 'axios';

import { config } from '../config';

const ecotrack = axios.create({
  baseURL: config.ecotrack.baseUrl,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

const authHeaders = () => ({
  Authorization: `Bearer ${config.ecotrack.apiKey}`,
});

export const ecotrackService = {
  isConfigured() {
    return Boolean(config.ecotrack.apiKey);
  },

  async getWilayas() {
    const response = await ecotrack.get('/get/wilayas', { headers: authHeaders() });
    return response.data;
  },

  async getCommunes(wilayaId?: number) {
    const url = wilayaId ? `/get/communes?wilaya_id=${wilayaId}` : '/get/communes';
    const response = await ecotrack.get(url, { headers: authHeaders() });
    return response.data;
  },

  async getFees() {
    const response = await ecotrack.get('/get/fees', { headers: authHeaders() });
    return response.data;
  },

  async getProducts() {
    const response = await ecotrack.get('/get/products/list', { headers: authHeaders() });
    return response.data;
  },

  async createOrder(payload: unknown) {
    const response = await ecotrack.post('/create/order', payload, { headers: authHeaders() });
    return response.data;
  },
};
