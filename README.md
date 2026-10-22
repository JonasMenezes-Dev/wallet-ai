# Wallet AI 2.1 — Etapa 1

Aplicativo de controle financeiro pessoal para Android, desenvolvido com **Expo, React Native e SQLite**. O objetivo é reunir contas, movimentações, metas e acompanhamento mensal em uma experiência simples, com dados armazenados localmente no dispositivo.

> **Status: código da versão 2.1.0 (versionCode 5), Etapa 1; nenhum APK gerado nesta etapa.** A validação da atualização em Android real permanece pendente. Confira os lançamentos com o extrato oficial do banco.

## Premium 2.0 — base preservada

Versão **2.0.0**, Android **versionCode 4**, package `com.walletai.app`. Reúne as 14 telas Premium, fonte Inter local, superfícies escuras/esmeralda, temas claro/escuro/sistema, ícone Android reenquadrado, filtros combináveis em painel e movimento com redução de animações respeitada.

O visual e os fluxos Premium 2.0 foram preservados. Na versão 2.1 a captura de notificações bancárias foi descontinuada; OFX/CSV, novo onboarding e insights 2.0 serão desenvolvidos nas próximas etapas.

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
