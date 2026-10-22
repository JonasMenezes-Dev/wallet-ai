# Wallet AI 2.1 — Etapa 2.5

Aplicativo de controle financeiro pessoal para Android, desenvolvido com **Expo, React Native e SQLite**. O objetivo é reunir contas, movimentações, metas e acompanhamento mensal em uma experiência simples, com dados armazenados localmente no dispositivo.

> **Status: código da versão 2.1.0 (versionCode 5), Etapa 2.5; nenhum APK gerado nesta etapa.** A validação da atualização em Android real permanece pendente. Confira os lançamentos com o extrato oficial do banco.

## Premium 2.0 — base preservada

Versão **2.0.0**, Android **versionCode 4**, package `com.walletai.app`. Reúne as 14 telas Premium, fonte Inter local, superfícies escuras/esmeralda, temas claro/escuro/sistema, ícone Android reenquadrado, filtros combináveis em painel e movimento com redução de animações respeitada.

O visual e os fluxos Premium 2.0 foram preservados. A captura bancária foi descontinuada na Etapa 1. A Etapa 2 adiciona importação local OFX/CSV; novo onboarding, insights 2.0 e lembretes semanais ficam para as próximas etapas.

## Importação local de extratos

No dashboard, abra **Importar extrato**, selecione a conta/cartão e um arquivo OFX, CSV ou PDF textual Itaú. Confirme o mapeamento das colunas CSV, revise o período, as sugestões e duplicidades, edite as movimentações e confirme explicitamente o lote. Nenhuma prévia cria lançamentos.

- OFX SGML e XML, incluindo namespace OFX padrão, conta bancária ou cartão; CSV com cabeçalho, delimitadores `;`, `,` ou tabulação, aspas e campos multilinha.
- Valores brasileiros/decimais em centavos exatos, datas brasileiras/ISO; horários só quando fornecidos. UTF-8, UTF-16 com BOM e Windows-1252.
- Identificação conservadora, categorias locais e correções de estabelecimento lembradas somente quando autorizadas. Pix, transferências próprias e pagamentos de fatura exigem revisão; Pix recebido não vira salário automaticamente.
- Recibos persistentes e revalidação dentro da transação impedem reimportar o mesmo arquivo/FITID. Semelhanças com lançamentos manuais ou outros arquivos ficam pendentes; operações legítimas semelhantes podem ser confirmadas como distintas.
- Lote atômico: falha não deixa importação parcial. Estornos comprovados reduzem consumo sem criar receita. Aportes e reservas permanecem separados.
- Apenas BRL; moeda ausente exige confirmação. Limite de 5 MiB e 10.000 movimentações. O saldo cadastrado deve representar o início do período ainda não lançado, pois importar aplica cada movimentação confirmada ao saldo existente.

Extratos não são enviados a servidores. A cópia temporária de leitura é removida após o uso; somente lançamentos confirmados, metadados de deduplicação e regras autorizadas permanecem no SQLite. Os novos módulos Expo de seleção, leitura e SHA-256 precisam estar presentes na próxima distribuição nativa. Sem necessidade de reinstalar ou limpar dados.

PDF Itaú: extração local por módulo Expo Android, até 30 páginas, com separação por coordenadas entre valor e saldo. A prévia mostra período, entradas/saídas, linhas ignoradas e possíveis falhas. Exige conferir a extração e confirmar o lote; Pix e transferências ambíguas continuam pendentes. Sem OCR, PDFs protegidos ou suporte a outros layouts nesta etapa. O módulo requer uma **nova development build Android**; Expo Go e builds antigos continuam somente com OFX/CSV. Não basta atualizar JavaScript via OTA.

Formatos, arquitetura, recuperação e limitações em [Etapa 2](docs/FINANCIAL_V2_STAGE2.md) e [PDF — Etapa 2.5](docs/FINANCIAL_V2_STAGE2_5.md).

## Contabilização financeira

- Receita e consumo são lançamentos reais; transferências próprias e pagamentos vinculados de cartão ficam fora desses totais.
- Aporte retira dinheiro da conta livre e credita a meta na mesma transação SQLite. Resgate faz o inverso, parcial ou integralmente, sem gerar receita ou despesa.
- Saldo livre é a soma das contas comuns, já sem o dinheiro reservado. Reserva é a soma das metas. Patrimônio total = saldo livre + reservas - dívida dos cartões.
- Relatórios mostram receitas, consumo, aportes, resgates e economia efetiva (receitas menos consumo) separadamente. Economia não é o saldo disponível nem o valor aportado.
- No histórico, aportes e resgates podem ter valor/conta editados; sua direção, meta e data são preservadas. Alterações e exclusões recalculam os dois saldos atomicamente e recusam estornos sem fundos. Transferências próprias continuam sendo excluídas como um par, sem edição isolada.

