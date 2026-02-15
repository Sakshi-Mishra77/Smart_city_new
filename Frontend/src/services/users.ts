import { apiClient, ApiResponse } from './api';
import { API_ENDPOINTS } from '@/config/api';

export interface UserProfile {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  userType: 'citizen' | 'official';
  address?: string;
  pincode?: string;
  department?: string;
  twoFactorEnabled?: boolean;
}

export interface UserProfileUpdate {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  pincode?: string;
  department?: string;
}

export const usersService = {
  async getProfile(): Promise<ApiResponse<UserProfile>> {
    return apiClient.get<UserProfile>(API_ENDPOINTS.USERS.PROFILE);
  },

  async updateProfile(payload: UserProfileUpdate): Promise<ApiResponse<UserProfile>> {
    return apiClient.put<UserProfile>(API_ENDPOINTS.USERS.UPDATE_PROFILE, payload);
  },
};

