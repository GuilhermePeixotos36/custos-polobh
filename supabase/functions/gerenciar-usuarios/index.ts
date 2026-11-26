// APOSENTADA (26/11/2026): o cadastro de usuários passou para a tela de Acessos e a Edge `acessos`
// (padrão de Acessos). Esta função gravava com a service role por fora das travas dos grupos de
// permissão (achado da revisão de segurança), por isso agora só responde que foi substituída.
Deno.serve((req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  return new Response(
    JSON.stringify({ ok: false, erro: "Esta função foi substituída pela tela de Acessos. Atualize o aplicativo (F5)." }),
    { status: 410, headers: { ...cors, "Content-Type": "application/json" } },
  );
});
