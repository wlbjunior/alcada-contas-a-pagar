<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- All app pages live under `src/routes/_authenticated/` (sidebar layout in its route.tsx); only `/auth` is public — the panel is internal-only.
- Demo/seed rows are forbidden in demandas, eventos, aprovacoes, ia_execucoes — they only hold real executions from the n8n orchestrator.
- integracao_segredos has RLS with no policies; read it only server-side with the service-role client.
