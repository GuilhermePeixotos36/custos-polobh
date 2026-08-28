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
 * Vale para cliente (Dados Gerais do projeto) e para fornecedor (OS): o mesmo
 * número, o mesmo portal, o mesmo gesto.
 */
import { Button, Input } from "@/components/ui";
import { IcSearch } from "@/components/icons";

/** Consulta pública de inscrição municipal da Prefeitura de Belo Horizonte. */
const PORTAL_PBH = "https://mobiliarioonline.pbh.gov.br/mobiliario-cadastro-publico/f/t/emiteficwebsel";

export function InscricaoMunicipalInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (valor: string) => void;
}) {
  return (
    <div className="flex gap-2">
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="shrink-0"
        title="Consultar Inscrição Municipal no portal da Prefeitura de Belo Horizonte"
        aria-label="Consultar Inscrição Municipal na Prefeitura de Belo Horizonte"
        icon={<IcSearch width={15} height={15} />}
        onClick={() => window.open(PORTAL_PBH, "_blank", "noopener,noreferrer")}
      >
        Consultar na PBH
      </Button>
    </div>
  );
}
