import { useEffect } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard, FilePlus2, ListChecks, ShieldCheck, Building2, Wallet, Activity, Settings,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader,
  SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";

const items = [
  { title: "Painel", url: "/", icon: LayoutDashboard },
  { title: "Nova demanda", url: "/nova", icon: FilePlus2 },
  { title: "Demandas", url: "/demandas", icon: ListChecks },
  { title: "Aprovações", url: "/aprovacoes", icon: ShieldCheck, badge: true },
  { title: "Fornecedores", url: "/fornecedores", icon: Building2 },
  { title: "Centros de custo", url: "/centros-custo", icon: Wallet },
  { title: "Observabilidade", url: "/observabilidade", icon: Activity },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
] as const;

function usePendentes() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["aprovacoes-pendentes-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("aprovacoes").select("id", { count: "exact", head: true }).eq("status", "pendente");
      if (error) throw error;
      return count ?? 0;
    },
  });
  useEffect(() => {
    const ch = supabase
      .channel(`aprov-count-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "aprovacoes" }, () =>
        qc.invalidateQueries({ queryKey: ["aprovacoes-pendentes-count"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);
  return q.data ?? 0;
}

export function AppSidebar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const pendentes = usePendentes();
  const isActive = (u: string) => (u === "/" ? path === "/" : path.startsWith(u));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
        <div className="flex items-center gap-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary font-mono text-sm font-bold text-sidebar-primary-foreground">
            Aç
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <div className="text-sm font-semibold leading-tight">Alçada</div>
            <div className="truncate text-xs opacity-70">Boa Safra · Contas a Pagar</div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((it) => (
                <SidebarMenuItem key={it.url}>
                  <SidebarMenuButton asChild isActive={isActive(it.url)} tooltip={it.title}>
                    <Link to={it.url}>
                      <it.icon />
                      <span>{it.title}</span>
                    </Link>
                  </SidebarMenuButton>
                  {"badge" in it && pendentes > 0 && (
                    <SidebarMenuBadge className="num rounded-full bg-sidebar-primary text-sidebar-primary-foreground">
                      {pendentes}
                    </SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
