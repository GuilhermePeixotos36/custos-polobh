// Avatar de uma conta do app: foto quando existe, iniciais quando não (ou quando a imagem não abre).
//
// `fotoUrl` é qualquer URL de imagem: a URL assinada do bucket privado `fotos-usuarios` (Acessos) ou
// a prévia local (blob:) de uma foto ainda não gravada. Com `carregando`, mostra o círculo em
// repouso (pulsando) no lugar da foto ou das iniciais.
import { useEffect, useState } from "react";

function iniciaisDe(nome: string) {
  return nome.trim().split(/\s+/).slice(0, 2).map((parte) => parte[0]).join("").toUpperCase() || "?";
}

export function AvatarUsuario({ nome, fotoUrl, className = "h-9 w-9", textoClassName = "text-2xs", title, carregando = false }: {
  nome: string;
  fotoUrl?: string | null;
  className?: string;
  textoClassName?: string;
  title?: string;
  carregando?: boolean;
}) {
  // Foto quebrada (link antigo, base64 truncado) cai nas iniciais em vez de virar ícone quebrado.
  const [falhou, setFalhou] = useState(false);
  useEffect(() => setFalhou(false), [fotoUrl]);

  const rotulo = title ?? nome;
  if (carregando) {
    return <span aria-hidden="true" title={rotulo} className={`inline-block shrink-0 animate-pulse rounded-full bg-muted ${className}`} />;
  }
  if (fotoUrl && !falhou) {
    return (
      <img
        src={fotoUrl}
        alt=""
        aria-hidden="true"
        title={rotulo}
        onError={() => setFalhou(true)}
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }
  return (
    <span title={rotulo} className={`inline-flex shrink-0 items-center justify-center rounded-full bg-navy font-bold text-navy-foreground ${className} ${textoClassName}`}>
      {iniciaisDe(nome)}
    </span>
  );
}
