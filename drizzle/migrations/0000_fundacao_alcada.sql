
create type public.app_role as enum ('analista','gestor','admin');
create type public.demanda_status as enum ('recebida','em_analise','aguardando_aprovacao','aprovada_auto','aprovada','rejeitada','agendada','escalada','descartada','erro');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text, email text, criado_em timestamptz not null default now()
);
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
grant select, insert, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
create or replace function public.is_gestor(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role in ('gestor','admin'))
$$;

create policy "profiles_select" on public.profiles for select to authenticated using (true);
create policy "profiles_update_own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "roles_select" on public.user_roles for select to authenticated using (true);
create policy "roles_admin_insert" on public.user_roles for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "roles_admin_delete" on public.user_roles for delete to authenticated using (public.has_role(auth.uid(),'admin'));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nome, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)), new.email);
  insert into public.user_roles (user_id, role) values (new.id, 'analista');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.set_atualizado_em()
returns trigger language plpgsql set search_path = public as $$
begin new.atualizado_em = now(); return new; end $$;

create table public.fornecedores (
  id uuid primary key default gen_random_uuid(),
  razao_social text not null,
  cnpj text not null unique check (cnpj ~ '^[0-9]{14}$'),
  homologado boolean not null default false,
  categoria_padrao text,
  criado_em timestamptz not null default now()
);
create table public.centros_custo (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  orcamento_mensal numeric(14,2) not null default 0
);
create sequence public.demandas_codigo_seq;
create table public.demandas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique default ('AP-' || lpad(nextval('public.demandas_codigo_seq')::text, 4, '0')),
  canal text not null default 'app' check (canal in ('app','formulario','email')),
  remetente_nome text, remetente_email text,
  texto_original text not null,
  status public.demanda_status not null default 'recebida',
  fornecedor_id uuid references public.fornecedores(id) on delete set null,
  fornecedor_nome text, cnpj text,
  valor numeric(14,2), vencimento date, numero_documento text, descricao text, categoria text,
  centro_custo_id uuid references public.centros_custo(id) on delete set null,
  tipo_documento text, prioridade text, confianca numeric(4,3),
  rota text check (rota in ('automatica','aprovacao','excecao','descarte')),
  motivos text[] not null default '{}',
  checagens jsonb not null default '{}',
  extracao jsonb, recomendacao_ia text, n8n_execution_id text,
  criado_por uuid,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create trigger demandas_atualizado before update on public.demandas
  for each row execute function public.set_atualizado_em();

create table public.aprovacoes (
  id uuid primary key default gen_random_uuid(),
  demanda_id uuid not null references public.demandas(id) on delete cascade,
  motivo text, recomendacao_ia text, resume_url text,
  status text not null default 'pendente' check (status in ('pendente','aprovada','rejeitada','expirada')),
  prazo timestamptz, decidido_por uuid, decidido_por_nome text, decidido_em timestamptz, justificativa text,
  criado_em timestamptz not null default now()
);
create table public.pagamentos (
  id uuid primary key default gen_random_uuid(),
  demanda_id uuid not null unique references public.demandas(id) on delete cascade,
  valor numeric(14,2), data_agendada date,
  status text not null default 'agendado' check (status in ('agendado','pago','cancelado')),
  criado_em timestamptz not null default now()
);
create table public.eventos (
  id bigserial primary key,
  demanda_id uuid references public.demandas(id) on delete set null,
  etapa text,
  tipo text not null default 'info' check (tipo in ('info','sucesso','alerta','erro','decisao')),
  mensagem text, dados jsonb,
  origem text not null default 'app' check (origem in ('n8n','app','ia','humano')),
  execution_id text,
  criado_em timestamptz not null default now()
);
create table public.ia_execucoes (
  id uuid primary key default gen_random_uuid(),
  demanda_id uuid references public.demandas(id) on delete cascade,
  modelo text, entrada_resumo text, saida jsonb, latencia_ms int, sucesso boolean, erro text,
  criado_em timestamptz not null default now()
);
create table public.configuracoes (
  chave text primary key, valor jsonb not null, descricao text,
  atualizado_em timestamptz not null default now()
);
create trigger configuracoes_atualizado before update on public.configuracoes
  for each row execute function public.set_atualizado_em();
create table public.integracao_segredos (nome text primary key, valor text not null);

