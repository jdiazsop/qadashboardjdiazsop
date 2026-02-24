
-- Table to store the full app state per user as JSONB
CREATE TABLE public.user_app_state (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.user_app_state ENABLE ROW LEVEL SECURITY;

-- Users can only access their own state
CREATE POLICY "Users can view their own state"
  ON public.user_app_state FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own state"
  ON public.user_app_state FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own state"
  ON public.user_app_state FOR UPDATE
  USING (auth.uid() = user_id);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_user_app_state_updated_at
  BEFORE UPDATE ON public.user_app_state
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
