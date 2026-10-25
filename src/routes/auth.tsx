import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Alçada" },
      { name: "description", content: "Acesso ao painel de Contas a Pagar da Distribuidora Boa Safra." },
      { property: "og:title", content: "Entrar — Alçada" },
      { property: "og:description", content: "Acesso ao painel de Contas a Pagar da Distribuidora Boa Safra." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  async function entrar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(f.get("email")), password: String(f.get("senha")),
    });
    setLoading(false);
    if (error) return toast.error("Não foi possível entrar: " + error.message);
    navigate({ to: "/" });
  }

  async function criar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: String(f.get("email")), password: String(f.get("senha")),
      options: { emailRedirectTo: window.location.origin, data: { nome: String(f.get("nome")) } },
    });
    setLoading(false);
    if (error) return toast.error("Não foi possível criar a conta: " + error.message);
    if (data.session) navigate({ to: "/" });
    else toast.success("Conta criada. Verifique seu e-mail para confirmar.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-md bg-primary font-mono font-bold text-primary-foreground">Aç</div>
          <h1 className="text-xl font-semibold">Alçada</h1>
          <p className="text-sm text-muted-foreground">Contas a Pagar · Distribuidora Boa Safra Ltda</p>
        </div>
        <div className="rounded-lg border bg-card p-5">
          <Tabs defaultValue="entrar">
            <TabsList className="mb-4 grid w-full grid-cols-2">
              <TabsTrigger value="entrar">Entrar</TabsTrigger>
              <TabsTrigger value="criar">Criar conta</TabsTrigger>
            </TabsList>
            <TabsContent value="entrar">
              <form onSubmit={entrar} className="space-y-3">
                <div className="space-y-1"><Label htmlFor="e1">E-mail</Label><Input id="e1" name="email" type="email" required /></div>
                <div className="space-y-1"><Label htmlFor="s1">Senha</Label><Input id="s1" name="senha" type="password" required /></div>
                <Button className="w-full" disabled={loading}>Entrar</Button>
              </form>
            </TabsContent>
            <TabsContent value="criar">
              <form onSubmit={criar} className="space-y-3">
                <div className="space-y-1"><Label htmlFor="n2">Nome</Label><Input id="n2" name="nome" required /></div>
                <div className="space-y-1"><Label htmlFor="e2">E-mail</Label><Input id="e2" name="email" type="email" required /></div>
                <div className="space-y-1"><Label htmlFor="s2">Senha</Label><Input id="s2" name="senha" type="password" minLength={6} required /></div>
                <Button className="w-full" disabled={loading}>Criar conta</Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
