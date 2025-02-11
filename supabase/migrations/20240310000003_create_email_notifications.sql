create table if not exists email_notifications (
  id uuid default gen_random_uuid() primary key,
  email text not null,
  target_price integer not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  notified boolean default false not null
);

create index email_notifications_email_idx on email_notifications(email);
create index email_notifications_target_price_idx on email_notifications(target_price); 