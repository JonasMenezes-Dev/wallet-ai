# Wallet AI Premium 2.0 — beta Android

Versão 2.0.0, versionCode 4, package `com.walletai.app`. Perfil EAS `preview`: distribuição interna, APK standalone (`developmentClient: false`), credenciais remotas existentes, `--freeze-credentials`. Runtime de atualizações acompanha a versão do app; nenhum conteúdo de notificações é enviado pelo fluxo de captura.

## Evidências locais

- Suíte completa: **312 testes aprovados**, sem falhas, incluindo saldos, transferências, cartões, metas, recorrências, orçamentos, migrações/persistência, captura, confirmação/reinício, deduplicação, filtros e ícone.
- TypeScript e ESLint: aprovados.
- Testes Kotlin puros de autorização, catálogo e privacidade: **15 aprovados**, compilados com o compilador local.
- Emissor fictício: Java compilado contra Android API 36. Ainda não representa execução/captura no aparelho.
- Gradle release local: tentativa parou no autolinking Windows (`android/settings.gradle`, processo cmd), antes da compilação do módulo. Resultado da compilação completa será o build EAS; não se declara compilação nativa aprovada com base apenas no JVM.
- Contextos e limites da migração visual: [etapa 1](premium-design-system.md), [etapa 2](premium-stage2.md).

## Captura e reconhecimento

Os 12 packages do [catálogo verificado](supported-notification-apps.md) são apenas fontes descobríveis e selecionáveis quando instaladas. Permissão Android não ativa captura interna nem autoriza novos apps automaticamente. Conteúdo só é lido após autorização e só persiste se passar pelo filtro de privacidade, na mesma fila criptografada. Extras do emissor fictício nunca substituem `sbn.packageName` ou `sbn.postTime`; seu pacote não é autorizável em release.

O interpretador local sugere operação, centavos BRL e canais expressos na mensagem, preservando o timestamp original. Texto oculto, falta de valor, saldo/limite concorrente, moedas estrangeiras, rejeições, promoções e credenciais recebem estados seguros. A pessoa escolhe os dados e confirma explicitamente; resumo reconhecido nunca equivale a lançamento gravado. Eventos ignorados não exibem formulário financeiro, salvo recuperação de intenção previamente aprovada.

## Duplicidade e recuperação

- Mesma identidade/eventKey: recibos persistentes e gravação financeira atômica impedem replay, inclusive depois de reinício.
- Eventos diferentes: antes da gravação, sob o lock da transação, compara-se tipo/contas/centavos e os instantes aprovados em janela inclusiva de 120 segundos. Descrição e categoria não tornam uma compra distinta. Data legada sem hora usa cautelarmente o dia civil.
- Também consulta lançamentos manuais existentes. Transferências exigem par íntegro de duas pernas, origem/destino, valor/data e contas não-cartão; aportes e pagamentos de cartão não são confundidos com transferência comum.
- Um candidato bloqueia a nova gravação; não reutiliza recibo de outro evento, não mescla ou descarta notificações, não altera saldos existentes. A intenção permanece pendente para revisão/recuperação. Pode haver falsos positivos em compras legítimas próximas e de mesmo valor.
- A checagem não prova identidade comercial nem cobre todas as formulações. Não intercepta lançamento manual inserido posteriormente nem supõe identidade em pares de transferência corrompidos/incompletos. Recibos são consultados por tipo, com custo linear; sem nova migração nesta camada.
- Recuperação consulta recibos; não cria transações automaticamente. Data/hora editável permanece a da ocorrência aprovada, sem usar o relógio da confirmação.

## APK e GitHub

Artefato oficial e resultado do build serão registrados aqui após a geração. A branch de entrega é `feat/premium-redesign`, preservando b941ecf, 5d52323 e a base e09f795 da PR #15. Sem merge automático. PRs #11/#14 têm divergência histórica e não devem ser encerradas ou sobrescritas sem revisão própria.

## Validação em aparelho real pendente

Instalar por cima da versão anterior somente com a mesma assinatura; nunca desinstalar para contornar conflito de assinatura, pois isso pode apagar o banco. Fazer primeiro cópia de segurança pelo procedimento já validado pelo usuário, se disponível; não se promete backup/restauração implementado.

Verificar início sem Metro, migração preservando dados, os 14 fluxos, teclado/safe areas/fontes ampliadas, animações, captura autorizada e revogação, rejeição de OTP e notificações incompletas, persistência ao reiniciar e possíveis duplicatas. Carteiras podem não publicar notificações acessíveis. Emissor e testes automáticos usam somente dados fictícios; não validam compras reais por NFC ou carteiras digitais.
