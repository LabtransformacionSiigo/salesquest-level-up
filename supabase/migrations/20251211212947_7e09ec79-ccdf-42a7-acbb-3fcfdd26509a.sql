-- Create table for bulk upload history
CREATE TABLE public.sales_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by UUID NOT NULL REFERENCES profiles(id),
  file_name TEXT NOT NULL,
  total_rows INTEGER NOT NULL DEFAULT 0,
  successful_rows INTEGER NOT NULL DEFAULT 0,
  failed_rows INTEGER NOT NULL DEFAULT 0,
  errors JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sales_uploads ENABLE ROW LEVEL SECURITY;

-- Admins can view all uploads
CREATE POLICY "Admins can view all uploads"
ON public.sales_uploads
FOR SELECT
USING (has_role(auth.uid(), 'ADMINISTRADOR'::app_role));

-- Admins can insert uploads
CREATE POLICY "Admins can insert uploads"
ON public.sales_uploads
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'ADMINISTRADOR'::app_role));

-- Managers can view their own uploads
CREATE POLICY "Managers can view own uploads"
ON public.sales_uploads
FOR SELECT
USING (uploaded_by = auth.uid() AND has_role(auth.uid(), 'GERENTE'::app_role));

-- Managers can insert uploads
CREATE POLICY "Managers can insert uploads"
ON public.sales_uploads
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'GERENTE'::app_role));