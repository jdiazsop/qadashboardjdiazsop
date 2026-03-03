
-- Create storage bucket for performance evidence files
INSERT INTO storage.buckets (id, name, public)
VALUES ('performance-evidence', 'performance-evidence', false)
ON CONFLICT (id) DO NOTHING;

-- Users can upload their own evidence
CREATE POLICY "Users can upload performance evidence"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'performance-evidence' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can view their own evidence
CREATE POLICY "Users can view own performance evidence"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'performance-evidence' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can delete their own evidence
CREATE POLICY "Users can delete own performance evidence"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'performance-evidence' AND auth.uid()::text = (storage.foldername(name))[1]);
