-- Invoice PDF storage: save generated PDFs when an invoice is created.

alter table public.invoices
  add column if not exists pdf_path text;

insert into storage.buckets (id, name, public)
values ('invoice-pdfs', 'invoice-pdfs', false)
on conflict (id) do nothing;

drop policy if exists "invoice_pdfs_storage_own" on storage.objects;
create policy "invoice_pdfs_storage_own"
on storage.objects for all
using (
  bucket_id = 'invoice-pdfs'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'invoice-pdfs'
  and auth.uid()::text = (storage.foldername(name))[1]
);
