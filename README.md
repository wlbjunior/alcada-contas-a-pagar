# Alcada Contas A Pagar

Esta mensagem é ordem de execução, já aprovada. Edite direto, sem plano, sem subagente, sem roadmap. Escopo desta mensagem: SÓ a fundação (banco + login + layout). As telas e APIs virão em mensagens seguintes.

Produto: **Alçada — Contas a Pagar com IA e supervisão humana**. Painel interno de uma empresa fictícia em crescimento, "Distribuidora Boa Safra Ltda". Notas fiscais, boletos e cobranças chegam por formulário/e-mail; um orquestrador externo (n8n) processa cada demanda, chama a IA, aplica regras de alçada e pede aprovação humana quando necessário. Este app guarda os dados, mostra o andamento e é onde o gestor aprova.

Idioma pt-BR, moeda BRL, fuso America/Fortaleza. Visual sóbrio de ferramenta financeira: fundo claro, verde-petróleo como cor primária, números tabulares, tabelas densas e legíveis.

1) Lovable Cloud com autenticação por e-mail e senha (sem confirmação de e-mail para facilitar a demonstração).

2) Banco (com RLS em tudo):
- enum app_role ('analista','gestor','admin') e tabela user_roles(user_id, role) com função has_role(uid, role) security definer. Tabela profiles(id = auth.users.id, nome, email). Gatilho cria profile e papel 'analista' a cada cadastro.
- fornecedores(id uuid, razao_social, cnpj text único só dígitos, homologado bool, categoria_padrao text, criado_em)
- centros_custo(id, codigo text único, nome, orcamento_mensal numeric(14,2))
- enum demanda_status ('recebida','em_analise','aguardando_aprovacao','aprovada_auto','aprovada','rejeitada','agendada','escalada','descartada','erro')
- demandas(id uuid, codigo text único gerado por sequência no formato 'AP-0001', canal text check in ('app','formulario','email'), remetente_nome, remetente_email, texto_original text not null, status demanda_status default 'recebida', fornecedor_id fk nulo, fornecedor_nome text, cnpj text, valor numeric(14,2), vencimento date, numero_documento text, descricao text, categoria text, centro_custo_id fk nulo, tipo_documento text, prioridade text, confianca numeric(4,3), rota text check in ('automatica','aprovacao','excecao','descarte') nulo, motivos text[] default '{}', checagens jsonb default '{}', extracao jsonb, recomendacao_ia text, n8n_execution_id text, criado_por uuid nulo, criado_em, atualizado_em com gatilho)
- aprovacoes(id, demanda_id fk, motivo text, recomendacao_ia text, resume_url text, status text check in ('pendente','aprovada','rejeitada','expirada') default 'pendente', prazo timestamptz, decidido_por uuid nulo, decidido_por_nome text, decidido_em, justificativa text, criado_em)
- pagamentos(id, demanda_id fk único, valor, data_agendada date, status text check in ('agendado','pago','cancelado') default 'agendado', criado_em)
- eventos(id bigserial, demanda_id fk nulo, etapa text, tipo text check in ('info','sucesso','alerta','erro','decisao'), mensagem text, dados jsonb, origem text check in ('n8n','app','ia','humano'), execution_id text, criado_em) — trilha de auditoria, só INSERT (sem UPDATE/DELETE para ninguém).
- ia_execucoes(id, demanda_id fk, modelo text, entrada_resumo text, saida jsonb, latencia_ms int, sucesso bool, erro text, criado_em)
- configuracoes(chave text pk, valor jsonb, descricao text, atualizado_em) com sementes: limite_aprovacao_automatica = 2000, confianca_minima = 0.75, janela_duplicidade_dias = 90, prazo_aprovacao_horas = 48.
- integracao_segredos(nome text pk, valor text) — SEM nenhuma policy para usuários (só o servidor com service role lê). Não semeie valores.
- RLS: usuários autenticados leem tudo exceto integracao_segredos; analista insere demandas; só gestor/admin decide aprovações e edita fornecedores, centros de custo e configurações; admin gerencia papéis.
- Habilite realtime em demandas, eventos e aprovacoes.

3) Sementes realistas (dados fictícios): 6 fornecedores (4 homologados, 2 não; CNPJs com dígito verificador VÁLIDO), 5 centros de custo (Logística, Comercial, TI, Administrativo, Manutenção) com orçamentos mensais entre R$ 8.000 e R$ 40.000.

4) Layout: barra lateral com Painel (/), Nova demanda (/nova), Demandas (/demandas), Aprovações (/aprovacoes, com contador de pendentes), Fornecedores (/fornecedores), Centros de custo (/centros-custo), Observabilidade (/observabilidade), Configurações (/configuracoes). Rotas protegidas por login; /auth com entrar e criar conta. Cada página nova pode ficar como esqueleto com título e descrição de uma linha — serão preenchidas nas próximas mensagens.

Não crie dados de demonstração em demandas, eventos, aprovações nem ia_execucoes: essas tabelas só podem conter execuções reais.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://alcada-contas-a-pagar.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/71d97a81-66e7-4f02-9276-fd76c4b11f01).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
