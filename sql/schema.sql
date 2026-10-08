create table bins (
  id   text primary key,
  name text not null,
  lat  double precision not null,
  lng  double precision not null
);

create table reports (
  id         bigint generated always as identity primary key,
  bin_id     text not null references bins(id),
  status     text not null check (status in ('full', 'fine')),
  created_at timestamptz not null default now()
);

alter table bins    enable row level security;
alter table reports enable row level security;

create policy "anyone can read bins"
  on bins for select to anon using (true);

create policy "anyone can read reports"
  on reports for select to anon using (true);

create policy "anyone can insert reports"
  on reports for insert to anon with check (true);

insert into bins (id, name, lat, lng) values
  ('MUST-01', 'MUST Ground', -15.904759478391139, 35.21611838835279),
  ('MUST-02', 'Hall 4',      -15.900427986808959, 35.21578665934836);