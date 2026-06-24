export type UserRole = 'super_admin' | 'owner' | 'manager' | 'receptionist'
export type OccupancyType = 'single' | 'double'
export type MealPlan = 'BB' | 'HB' | 'FB'
export type BookingStatus = 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled'
export type BookingSource = 'manual' | 'whatsapp_ai'
export type PaymentType = 'deposit' | 'balance'

export interface RoomPrices {
  single: { bb: number; hb: number; fb: number }
  double: { bb: number; hb: number; fb: number }
  extra_pax: { bb: number; hb: number; fb: number }
}

export interface Database {
  public: {
    Tables: {
      accounts: {
        Row: {
          id: string
          owner_id: string
          business_name: string
          created_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          business_name: string
          created_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          business_name?: string
          created_at?: string
        }
      }
      users: {
        Row: {
          id: string
          account_id: string
          email: string
          full_name: string | null
          role: UserRole
          created_at: string
        }
        Insert: {
          id: string
          account_id: string
          email: string
          full_name?: string | null
          role?: UserRole
          created_at?: string
        }
        Update: {
          id?: string
          account_id?: string
          email?: string
          full_name?: string | null
          role?: UserRole
          created_at?: string
        }
      }
      properties: {
        Row: {
          id: string
          account_id: string
          name: string
          logo_url: string | null
          currency: string
          created_at: string
        }
        Insert: {
          id?: string
          account_id: string
          name: string
          logo_url?: string | null
          currency?: string
          created_at?: string
        }
        Update: {
          id?: string
          account_id?: string
          name?: string
          logo_url?: string | null
          currency?: string
          created_at?: string
        }
      }
      room_types: {
        Row: {
          id: string
          property_id: string
          name: string
          max_pax: number
          cover_photo_url: string | null
          prices: RoomPrices
          created_at: string
        }
        Insert: {
          id?: string
          property_id: string
          name: string
          max_pax?: number
          cover_photo_url?: string | null
          prices?: RoomPrices
          created_at?: string
        }
        Update: {
          id?: string
          property_id?: string
          name?: string
          max_pax?: number
          cover_photo_url?: string | null
          prices?: RoomPrices
          created_at?: string
        }
      }
      rooms: {
        Row: {
          id: string
          property_id: string
          room_type_id: string | null
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          property_id: string
          room_type_id?: string | null
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          property_id?: string
          room_type_id?: string | null
          name?: string
          created_at?: string
        }
      }
      bookings: {
        Row: {
          id: string
          room_id: string
          property_id: string
          guest_name: string
          guest_contact: string | null
          check_in: string
          check_out: string
          occupancy_type: OccupancyType
          meal_plan: MealPlan
          pax: number
          status: BookingStatus
          source: BookingSource
          total_amount: number
          notes: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          room_id: string
          property_id: string
          guest_name: string
          guest_contact?: string | null
          check_in: string
          check_out: string
          occupancy_type?: OccupancyType
          meal_plan?: MealPlan
          pax?: number
          status?: BookingStatus
          source?: BookingSource
          total_amount: number
          notes?: string | null
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          room_id?: string
          property_id?: string
          guest_name?: string
          guest_contact?: string | null
          check_in?: string
          check_out?: string
          occupancy_type?: OccupancyType
          meal_plan?: MealPlan
          pax?: number
          status?: BookingStatus
          source?: BookingSource
          total_amount?: number
          notes?: string | null
          created_by?: string
          created_at?: string
        }
      }
      payments: {
        Row: {
          id: string
          booking_id: string
          amount: number
          payment_type: PaymentType
          discount_amount: number
          discount_pct: number
          document_url: string | null
          notes: string | null
          recorded_by: string
          recorded_at: string
        }
        Insert: {
          id?: string
          booking_id: string
          amount: number
          payment_type?: PaymentType
          discount_amount?: number
          discount_pct?: number
          document_url?: string | null
          notes?: string | null
          recorded_by: string
          recorded_at?: string
        }
        Update: {
          id?: string
          booking_id?: string
          amount?: number
          payment_type?: PaymentType
          discount_amount?: number
          discount_pct?: number
          document_url?: string | null
          notes?: string | null
          recorded_by?: string
          recorded_at?: string
        }
      }
      staff_assignments: {
        Row: {
          id: string
          user_id: string
          property_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          property_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          property_id?: string
          created_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      user_role: UserRole
      occupancy_type: OccupancyType
      meal_plan: MealPlan
      booking_status: BookingStatus
      booking_source: BookingSource
      payment_type: PaymentType
    }
  }
}