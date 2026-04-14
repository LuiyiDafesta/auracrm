export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          contact_id: string | null
          created_at: string
          description: string | null
          id: string
          opportunity_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          opportunity_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          opportunity_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          key_hash: string
          key_preview: string
          last_used_at: string | null
          name: string
          permissions: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash: string
          key_preview?: string
          last_used_at?: string | null
          name: string
          permissions?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string
          key_preview?: string
          last_used_at?: string | null
          name?: string
          permissions?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      automation_run_logs: {
        Row: {
          action: string
          created_at: string
          error_message: string | null
          id: string
          result: Json | null
          run_id: string
          step_id: string
          step_type: string
        }
        Insert: {
          action: string
          created_at?: string
          error_message?: string | null
          id?: string
          result?: Json | null
          run_id: string
          step_id: string
          step_type: string
        }
        Update: {
          action?: string
          created_at?: string
          error_message?: string | null
          id?: string
          result?: Json | null
          run_id?: string
          step_id?: string
          step_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_run_logs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "automation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_runs: {
        Row: {
          automation_id: string
          completed_at: string | null
          contact_id: string
          context: Json
          created_at: string
          current_step_id: string | null
          id: string
          started_at: string
          status: Database["public"]["Enums"]["automation_run_status"]
          updated_at: string
          user_id: string
          wait_until: string | null
        }
        Insert: {
          automation_id: string
          completed_at?: string | null
          contact_id: string
          context?: Json
          created_at?: string
          current_step_id?: string | null
          id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["automation_run_status"]
          updated_at?: string
          user_id: string
          wait_until?: string | null
        }
        Update: {
          automation_id?: string
          completed_at?: string | null
          contact_id?: string
          context?: Json
          created_at?: string
          current_step_id?: string | null
          id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["automation_run_status"]
          updated_at?: string
          user_id?: string
          wait_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      automations: {
        Row: {
          created_at: string
          description: string | null
          id: string
          last_run_at: string | null
          name: string
          run_count: number
          status: Database["public"]["Enums"]["automation_status"]
          trigger_config: Json
          trigger_type: string
          updated_at: string
          user_id: string
          workflow: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          last_run_at?: string | null
          name: string
          run_count?: number
          status?: Database["public"]["Enums"]["automation_status"]
          trigger_config?: Json
          trigger_type: string
          updated_at?: string
          user_id: string
          workflow?: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          last_run_at?: string | null
          name?: string
          run_count?: number
          status?: Database["public"]["Enums"]["automation_status"]
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
          user_id?: string
          workflow?: Json
        }
        Relationships: []
      }
      campaign_sends: {
        Row: {
          ab_parent_id: string | null
          ab_test_percentage: number | null
          ab_variant: string | null
          ab_wait_hours: number | null
          ab_winner_sent: boolean
          campaign_id: string
          completed_at: string | null
          created_at: string
          emails_per_second: number
          failed_count: number
          from_email: string | null
          from_name: string | null
          id: string
          is_ab_test: boolean
          segment_id: string
          sent_count: number
          started_at: string | null
          status: Database["public"]["Enums"]["campaign_send_status"]
          template_id: string
          template_id_b: string | null
          total_emails: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ab_parent_id?: string | null
          ab_test_percentage?: number | null
          ab_variant?: string | null
          ab_wait_hours?: number | null
          ab_winner_sent?: boolean
          campaign_id: string
          completed_at?: string | null
          created_at?: string
          emails_per_second?: number
          failed_count?: number
          from_email?: string | null
          from_name?: string | null
          id?: string
          is_ab_test?: boolean
          segment_id: string
          sent_count?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["campaign_send_status"]
          template_id: string
          template_id_b?: string | null
          total_emails?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ab_parent_id?: string | null
          ab_test_percentage?: number | null
          ab_variant?: string | null
          ab_wait_hours?: number | null
          ab_winner_sent?: boolean
          campaign_id?: string
          completed_at?: string | null
          created_at?: string
          emails_per_second?: number
          failed_count?: number
          from_email?: string | null
          from_name?: string | null
          id?: string
          is_ab_test?: boolean
          segment_id?: string
          sent_count?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["campaign_send_status"]
          template_id?: string
          template_id_b?: string | null
          total_emails?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_sends_ab_parent_id_fkey"
            columns: ["ab_parent_id"]
            isOneToOne: false
            referencedRelation: "campaign_sends"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_sends_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_sends_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_sends_template_id_b_fkey"
            columns: ["template_id_b"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_sends_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          budget: number | null
          created_at: string
          end_date: string | null
          from_email: string | null
          from_name: string | null
          id: string
          name: string
          notes: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          budget?: number | null
          created_at?: string
          end_date?: string | null
          from_email?: string | null
          from_name?: string | null
          id?: string
          name: string
          notes?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          budget?: number | null
          created_at?: string
          end_date?: string | null
          from_email?: string | null
          from_name?: string | null
          id?: string
          name?: string
          notes?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      channel_messages: {
        Row: {
          channel_id: string
          contact_id: string | null
          content: string | null
          created_at: string
          direction: Database["public"]["Enums"]["message_direction"]
          external_id: string | null
          id: string
          is_read: boolean
          media_type: string | null
          media_url: string | null
          metadata: Json | null
          sender_identifier: string | null
          sender_name: string | null
          user_id: string
        }
        Insert: {
          channel_id: string
          contact_id?: string | null
          content?: string | null
          created_at?: string
          direction?: Database["public"]["Enums"]["message_direction"]
          external_id?: string | null
          id?: string
          is_read?: boolean
          media_type?: string | null
          media_url?: string | null
          metadata?: Json | null
          sender_identifier?: string | null
          sender_name?: string | null
          user_id: string
        }
        Update: {
          channel_id?: string
          contact_id?: string | null
          content?: string | null
          created_at?: string
          direction?: Database["public"]["Enums"]["message_direction"]
          external_id?: string | null
          id?: string
          is_read?: boolean
          media_type?: string | null
          media_url?: string | null
          metadata?: Json | null
          sender_identifier?: string | null
          sender_name?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          config: Json
          created_at: string
          id: string
          name: string
          status: Database["public"]["Enums"]["channel_status"]
          type: Database["public"]["Enums"]["channel_type"]
          updated_at: string
          user_id: string
          webhook_secret: string | null
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          name: string
          status?: Database["public"]["Enums"]["channel_status"]
          type: Database["public"]["Enums"]["channel_type"]
          updated_at?: string
          user_id: string
          webhook_secret?: string | null
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["channel_status"]
          type?: Database["public"]["Enums"]["channel_type"]
          updated_at?: string
          user_id?: string
          webhook_secret?: string | null
        }
        Relationships: []
      }
      companies: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          created_at: string
          email: string | null
          id: string
          industry: string | null
          name: string
          notes: string | null
          phone: string | null
          size: string | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          industry?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          size?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          industry?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          size?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      contact_custom_values: {
        Row: {
          contact_id: string
          created_at: string
          custom_field_id: string
          id: string
          updated_at: string
          value: string | null
        }
        Insert: {
          contact_id: string
          created_at?: string
          custom_field_id: string
          id?: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          contact_id?: string
          created_at?: string
          custom_field_id?: string
          id?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_custom_values_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_custom_values_custom_field_id_fkey"
            columns: ["custom_field_id"]
            isOneToOne: false
            referencedRelation: "custom_fields"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_tags: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          tag_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          tag_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_tags_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          avatar_url: string | null
          company_id: string | null
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string | null
          lead_score: number
          notes: string | null
          phone: string | null
          position: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          email: string
          first_name: string
          id?: string
          last_name?: string | null
          lead_score?: number
          notes?: string | null
          phone?: string | null
          position?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string | null
          lead_score?: number
          notes?: string | null
          phone?: string | null
          position?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_fields: {
        Row: {
          created_at: string
          field_type: string
          id: string
          is_required: boolean
          is_visible: boolean
          name: string
          options: Json | null
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          field_type?: string
          id?: string
          is_required?: boolean
          is_visible?: boolean
          name: string
          options?: Json | null
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          field_type?: string
          id?: string
          is_required?: boolean
          is_visible?: boolean
          name?: string
          options?: Json | null
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_queue: {
        Row: {
          campaign_send_id: string
          contact_id: string
          created_at: string
          error_message: string | null
          id: string
          scheduled_date: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["email_queue_status"]
          to_email: string
          to_name: string
          variant: string | null
        }
        Insert: {
          campaign_send_id: string
          contact_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          scheduled_date?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_queue_status"]
          to_email: string
          to_name?: string
          variant?: string | null
        }
        Update: {
          campaign_send_id?: string
          contact_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          scheduled_date?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_queue_status"]
          to_email?: string
          to_name?: string
          variant?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_queue_campaign_send_id_fkey"
            columns: ["campaign_send_id"]
            isOneToOne: false
            referencedRelation: "campaign_sends"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_queue_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          blocks: Json
          campaign_id: string | null
          created_at: string
          html_content: string | null
          id: string
          name: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          blocks?: Json
          campaign_id?: string | null
          created_at?: string
          html_content?: string | null
          id?: string
          name: string
          subject?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          blocks?: Json
          campaign_id?: string | null
          created_at?: string
          html_content?: string | null
          id?: string
          name?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      email_tracking: {
        Row: {
          campaign_send_id: string
          created_at: string
          event_type: string
          id: string
          ip_address: string | null
          link_url: string | null
          queue_item_id: string | null
          user_agent: string | null
        }
        Insert: {
          campaign_send_id: string
          created_at?: string
          event_type: string
          id?: string
          ip_address?: string | null
          link_url?: string | null
          queue_item_id?: string | null
          user_agent?: string | null
        }
        Update: {
          campaign_send_id?: string
          created_at?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          link_url?: string | null
          queue_item_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_tracking_campaign_send_id_fkey"
            columns: ["campaign_send_id"]
            isOneToOne: false
            referencedRelation: "campaign_sends"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_tracking_queue_item_id_fkey"
            columns: ["queue_item_id"]
            isOneToOne: false
            referencedRelation: "email_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          company_id: string | null
          contact_id: string | null
          created_at: string
          expected_close_date: string | null
          id: string
          name: string
          notes: string | null
          probability: number | null
          stage: Database["public"]["Enums"]["opportunity_stage"]
          updated_at: string
          user_id: string
          value: number | null
        }
        Insert: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          expected_close_date?: string | null
          id?: string
          name: string
          notes?: string | null
          probability?: number | null
          stage?: Database["public"]["Enums"]["opportunity_stage"]
          updated_at?: string
          user_id: string
          value?: number | null
        }
        Update: {
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          expected_close_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          probability?: number | null
          stage?: Database["public"]["Enums"]["opportunity_stage"]
          updated_at?: string
          user_id?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      segment_contacts: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          segment_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          segment_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          segment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "segment_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "segment_contacts_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "segments"
            referencedColumns: ["id"]
          },
        ]
      }
      segments: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          rules: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          rules?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          rules?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      smtp_config: {
        Row: {
          created_at: string
          encryption: string
          from_email: string
          from_name: string
          host: string
          id: string
          is_verified: boolean
          password: string
          port: number
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          created_at?: string
          encryption?: string
          from_email: string
          from_name?: string
          host: string
          id?: string
          is_verified?: boolean
          password: string
          port?: number
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          created_at?: string
          encryption?: string
          from_email?: string
          from_name?: string
          host?: string
          id?: string
          is_verified?: boolean
          password?: string
          port?: number
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          completed_at: string | null
          contact_id: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          opportunity_id: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          opportunity_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          opportunity_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      automation_run_status:
        | "running"
        | "waiting"
        | "completed"
        | "failed"
        | "cancelled"
      automation_status: "draft" | "active" | "paused"
      campaign_send_status:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "cancelled"
      campaign_status:
        | "borrador"
        | "activa"
        | "pausada"
        | "completada"
        | "cancelada"
      channel_status: "active" | "inactive" | "error"
      channel_type:
        | "whatsapp_evolution"
        | "telegram"
        | "email"
        | "facebook"
        | "instagram"
        | "webchat"
      email_queue_status: "pending" | "sending" | "sent" | "failed"
      message_direction: "inbound" | "outbound"
      opportunity_stage:
        | "prospecto"
        | "calificado"
        | "propuesta"
        | "negociacion"
        | "cerrado_ganado"
        | "cerrado_perdido"
      task_priority: "baja" | "media" | "alta" | "urgente"
      task_status: "pendiente" | "en_progreso" | "completada" | "cancelada"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      automation_run_status: [
        "running",
        "waiting",
        "completed",
        "failed",
        "cancelled",
      ],
      automation_status: ["draft", "active", "paused"],
      campaign_send_status: [
        "pending",
        "processing",
        "completed",
        "failed",
        "cancelled",
      ],
      campaign_status: [
        "borrador",
        "activa",
        "pausada",
        "completada",
        "cancelada",
      ],
      channel_status: ["active", "inactive", "error"],
      channel_type: [
        "whatsapp_evolution",
        "telegram",
        "email",
        "facebook",
        "instagram",
        "webchat",
      ],
      email_queue_status: ["pending", "sending", "sent", "failed"],
      message_direction: ["inbound", "outbound"],
      opportunity_stage: [
        "prospecto",
        "calificado",
        "propuesta",
        "negociacion",
        "cerrado_ganado",
        "cerrado_perdido",
      ],
      task_priority: ["baja", "media", "alta", "urgente"],
      task_status: ["pendiente", "en_progreso", "completada", "cancelada"],
    },
  },
} as const
