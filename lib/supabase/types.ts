export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserTier = 'free' | 'pro';
export type SubscriptionStatus = 'inactive' | 'active' | 'cancelled' | 'past_due' | 'on_hold';
export type AccountType = 'User' | 'Organization';
export type ChangelogStatus = 'draft' | 'published';
export type PRQueueStatus = 'unreleased' | 'released' | 'excluded' | 'queued' | 'included' | 'filtered';

export interface ReleaseCategories {
  features: string[];
  improvements: string[];
  fixes: string[];
}

export interface ReleaseDistribution {
  email_plain_text: string;
  social_post_thread: string[];
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          tier: UserTier;
          dodo_customer_id: string | null;
          dodo_subscription_id: string | null;
          subscription_status: SubscriptionStatus;
          current_period_end: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          tier?: UserTier;
          dodo_customer_id?: string | null;
          dodo_subscription_id?: string | null;
          subscription_status?: SubscriptionStatus;
          current_period_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          tier?: UserTier;
          dodo_customer_id?: string | null;
          dodo_subscription_id?: string | null;
          subscription_status?: SubscriptionStatus;
          current_period_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      installations: {
        Row: {
          id: string;
          user_id: string;
          github_installation_id: number;
          account_login: string;
          account_id: number;
          account_type: AccountType;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          github_installation_id: number;
          account_login: string;
          account_id: number;
          account_type?: AccountType;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          github_installation_id?: number;
          account_login?: string;
          account_id?: number;
          account_type?: AccountType;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'installations_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      projects: {
        Row: {
          id: string;
          user_id: string;
          installation_id: string | null;
          name: string;
          slug: string;
          repo_owner: string;
          repo_name: string;
          repo_full_name: string;
          webhook_secret: string;
          is_pro_override: boolean;
          custom_domain: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          installation_id?: string | null;
          name: string;
          slug: string;
          repo_owner: string;
          repo_name: string;
          repo_full_name: string;
          webhook_secret?: string;
          is_pro_override?: boolean;
          custom_domain?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          installation_id?: string | null;
          name?: string;
          slug?: string;
          repo_owner?: string;
          repo_name?: string;
          repo_full_name?: string;
          webhook_secret?: string;
          is_pro_override?: boolean;
          custom_domain?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'projects_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'projects_installation_id_fkey';
            columns: ['installation_id'];
            isOneToOne: false;
            referencedRelation: 'installations';
            referencedColumns: ['id'];
          }
        ];
      };
      changelogs: {
        Row: {
          id: string;
          project_id: string;
          version_tag: string;
          release_title: string;
          overview_summary: string;
          categories: ReleaseCategories;
          distribution: ReleaseDistribution;
          raw_markdown: string;
          markdown_body: string;
          is_published: boolean;
          status: ChangelogStatus;
          published_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          version_tag: string;
          release_title: string;
          overview_summary: string;
          categories?: ReleaseCategories;
          distribution?: ReleaseDistribution;
          raw_markdown?: string;
          markdown_body?: string;
          is_published?: boolean;
          status?: ChangelogStatus;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          version_tag?: string;
          release_title?: string;
          overview_summary?: string;
          categories?: ReleaseCategories;
          distribution?: ReleaseDistribution;
          raw_markdown?: string;
          markdown_body?: string;
          is_published?: boolean;
          status?: ChangelogStatus;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'changelogs_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          }
        ];
      };
      pull_requests: {
        Row: {
          id: string;
          project_id: string;
          changelog_id: string | null;
          release_id: string | null;
          github_pr_id: number | null;
          pr_number: number;
          title: string;
          body: string | null;
          labels: string[];
          author: string;
          author_login: string;
          author_avatar_url: string | null;
          pr_url: string;
          merged_at: string;
          is_filtered: boolean;
          filter_reason: string | null;
          status: PRQueueStatus;
          raw_payload: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          changelog_id?: string | null;
          release_id?: string | null;
          github_pr_id?: number | null;
          pr_number: number;
          title: string;
          body?: string | null;
          labels?: string[];
          author?: string;
          author_login?: string;
          author_avatar_url?: string | null;
          pr_url?: string;
          merged_at?: string;
          is_filtered?: boolean;
          filter_reason?: string | null;
          status?: PRQueueStatus;
          raw_payload?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          changelog_id?: string | null;
          release_id?: string | null;
          github_pr_id?: number | null;
          pr_number?: number;
          title?: string;
          body?: string | null;
          labels?: string[];
          author?: string;
          author_login?: string;
          author_avatar_url?: string | null;
          pr_url?: string;
          merged_at?: string;
          is_filtered?: boolean;
          filter_reason?: string | null;
          status?: PRQueueStatus;
          raw_payload?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'pull_requests_project_id_fkey';
            columns: ['project_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pull_requests_changelog_id_fkey';
            columns: ['changelog_id'];
            isOneToOne: false;
            referencedRelation: 'changelogs';
            referencedColumns: ['id'];
          }
        ];
      };
      dodo_webhook_events: {
        Row: {
          id: string;
          event_id: string;
          event_type: string;
          payload: Json;
          processed_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          event_type: string;
          payload?: Json;
          processed_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          event_type?: string;
          payload?: Json;
          processed_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      users: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          tier: UserTier;
          subscription_id: string | null;
          dodo_customer_id: string | null;
          subscription_status: SubscriptionStatus;
          current_period_end: string | null;
          created_at: string;
          updated_at: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export type Installation = Database['public']['Tables']['installations']['Row'];
export type InstallationInsert = Database['public']['Tables']['installations']['Insert'];
export type InstallationUpdate = Database['public']['Tables']['installations']['Update'];

export type Project = Database['public']['Tables']['projects']['Row'];
export type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
export type ProjectUpdate = Database['public']['Tables']['projects']['Update'];

export type Changelog = Database['public']['Tables']['changelogs']['Row'];
export type ChangelogInsert = Database['public']['Tables']['changelogs']['Insert'];
export type ChangelogUpdate = Database['public']['Tables']['changelogs']['Update'];

export type PullRequest = Database['public']['Tables']['pull_requests']['Row'];
export type PullRequestInsert = Database['public']['Tables']['pull_requests']['Insert'];
export type PullRequestUpdate = Database['public']['Tables']['pull_requests']['Update'];

export type DodoWebhookEvent = Database['public']['Tables']['dodo_webhook_events']['Row'];
export type DodoWebhookEventInsert = Database['public']['Tables']['dodo_webhook_events']['Insert'];
export type DodoWebhookEventUpdate = Database['public']['Tables']['dodo_webhook_events']['Update'];