grant select, insert, update, delete on public.fornecedores, public.centros_custo, public.configuracoes to authenticated;
grant select, insert on public.demandas to authenticated;
grant usage on sequence public.demandas_codigo_seq to authenticated;
grant select, update on public.aprovacoes to authenticated;
grant select on public.pagamentos, public.ia_execucoes to authenticated;
grant select, insert on public.eventos to authenticated;
grant usage on sequence public.eventos_id_seq to authenticated;
grant all on public.fornecedores, public.centros_custo, public.demandas, public.aprovacoes, public.pagamentos, public.eventos, public.ia_execucoes, public.configuracoes, public.integracao_segredos to service_role;
grant usage on sequence public.demandas_codigo_seq, public.eventos_id_seq to service_role;
revoke all on public.integracao_segredos from anon, authenticated;

alter table public.fornecedores enable row level security;
alter table public.centros_custo enable row level security;
alter table public.demandas enable row level security;
alter table public.aprovacoes enable row level security;
alter table public.pagamentos enable row level security;
alter table public.eventos enable row level security;
alter table public.ia_execucoes enable row level security;
alter table public.configuracoes enable row level security;
alter table public.integracao_segredos enable row level security;

create policy "forn_select" on public.fornecedores for select to authenticated using (true);
create policy "forn_ins" on public.fornecedores for insert to authenticated with check (public.is_gestor(auth.uid()));
create policy "forn_upd" on public.fornecedores for update to authenticated using (public.is_gestor(auth.uid())) with check (public.is_gestor(auth.uid()));
create policy "forn_del" on public.fornecedores for delete to authenticated using (public.is_gestor(auth.uid()));
create policy "cc_select" on public.centros_custo for select to authenticated using (true);
create policy "cc_ins" on public.centros_custo for insert to authenticated with check (public.is_gestor(auth.uid()));
create policy "cc_upd" on public.centros_custo for update to authenticated using (public.is_gestor(auth.uid())) with check (public.is_gestor(auth.uid()));
create policy "cc_del" on public.centros_custo for delete to authenticated using (public.is_gestor(auth.uid()));
create policy "cfg_select" on public.configuracoes for select to authenticated using (true);
create policy "cfg_ins" on public.configuracoes for insert to authenticated with check (public.is_gestor(auth.uid()));
create policy "cfg_upd" on public.configuracoes for update to authenticated using (public.is_gestor(auth.uid())) with check (public.is_gestor(auth.uid()));
create policy "cfg_del" on public.configuracoes for delete to authenticated using (public.is_gestor(auth.uid()));
create policy "dem_select" on public.demandas for select to authenticated using (true);
create policy "dem_insert" on public.demandas for insert to authenticated
  with check ((public.has_role(auth.uid(),'analista') or public.is_gestor(auth.uid())) and (criado_por is null or criado_por = auth.uid()));
create policy "apr_select" on public.aprovacoes for select to authenticated using (true);
create policy "apr_decidir" on public.aprovacoes for update to authenticated
  using (public.is_gestor(auth.uid())) with check (public.is_gestor(auth.uid()));
create policy "pag_select" on public.pagamentos for select to authenticated using (true);
create policy "ev_select" on public.eventos for select to authenticated using (true);
create policy "ev_insert" on public.eventos for insert to authenticated with check (origem in ('app','humano'));
create policy "ia_select" on public.ia_execucoes for select to authenticated using (true);

alter publication supabase_realtime add table public.demandas, public.eventos, public.aprovacoes;

insert into public.configuracoes (chave, valor, descricao) values
 ('limite_aprovacao_automatica', '2000', 'Valor máximo (R$) para aprovação automática'),
 ('confianca_minima', '0.75', 'Confiança mínima da IA para seguir sem revisão'),
 ('janela_duplicidade_dias', '90', 'Janela (dias) para detecção de duplicidade'),
 ('prazo_aprovacao_horas', '48', 'Prazo (horas) para decisão humana');

insert into public.fornecedores (razao_social, cnpj, homologado, categoria_padrao) values
 ('Transportadora Rota Nordeste Ltda', '12345678000195', true, 'Frete'),
 ('Embalagens Cariri Indústria e Comércio Ltda', '23456789000195', true, 'Embalagens'),
 ('Nuvem Sertão Tecnologia S.A.', '34567891000184', true, 'Software'),
 ('Energia Litoral Distribuidora S.A.', '45678912000155', true, 'Utilidades'),
 ('Oficina Mecânica Pé de Serra ME', '56789123000108', false, 'Manutenção'),
 ('Gráfica Jangada Express Eireli', '67891234000147', false, 'Material de marketing');

insert into public.centros_custo (codigo, nome, orcamento_mensal) values
 ('CC-100', 'Logística', 40000.00),
 ('CC-200', 'Comercial', 25000.00),
 ('CC-300', 'TI', 18000.00),
 ('CC-400', 'Administrativo', 12000.00),
 ('CC-500', 'Manutenção', 8000.00);
