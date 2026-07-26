-- Mirror licensed catalog images into LensWise-controlled private storage.
--
-- The original URL remains available for recovery/import refreshes. Normal app
-- traffic uses hosted_image_path through an authenticated LensWise route.

alter table public.frame_catalog_items
  add column if not exists source_image_url text
    check (source_image_url is null or char_length(source_image_url) <= 2000),
  add column if not exists hosted_image_path text
    check (hosted_image_path is null or char_length(hosted_image_path) <= 500),
  add column if not exists image_mime_type text
    check (image_mime_type is null or char_length(image_mime_type) <= 100),
  add column if not exists image_byte_size integer
    check (image_byte_size is null or image_byte_size >= 0),
  add column if not exists image_checksum_sha256 text
    check (
      image_checksum_sha256 is null
      or image_checksum_sha256 ~ '^[0-9a-f]{64}$'
    ),
  add column if not exists image_sync_status text not null default 'pending'
    check (image_sync_status in ('pending', 'synced', 'failed', 'missing')),
  add column if not exists image_synced_at timestamptz,
  add column if not exists image_sync_error text
    check (image_sync_error is null or char_length(image_sync_error) <= 1000);

update public.frame_catalog_items
set
  source_image_url = image_url,
  image_sync_status = case
    when image_url is null
      or image_url ~* '/imgnotavail(?:_|\.|/)'
      then 'missing'
    else 'pending'
  end
where source_image_url is null;

create index if not exists frame_catalog_items_image_sync_status_idx
  on public.frame_catalog_items (provider, image_sync_status)
  where is_active = true;

create index if not exists frame_catalog_items_hosted_image_path_idx
  on public.frame_catalog_items (hosted_image_path)
  where hosted_image_path is not null;

create or replace function public.reset_frame_catalog_image_sync()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.source_image_url is null
     or new.source_image_url ~* '/imgnotavail(?:_|\.|/)' then
    new.image_sync_status := 'missing';
  elsif tg_op = 'INSERT'
     or new.source_image_url is distinct from old.source_image_url then
    new.hosted_image_path := null;
    new.image_mime_type := null;
    new.image_byte_size := null;
    new.image_checksum_sha256 := null;
    new.image_sync_status := 'pending';
    new.image_synced_at := null;
    new.image_sync_error := null;
  end if;
  return new;
end;
$$;

drop trigger if exists frame_catalog_items_reset_image_sync
  on public.frame_catalog_items;
create trigger frame_catalog_items_reset_image_sync
  before insert or update of source_image_url
  on public.frame_catalog_items
  for each row execute function public.reset_frame_catalog_image_sync();

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'frame-catalog-images',
  'frame-catalog-images',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

update public.frame_inventory inventory
set image_url = '/api/catalog/frame-images/' || inventory.catalog_record_id::text
from public.frame_catalog_items catalog
where inventory.catalog_record_id = catalog.id
  and (
    catalog.source_image_url is not null
    or catalog.hosted_image_path is not null
  );

revoke all on function public.reset_frame_catalog_image_sync() from public;
grant execute on function public.reset_frame_catalog_image_sync() to service_role;
