// AUTO-GENERATED Database Types
// Run: supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.ts
// This is a manual version for now - will be replaced by generated types

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      courses: {
        Row: {
          id: string
          code: string
          name: string
          term: string | null
        }
        Insert: {
          id?: string
          code: string
          name: string
          term?: string | null
        }
        Update: {
          id?: string
          code?: string
          name?: string
          term?: string | null
        }
      }
      topics: {
        Row: {
          id: string
          course_id: string
          slug: string
          name: string
          week: number | null
          order_index: number
        }
        Insert: {
          id?: string
          course_id: string
          slug: string
          name: string
          week?: number | null
          order_index?: number
        }
        Update: {
          id?: string
          course_id?: string
          slug?: string
          name?: string
          week?: number | null
          order_index?: number
        }
      }
      documents: {
        Row: {
          id: string
          course_id: string
          topic_id: string | null
          doc_type: 'slides' | 'textbook'
          title: string
          storage_path: string
          total_pages: number
          has_images: boolean
          layout_type: string | null
          source_info: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          course_id: string
          topic_id?: string | null
          doc_type: 'slides' | 'textbook'
          title: string
          storage_path: string
          total_pages: number
          has_images?: boolean
          layout_type?: string | null
          source_info?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          course_id?: string
          topic_id?: string | null
          doc_type?: 'slides' | 'textbook'
          title?: string
          storage_path?: string
          total_pages?: number
          has_images?: boolean
          layout_type?: string | null
          source_info?: Json | null
          created_at?: string
        }
      }
      document_pages: {
        Row: {
          id: string
          document_id: string
          page_number: number
          text_content: string
          token_count: number | null
          has_diagrams: boolean
          has_tables: boolean
          image_descriptions: Json | null
          importance_score: number
          text_embedding: number[] | null
          created_at: string
        }
        Insert: {
          id?: string
          document_id: string
          page_number: number
          text_content: string
          token_count?: number | null
          has_diagrams?: boolean
          has_tables?: boolean
          image_descriptions?: Json | null
          importance_score?: number
          text_embedding?: number[] | null
          created_at?: string
        }
        Update: {
          id?: string
          document_id?: string
          page_number?: number
          text_content?: string
          token_count?: number | null
          has_diagrams?: boolean
          has_tables?: boolean
          image_descriptions?: Json | null
          importance_score?: number
          text_embedding?: number[] | null
          created_at?: string
        }
      }
      questions: {
        Row: {
          id: string
          course_id: string
          topic_id: string
          q_type: 'mcq' | 'short' | 'long'
          prompt: string
          options: Json | null
          correct_answer: Json
          explanation: string | null
          hint: string | null
          difficulty: 1 | 2 | 3 | null
          source_ref: string | null
          created_at: string
          is_exam_only: boolean
        }
        Insert: {
          id?: string
          course_id: string
          topic_id: string
          q_type: 'mcq' | 'short' | 'long'
          prompt: string
          options?: Json | null
          correct_answer: Json
          explanation?: string | null
          hint?: string | null
          difficulty?: 1 | 2 | 3 | null
          source_ref?: string | null
          created_at?: string
          is_exam_only?: boolean
        }
        Update: {
          id?: string
          course_id?: string
          topic_id?: string
          q_type?: 'mcq' | 'short' | 'long'
          prompt?: string
          options?: Json | null
          correct_answer?: Json
          explanation?: string | null
          hint?: string | null
          difficulty?: 1 | 2 | 3 | null
          source_ref?: string | null
          created_at?: string
          is_exam_only?: boolean
        }
      }
      study_sessions: {
        Row: {
          id: string
          user_id: string
          course_id: string
          topic_id: string | null
          exam_id: string | null
          mode: 'practice' | 'global' | 'compression' | 'exam'
          started_at: string
          ended_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          course_id: string
          topic_id?: string | null
          exam_id?: string | null
          mode: 'practice' | 'global' | 'compression' | 'exam'
          started_at?: string
          ended_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          course_id?: string
          topic_id?: string | null
          exam_id?: string | null
          mode?: 'practice' | 'global' | 'compression' | 'exam'
          started_at?: string
          ended_at?: string | null
        }
      }
      question_attempts: {
        Row: {
          id: number
          session_id: string
          user_id: string
          question_id: string
          is_correct: boolean
          user_answer: string | null
          time_taken_sec: number | null
          created_at: string
        }
        Insert: {
          id?: number
          session_id: string
          user_id: string
          question_id: string
          is_correct: boolean
          user_answer?: string | null
          time_taken_sec?: number | null
          created_at?: string
        }
        Update: {
          id?: number
          session_id?: string
          user_id?: string
          question_id?: string
          is_correct?: boolean
          user_answer?: string | null
          time_taken_sec?: number | null
          created_at?: string
        }
      }
      question_history: {
        Row: {
          id: string
          user_id: string
          question_id: string
          times_seen: number
          times_correct: number
          accuracy: number
          next_review: string | null
          last_seen: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          question_id: string
          times_seen?: number
          times_correct?: number
          accuracy?: number
          next_review?: string | null
          last_seen?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          question_id?: string
          times_seen?: number
          times_correct?: number
          accuracy?: number
          next_review?: string | null
          last_seen?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      topic_mastery: {
        Row: {
          id: string
          user_id: string
          topic_id: string
          num_attempts: number
          num_correct: number
          accuracy: number
          last_practiced_at: string | null
          mastery_level: 'weak' | 'moderate' | 'strong' | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          topic_id: string
          num_attempts?: number
          num_correct?: number
          accuracy?: number
          last_practiced_at?: string | null
          mastery_level?: 'weak' | 'moderate' | 'strong' | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          topic_id?: string
          num_attempts?: number
          num_correct?: number
          accuracy?: number
          last_practiced_at?: string | null
          mastery_level?: 'weak' | 'moderate' | 'strong' | null
          created_at?: string
          updated_at?: string
        }
      }
      compression_notes: {
        Row: {
          id: string
          user_id: string
          topic_id: string
          content_md: string
          source_pages: string[]
          generated_at: string
          is_ai_generated: boolean
        }
        Insert: {
          id?: string
          user_id: string
          topic_id: string
          content_md: string
          source_pages: string[]
          generated_at?: string
          is_ai_generated?: boolean
        }
        Update: {
          id?: string
          user_id?: string
          topic_id?: string
          content_md?: string
          source_pages?: string[]
          generated_at?: string
          is_ai_generated?: boolean
        }
      }
      exams: {
        Row: {
          id: string
          course_id: string
          name: string
          exam_type: 'midterm' | 'final' | 'practice'
          duration_min: number
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          course_id: string
          name: string
          exam_type: 'midterm' | 'final' | 'practice'
          duration_min: number
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          course_id?: string
          name?: string
          exam_type?: 'midterm' | 'final' | 'practice'
          duration_min?: number
          description?: string | null
          created_at?: string
        }
      }
      exam_questions: {
        Row: {
          id: string
          exam_id: string
          question_id: string
          order_index: number
          points: number
        }
        Insert: {
          id?: string
          exam_id: string
          question_id: string
          order_index: number
          points?: number
        }
        Update: {
          id?: string
          exam_id?: string
          question_id?: string
          order_index?: number
          points?: number
        }
      }
      exam_answers: {
        Row: {
          id: string
          session_id: string
          user_id: string
          question_id: string
          user_answer: Json | null
          answered_at: string | null
          is_flagged: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          session_id: string
          user_id: string
          question_id: string
          user_answer?: Json | null
          answered_at?: string | null
          is_flagged?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          user_id?: string
          question_id?: string
          user_answer?: Json | null
          answered_at?: string | null
          is_flagged?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      exam_sessions: {
        Row: {
          id: string
          user_id: string
          exam_id: string
          started_at: string
          submitted_at: string | null
          time_remaining_sec: number | null
          score: number | null
          is_completed: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          exam_id: string
          started_at?: string
          submitted_at?: string | null
          time_remaining_sec?: number | null
          score?: number | null
          is_completed?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          exam_id?: string
          started_at?: string
          submitted_at?: string | null
          time_remaining_sec?: number | null
          score?: number | null
          is_completed?: boolean
          created_at?: string
        }
      }
      user_courses: {
        Row: {
          user_id: string
          course_id: string
          created_at: string
        }
        Insert: {
          user_id: string
          course_id: string
          created_at?: string
        }
        Update: {
          user_id?: string
          course_id?: string
          created_at?: string
        }
      }
      premium_users: {
        Row: {
          user_id: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          upgraded_at: string | null
        }
        Insert: {
          user_id: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          upgraded_at?: string | null
        }
        Update: {
          user_id?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          upgraded_at?: string | null
        }
      }
      course_uploads: {
        Row: {
          id: string
          user_id: string
          course_id: string | null
          storage_path: string
          original_filename: string | null
          uploaded_at: string
          processed: boolean
          processed_at: string | null
          trigger_job_id: string | null
        }
        Insert: {
          id?: string
          user_id: string
          course_id?: string | null
          storage_path: string
          original_filename?: string | null
          uploaded_at?: string
          processed?: boolean
          processed_at?: string | null
          trigger_job_id?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          course_id?: string | null
          storage_path?: string
          original_filename?: string | null
          uploaded_at?: string
          processed?: boolean
          processed_at?: string | null
          trigger_job_id?: string | null
        }
      }
      rate_limit_usage: {
        Row: {
          id: string
          user_id: string
          endpoint: string
          request_count: number
          window_start: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          endpoint: string
          request_count?: number
          window_start: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          endpoint?: string
          request_count?: number
          window_start?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      retrieve_pages: {
        Args: {
          query_embedding: number[]
          target_topic_id: string
          target_user_id: string
          limit_count: number
        }
        Returns: {
          id: string
          document_id: string
          page_number: number
          text_content: string
          importance_score: number
          title: string
          doc_type: string
          relevance_score: number
        }[]
      }
      retrieve_chunks: {
        Args: {
          query_embedding: number[]
          page_ids: string[]
          limit_count: number
        }
        Returns: {
          id: number
          page_id: string
          content: string
          context_tags: string[]
          page_number: number
          title: string
          doc_type: string
          similarity: number
        }[]
      }
      search_document_pages: {
        Args: {
          query_embedding: number[]
          filter_course_id: string | null
          filter_topic_id: string | null
          filter_user_id: string
          match_threshold: number
          match_count: number
        }
        Returns: {
          id: string
          document_id: string
          page_number: number
          content: string
          similarity: number
          doc_title: string
          doc_type: string
          public_url: string | null
        }[]
      }
      get_next_spaced_question: {
        Args: {
          target_user_id: string
          target_topic_ids: string[]
        }
        Returns: Database['public']['Tables']['questions']['Row'][]
      }
      increment_rate_limit: {
        Args: {
          uid: string
          p_endpoint: string
        }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}
