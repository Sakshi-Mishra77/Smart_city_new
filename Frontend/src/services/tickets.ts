import { apiClient, ApiResponse } from './api';
import { API_ENDPOINTS } from '@/config/api';

export interface Ticket {
  id: string;
  title: string;
  description?: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved' | 'verified';
  location: string;
  latitude?: number;
  longitude?: number;
  reportedBy: string;
  assignedTo?: string;
  assigneeName?: string;
  assigneePhone?: string;
  assigneePhotoUrl?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface TicketStats {
  totalTickets: number;
  openTickets: number;
  inProgress: number;
  resolvedToday: number;
  avgResponseTime: string;
  resolutionRate: number;
}

export interface UpdateStatusData {
  status: string;
  notes?: string;
}

export interface AssignTicketData {
  assignedTo?: string;
  assigneeName?: string;
  assigneePhone?: string;
  assigneePhoto?: string;
  notes?: string;
}



export const ticketService = {
  

  async getTickets(filters?: {
    status?: string;
    priority?: string;
    category?: string;
  }): Promise<ApiResponse<Ticket[]>> {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.priority) params.set('priority', filters.priority);
    if (filters?.category) params.set('category', filters.category);
    const query = params.toString();
    const queryParams = query ? `?${query}` : '';
    return apiClient.get<Ticket[]>(`${API_ENDPOINTS.TICKETS.LIST}${queryParams}`);
  },

  

  async getTicketById(id: string): Promise<ApiResponse<Ticket>> {
    return apiClient.get<Ticket>(API_ENDPOINTS.TICKETS.GET_BY_ID(id));
  },

  

  async updateStatus(id: string, data: UpdateStatusData): Promise<ApiResponse<Ticket>> {
    return apiClient.patch<Ticket>(API_ENDPOINTS.TICKETS.UPDATE_STATUS(id), data);
  },

  

  async assignTicket(id: string, data: AssignTicketData): Promise<ApiResponse<Ticket>> {
    return apiClient.post<Ticket>(API_ENDPOINTS.TICKETS.ASSIGN(id), data);
  },

  

  async getStats(): Promise<ApiResponse<TicketStats>> {
    return apiClient.get<TicketStats>(API_ENDPOINTS.TICKETS.STATS);
  },
};
