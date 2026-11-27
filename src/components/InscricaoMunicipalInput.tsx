/**
 * Inscrição Municipal com o atalho para conferir no portal da Prefeitura.
 *
 * A IM não vem nas fontes integradas de CNPJ — a consulta de CNPJ preenche razão
 * social, endereço e às vezes a IE, mas a Inscrição Municipal fica em branco e
 * alguém precisa buscar à mão. O botão abre o Mobiliário Online da PBH numa aba
 * nova, com o campo aqui do lado para colar o número.
 *
 * Não é uma integração: é o caminho até a fonte. O portal exige captcha, então
 * não há como consultar por dentro — o que dá para fazer é não obrigar ninguém a
 * lembrar o endereço dele.
 *
 * Vale para cliente (Dados Gerais do projeto) e para fornecedor (OS e cadastro):
 * o mesmo número, o mesmo portal, o mesmo gesto.
 *
 * Com o `cnpj` informado (27/11/2026), o clique COPIA o CNPJ antes de abrir o
 * portal: é ele que a pessoa vai colar lá para achar a inscrição.
 */
import { Button, Input } from "@/components/ui";
import { IcSearch } from "@/components/icons";
import { toast } from "@/store/toast";

/** Consulta pública de inscrição municipal da Prefeitura de Belo Horizonte. */
const PORTAL_PBH = "https://mobiliarioonline.pbh.gov.br/mobiliario-cadastro-publico/f/t/emiteficwebsel";

export function InscricaoMunicipalInput({
  value,
  onChange,
  cnpj,
  compacto = false,
}: {
  value: string;
  onChange: (valor: string) => void;
  /** CNPJ a copiar para a área de transferência ao abrir a consulta. */
  cnpj?: string;
  /** Só a lupa, num botão quadrado — para formulários em que o rótulo já explica. */
  compacto?: boolean;
}) {
  const digitos = (cnpj ?? "").replace(/\D/g, "");
  async function abrirConsulta() {
    if (digitos) {
      try {
        await navigator.clipboard?.writeText(digitos);
        toast("CNPJ copiado. Cole no portal da PBH para achar a inscrição municipal.", "info");
      } catch {
        toast("Não foi possível copiar o CNPJ; copie à mão antes de consultar.", "warning");
      }
    }
    window.open(PORTAL_PBH, "_blank", "noopener,noreferrer");
  }
  const titulo = digitos
    ? "Copia o CNPJ e abre a consulta de Inscrição Municipal da Prefeitura de Belo Horizonte"
    : "Consultar Inscrição Municipal no portal da Prefeitura de Belo Horizonte";
  return (
    <div className="flex gap-2">
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
      {compacto ? (
        <button
          type="button"
          onClick={() => void abrirConsulta()}
          title={titulo}
          aria-label="Consultar Inscrição Municipal na Prefeitura de Belo Horizonte"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-btn border-[1.5px] border-[#D6D9E0] bg-surface text-ink-2 hover:border-primary hover:bg-primary-soft hover:text-primary-dark input-focus"
        >
          <IcSearch width={17} height={17} />
        </button>
      ) : (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="shrink-0"
          title={titulo}
          aria-label="Consultar Inscrição Municipal na Prefeitura de Belo Horizonte"
          icon={<IcSearch width={15} height={15} />}
          onClick={() => void abrirConsulta()}
        >
          Consultar na PBH
        </Button>
      )}
    </div>
  );
}
