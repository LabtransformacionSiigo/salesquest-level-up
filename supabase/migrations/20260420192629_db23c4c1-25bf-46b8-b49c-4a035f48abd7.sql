
INSERT INTO storage.buckets (id, name, public)
VALUES ('premios-images', 'premios-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Premios images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'premios-images');

CREATE POLICY "Admins and especialistas can upload premios images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'premios-images'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'especialista'::app_role))
);

CREATE POLICY "Admins and especialistas can update premios images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'premios-images'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'especialista'::app_role))
);

CREATE POLICY "Admins and especialistas can delete premios images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'premios-images'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'especialista'::app_role))
);
