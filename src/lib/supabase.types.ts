/**
 * Supabase Database types for Eventjump / Twende.
 *
 * NOTE: This file is checked into source control instead of being generated at build time
 * because the Supabase CLI project id is not available in all environments.
 * When you update the database schema, you can either regenerate this file locally with:
 *
 *   npx supabase gen types typescript --project-id <your-project-id> > src/lib/supabase.types.ts
 *
 * or extend it manually while keeping it in sync with your migrations.
 */

export type UserRole =
  | "visitor"
  | "organizer"
  | "participant"
  | "admin"
  | "vehicle_owner"
  | "photographer"
  | "vendor";

export type ProviderStatus = "available" | "unavailable" | "maintenance";
export type BookingStatus = "pending" | "accepted" | "rejected" | "completed" | "cancelled";
export type EventVisibility = "public" | "private";
export type EventStatus = "draft" | "pending_payment" | "active" | "cancelled" | "completed";
export type PaymentType = "creation" | "feature" | "participant";
export type PaymentStatus = "pending" | "unpaid" | "verifying" | "confirmed" | "failed" | "refunded" | "success" | "manual_review_required";
export type InvitationStatus = "pending" | "accepted" | "rejected";

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          name: string;
          email: string;
          role: UserRole;
          bio: string | null;
          phone: string | null;
          created_at: string;
          is_suspended: boolean;
          commission_percentage: number;
          avatar_url: string | null;
        };
        Insert: {
          id: string;
          name: string;
          email: string;
          role?: UserRole;
          bio?: string | null;
          phone?: string | null;
          created_at?: string;
          is_suspended?: boolean;
          commission_percentage?: number;
          avatar_url?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          role?: UserRole;
          bio?: string | null;
          phone?: string | null;
          created_at?: string;
          is_suspended?: boolean;
          commission_percentage?: number;
          avatar_url?: string | null;
        };
        Relationships: [];
      };
      photographers: {
        Row: {
          id: number;
          user_id: string;
          portfolio_url: string | null;
          bio: string | null;
          equipment: string | null;
          base_rate: number;
          specialties: string | null;
          status: ProviderStatus;
          created_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          portfolio_url?: string | null;
          bio?: string | null;
          equipment?: string | null;
          base_rate: number;
          specialties?: string | null;
          status?: ProviderStatus;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["photographers"]["Insert"]>;
        Relationships: [];
      };
      vehicles: {
        Row: {
          id: number;
          owner_id: string;
          make: string;
          model: string;
          year: number | null;
          capacity: number;
          base_rate: number;
          image_url: string | null;
          status: ProviderStatus;
          created_at: string;
        };
        Insert: {
          id?: number;
          owner_id: string;
          make: string;
          model: string;
          year?: number | null;
          capacity: number;
          base_rate: number;
          image_url?: string | null;
          status?: ProviderStatus;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["vehicles"]["Insert"]>;
        Relationships: [];
      };
      events: {
        Row: {
          id: number;
          organizer_id: string;
          title: string;
          description: string | null;
          category: string;
          type: string;
          location: string;
          latitude: number | null;
          longitude: number | null;
          date_time: string;
          max_participants: number;
          participant_fee: number;
          visibility: EventVisibility;
          status: EventStatus;
          is_featured: boolean;
          featured_until: string | null;
          cover_image: string | null;
          duration: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          organizer_id: string;
          title: string;
          description?: string | null;
          category: string;
          type?: string;
          location: string;
          latitude?: number | null;
          longitude?: number | null;
          date_time: string;
          max_participants: number;
          participant_fee?: number;
          visibility?: EventVisibility;
          status?: EventStatus;
          is_featured?: boolean;
          featured_until?: string | null;
          cover_image?: string | null;
          duration?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["events"]["Insert"]>;
        Relationships: [];
      };
      event_participants: {
        Row: {
          id: number;
          event_id: number;
          user_id: string;
          joined_at: string;
          booking_status: "draft" | "pending_payment" | "confirmed" | "cancelled" | "refunded" | "completed";
          payment_status: "unpaid" | "pending" | "confirmed" | "failed" | "refunded";
          payment_id: number | null;
          commission_amount: number;
        };
        Insert: {
          id?: number;
          event_id: number;
          user_id: string;
          joined_at?: string;
          booking_status?: "draft" | "pending_payment" | "confirmed" | "cancelled" | "refunded" | "completed";
          payment_status?: "unpaid" | "pending" | "confirmed" | "failed" | "refunded";
          payment_id?: number | null;
          commission_amount?: number;
        };
        Update: Partial<Database["public"]["Tables"]["event_participants"]["Insert"]>;
        Relationships: [];
      };
      photographer_bookings: {
        Row: {
          id: number;
          event_id: number;
          photographer_id: number;
          organizer_id: string;
          status: BookingStatus;
          total_price: number | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          event_id: number;
          photographer_id: number;
          organizer_id: string;
          status?: BookingStatus;
          total_price?: number | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["photographer_bookings"]["Insert"]>;
        Relationships: [];
      };
      vehicle_bookings: {
        Row: {
          id: number;
          event_id: number;
          vehicle_id: number;
          organizer_id: string;
          status: BookingStatus;
          total_price: number | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          event_id: number;
          vehicle_id: number;
          organizer_id: string;
          status?: BookingStatus;
          total_price?: number | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["vehicle_bookings"]["Insert"]>;
        Relationships: [];
      };
      payments: {
        Row: {
          id: number;
          user_id: string;
          event_id: number;
          amount: number;
          payment_type: PaymentType;
          payment_status: PaymentStatus;
          transaction_reference: string | null;
          provider_payment_id: string | null;
          processed_at: string | null;
          raw_payload: unknown | null;
          error_code: string | null;
          error_message: string | null;
          booking_id: number | null;
          net_amount: number | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          event_id: number;
          amount: number;
          payment_type?: PaymentType;
          payment_status?: PaymentStatus;
          transaction_reference?: string | null;
          provider_payment_id?: string | null;
          payment_provider?: string | null;
          processed_at?: string | null;
          raw_payload?: unknown | null;
          error_code?: string | null;
          error_message?: string | null;
          booking_id?: number | null;
          net_amount?: number | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["payments"]["Insert"]>;
        Relationships: [];
      };
      payouts: {
        Row: {
          id: number;
          recipient_user_id: string;
          amount: number;
          currency: string;
          status: PaymentStatus;
          scheduled_for: string | null;
          processed_at: string | null;
          failure_reason: string | null;
          mpesa_receipt_number: string | null;
          initiator_message_id: string | null;
          event_id: number | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          recipient_user_id: string;
          amount: number;
          currency: string;
          status?: PaymentStatus;
          scheduled_for?: string | null;
          processed_at?: string | null;
          failure_reason?: string | null;
          mpesa_receipt_number?: string | null;
          initiator_message_id?: string | null;
          event_id?: number | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["payouts"]["Insert"]>;
        Relationships: [];
      };
      reviews: {
        Row: {
          id: number;
          event_id: number;
          user_id: string;
          rating: number;
          comment: string | null;
          created_at: string;
          user_name: string;
        };
        Insert: {
          id?: number;
          event_id: number;
          user_id: string;
          rating: number;
          comment?: string | null;
          created_at?: string;
          user_name?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reviews"]["Insert"]>;
        Relationships: [];
      };
      chat_messages: {
        Row: {
          id: number;
          event_id: number;
          user_id: string;
          content: string;
          user_name: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          event_id: number;
          user_id: string;
          content: string;
          user_name?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["chat_messages"]["Insert"]>;
        Relationships: [];
      };
      payout_logs: {
        Row: {
          id: number;
          payout_id: number | null;
          direction: string;
          endpoint: string;
          status_code: number;
          payload: unknown | null;
          error: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          payout_id?: number | null;
          direction: string;
          endpoint: string;
          status_code: number;
          payload?: unknown | null;
          error?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["payout_logs"]["Insert"]>;
        Relationships: [];
      };
      reported_messages: {
        Row: {
          id: number;
          message_id: number;
          reported_by: string;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          message_id: number;
          reported_by: string;
          reason?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reported_messages"]["Insert"]>;
        Relationships: [];
      };
      revenue_summary: {
        Row: {
          id: number;
          payment_id: number;
          event_id: number;
          organizer_user_id: string;
          gross_amount: number;
          commission_amount: number;
          net_amount: number;
          created_at: string;
        };
        Insert: {
          id?: number;
          payment_id: number;
          event_id: number;
          organizer_user_id: string;
          gross_amount: number;
          commission_amount: number;
          net_amount: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["revenue_summary"]["Insert"]>;
        Relationships: [];
      };
      announcements: {
        Row: {
          id: number;
          event_id: number;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: number;
          event_id: number;
          content: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["announcements"]["Insert"]>;
        Relationships: [];
      };
      activity_requests: {
        Row: {
          id: string;
          creator_id: string;
          activity_type: string;
          location_name: string;
          latitude: number;
          longitude: number;
          activity_date: string;
          activity_time: string | null;
          status: string;
          min_people: number;
          max_people: number;
          event_id: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          creator_id: string;
          activity_type: string;
          location_name: string;
          latitude: number;
          longitude: number;
          activity_date: string;
          activity_time?: string | null;
          status?: string;
          min_people?: number;
          max_people?: number;
          event_id?: number | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["activity_requests"]["Insert"]>;
        Relationships: [];
      };
      activity_request_members: {
        Row: {
          id: string;
          request_id: string;
          user_id: string;
          joined_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          user_id: string;
          joined_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["activity_request_members"]["Insert"]>;
        Relationships: [];
      };
      payment_logs: {
        Row: {
          id: number;
          created_at: string;
          direction: string;
          endpoint: string | null;
          status_code: number | null;
          payload: unknown | null;
          headers: unknown | null;
          error: string | null;
          payment_id: number | null;
        };
        Insert: {
          id?: number;
          created_at?: string;
          direction: string;
          endpoint?: string | null;
          status_code?: number | null;
          payload?: unknown | null;
          headers?: unknown | null;
          error?: string | null;
          payment_id?: number | null;
        };
        Update: Partial<Database["public"]["Tables"]["payment_logs"]["Insert"]>;
        Relationships: [];
      };
      admin_audit_log: {
        Row: {
          id: number;
          admin_user_id: string | null;
          action: string;
          target_type: string;
          target_id: string;
          details: unknown | null;
          created_at: string | null;
        };
        Insert: {
          id?: number;
          admin_user_id?: string | null;
          action: string;
          target_type: string;
          target_id: string;
          details?: unknown | null;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["admin_audit_log"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      confirm_event_creation_payment: {
        Args: { p_event_id: number };
        Returns: void;
      };
      fail_event_creation_payment: {
        Args: { p_event_id: number; p_error_code: string; p_error_message: string };
        Returns: void;
      };
      finalize_attendee_payment_by_server: {
        Args: { p_event_id: number; p_user_id: string; p_payment_id: number };
        Returns: void;
      };
      is_event_cancellable: {
        Args: { p_event_id: number };
        Returns: boolean;
      };
      is_payment_refundable: {
        Args: { p_payment_id: number };
        Returns: boolean;
      };
      create_attendee_booking_v2: {
        Args: { p_event_id: number };
        Returns: { id: number };
      };
      transition_booking_to_confirmed: {
        Args: { p_participant_id: number; p_payment_id: number | null };
        Returns: void;
      };
      join_activity_request: {
        Args: { p_request_id: string };
        Returns: void;
      };
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
  };
}