Veja [migração e descontinuação](docs/FINANCIAL_V2_STAGE1.md). Não limpe dados nem reinstale o aplicativo.

## O que já existe

- **Contas e cartões:** cadastro de contas, cartões e limites de crédito.
- **Movimentações:** registro, consulta, edição e exclusão de entradas e despesas.
- **Extratos:** importação local OFX/CSV/PDF Itaú com revisão, categorização e antiduplicação.
- **Metas:** acompanhamento de objetivos e aportes.
- **Dashboard:** resumo financeiro calculado a partir dos dados locais.
- **Orçamentos:** limites mensais por categoria.
- **Contas recorrentes:** acompanhamento de vencimentos e previsão de fluxo de caixa.
- **Relatórios:** visão mensal, comparação entre períodos e despesas por categoria.
- **Alertas internos:** avisos relacionados a orçamento e contas próximas do vencimento ou vencidas.
- **Tema:** suporte a aparência clara/escura conforme a configuração disponível no app/dispositivo.

## Importante antes de testar

- **Armazenamento local:** os dados ficam no próprio dispositivo. Não há sincronização entre celulares; duas instalações não compartilham os mesmos lançamentos.
- **Preservação dos dados:** desinstalar pode apagar o banco local. Ao atualizar o beta, instale o novo APK por cima da versão anterior e não desinstale o app.
- **Sem Open Finance:** não há integração oficial com contas bancárias.
- **Cartões:** recursos completos de fatura, fechamento e vencimento de cartão ainda não estão disponíveis.
- **Alertas:** os alertas internos do app não significam que notificações do sistema em segundo plano estejam garantidas.
- **Atualizações:** publicar código no GitHub não atualiza automaticamente um APK instalado. A distribuição e eventuais atualizações EAS precisam ser configuradas e validadas separadamente.

## APK beta 1.0.2 (histórico; não representa a versão 2.1)

- Distribuição: EAS Build, perfil `preview`, Android APK assinado (116,9 MB reportados).
- Application ID: `com.walletai.app`.
- Build de 20/10/2026: [APK beta 1.0.2 no Expo](https://expo.dev/artifacts/eas/K32-f8dcnNa5WnEjLNUp4-w2Qcvd7mXEyJoTgtoVEH4.apk).
- Não há sincronização automática entre aparelhos nem backup/restauração validado.
- A existência do APK não substitui testes em Android real (notificações, permissões, persistência, saldos e atualização sem perder dados).

## Gerar o APK de teste

Pré-requisito: Node.js compatível com a versão do projeto e acesso à conta Expo/EAS.

```bash
npm ci
npm run typecheck
npm run lint
npx eas-cli login
npx eas-cli build --platform android --profile preview --freeze-credentials
```

O perfil `preview` está configurado para gerar um APK de distribuição interna. Quando o EAS terminar, abra o link de instalação no Android.

## Validação do beta

Use dados fictícios ou movimentações pequenas e controladas. Confira cada resultado com os valores esperados e com a fonte financeira original.

Consulte o [plano de testes do beta](docs/BETA_TEST_PLAN.md) para o roteiro de validação e o [histórico de alterações](CHANGELOG.md) para acompanhar a evolução do projeto.

## Desenvolvimento local

```bash
npm ci
npm run typecheck
npm run lint
npx expo start
```

Comandos disponíveis no projeto:

| Comando | Finalidade |
| --- | --- |
| `npm run typecheck` | Verifica os tipos TypeScript |
| `npm run lint` | Executa o ESLint |
| `npx expo start` | Inicia o servidor de desenvolvimento |
| `npx eas-cli build --platform android --profile preview` | Solicita a geração do APK beta |

O projeto utiliza Expo Router para navegação e SQLite para persistência local. A atualização e os fluxos financeiros também precisam de validação em Android real.

## Contribuição e segurança

Antes de abrir uma alteração, execute typecheck e lint e descreva o comportamento validado. Não publique APKs nem dados financeiros pessoais em issues, logs ou commits. Problemas de segurança devem ser reportados sem incluir credenciais, extratos ou informações identificáveis.

---

Feito para evoluir com testes reais, correções pequenas e validação cuidadosa.
