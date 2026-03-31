export interface PlanDto {
  id: string;
  name: string;
  price: number;
  unitLimit: number;
  professionalLimit: number;
}

export interface UserPlanDto {
  planId: string;
  subscriptionId: string | null;
  subscriptionStatus: 'TRIAL' | 'ACTIVE' | 'CONFIRMED' | 'INACTIVE';
}

export interface PlanUpdatePayload {
  price?: number;
  unitLimit?: number;
  professionalLimit?: number;
}

export interface CheckoutPayload {
  planId: string;
  planPrice: number;
}

export interface CheckoutResponse {
  url: string;
}
