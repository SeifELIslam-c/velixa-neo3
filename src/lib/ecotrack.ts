import axios from 'axios';

export class EcotrackClient {
  private baseURL: string;
  private token: string | undefined;

  constructor() {
    this.baseURL = 'https://ecotrack.dz/api/v1';
    this.token = import.meta.env.VITE_ECOTRACK_API_KEY;
  }

  private get headers() {
    if (!this.token) {
      console.warn("ECOTRACK API Token is missing. Set VITE_ECOTRACK_API_KEY in your .env file.");
    }
    return {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  async getCommunes(wilayaId?: number) {
    try {
      const url = wilayaId 
        ? `${this.baseURL}/get/communes?wilaya_id=${wilayaId}`
        : `${this.baseURL}/get/communes`;
      const response = await axios.get(url, { headers: this.headers });
      
      const data = response.data;
      if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
         return Object.values(data);
      }
      return data;
    } catch (error) {
      console.error("Failed to fetch Ecotrack communes:", error);
      throw error;
    }
  }

  async getFees() {
    try {
      const response = await axios.get(`${this.baseURL}/get/fees`, { headers: this.headers });
      return response.data;
    } catch (error) {
      console.error("Failed to fetch Ecotrack fees:", error);
      throw error;
    }
  }

  async getProducts() {
    try {
      const response = await axios.get(`${this.baseURL}/get/products/list`, { headers: this.headers });
      return response.data;
    } catch (error) {
      console.error("Failed to fetch Ecotrack products:", error);
      throw error;
    }
  }

  async createOrder(orderData: any) {
    try {
      const response = await axios.post(`${this.baseURL}/create/order`, orderData, { headers: this.headers });
      return response.data;
    } catch (error) {
      console.error("Failed to create Ecotrack order:", error);
      throw error;
    }
  }

  async updateOrder(orderId: string, orderData: any) {
    try {
      const response = await axios.put(`${this.baseURL}/update/order/${orderId}`, orderData, { headers: this.headers });
      return response.data;
    } catch (error) {
      console.error("Failed to update Ecotrack order:", error);
      throw error;
    }
  }

  async trackOrder(trackingNumber: string) {
    try {
      const response = await axios.get(`${this.baseURL}/track/${trackingNumber}`, { headers: this.headers });
      return response.data;
    } catch (error) {
      console.error("Failed to track Ecotrack order:", error);
      throw error;
    }
  }

  async requestReturn(trackingNumber: string) {
    try {
      const response = await axios.post(`${this.baseURL}/return/${trackingNumber}`, {}, { headers: this.headers });
      return response.data;
    } catch (error) {
      console.error("Failed to request Ecotrack return:", error);
      throw error;
    }
  }
}

export const ecotrackOptions = new EcotrackClient();
