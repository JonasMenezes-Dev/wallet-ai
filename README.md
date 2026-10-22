# Wallet.ai — Android Beta 1.0.2

Aplicativo de controle financeiro pessoal para Android, desenvolvido com **Expo, React Native e SQLite**. O objetivo é reunir contas, movimentações, metas e acompanhamento mensal em uma experiência simples, com dados armazenados localmente no dispositivo.

> **Status: beta Android 1.0.2 (versionCode 3), APK preview gerado via EAS; validação no aparelho real ainda pendente.** O app ainda está sendo testado. Não use como única fonte de informação financeira e confira os lançamentos com o aplicativo ou extrato oficial do banco.

## Premium 2.0 — beta Android

Versão **2.0.0**, Android **versionCode 4**, package `com.walletai.app`. Reúne as 14 telas Premium, fonte Inter local, superfícies escuras/esmeralda, temas claro/escuro/sistema, ícone Android reenquadrado, filtros combináveis em painel e movimento com redução de animações respeitada.

A captura local agora oferece um catálogo de **12 aplicativos financeiros**, incluindo Google Wallet, Samsung Wallet e apps de pagamento. Os identificadores foram conferidos em páginas oficiais: [catálogo e fontes](docs/supported-notification-apps.md). Isso comprova os identificadores, **não a compatibilidade real de notificações ou pagamentos NFC**. Uma carteira pode não notificar uma compra, ocultar o conteúdo ou deixar de informar valor/modalidade.

Débito, crédito, Pix, transferências e estornos são candidatos à revisão quando o texto os confirma. Aproximação, online e presencial só são indicados quando explícitos. Valores ausentes, moedas conflitantes e conteúdo ambíguo não geram valores presumidos. Não há leitura direta de NFC, cartão, extrato ou Open Finance.

**Nenhuma notificação cria lançamento automaticamente.** O usuário revisa conta, categoria, tipo, valor e data/hora original antes de confirmar. Possíveis duplicatas de notificações diferentes ou lançamentos manuais já existentes bloqueiam uma segunda gravação e permanecem em revisão. A checagem é conservadora e pode segurar compras distintas de mesmo valor em instantes próximos; não mescla nem descarta eventos automaticamente.

Captura desligada/lista vazia por padrão; acesso Android, seleção de apps instalados e ativação interna são decisões separadas. A fila e autorizações continuam criptografadas com Android Keystore; indicadores de OTP/senha/credenciais/cartão completo são bloqueados antes de persistir e não são registrados em logs. O conteúdo de notificações não é enviado a servidores. Consulte [limites e validação do beta 2.0](docs/PREMIUM_2_BETA.md) e [emissor de notificações fictícias](tools/notification-fixture/README.md).

## O que já existe

- **Contas e cartões:** cadastro de contas, cartões e limites de crédito.
- **Movimentações:** registro, consulta, edição e exclusão de entradas e despesas.
- **Metas:** acompanhamento de objetivos e aportes.
- **Dashboard:** resumo financeiro calculado a partir dos dados locais.
- **Orçamentos:** limites mensais por categoria.
- **Contas recorrentes:** acompanhamento de vencimentos e previsão de fluxo de caixa.
- **Relatórios:** visão mensal, comparação entre períodos e despesas por categoria.
- **Alertas internos:** avisos relacionados a orçamento e contas próximas do vencimento ou vencidas.
- **Importação de notificações bancárias:** captura local de notificações compatíveis do Android, com revisão dos dados antes de criar uma movimentação.
- **Tema:** suporte a aparência clara/escura conforme a configuração disponível no app/dispositivo.

## Evolução da confirmação de notificações (build beta 1.0.2)

No APK beta gerado em 20/10/2026, a Central de revisão permite conferir uma notificação capturada e **confirmar explicitamente** uma receita, despesa ou transferência, revisando conta, categoria, valor, data e hora antes de gravar. A data/hora são sugeridas a partir da notificação no fuso local, e permanecem editáveis. Notificações sem horário válido exigem preenchimento manual. A implementação inclui mecanismos de prevenção de duplicidade e de recuperação de confirmações interrompidas.

As fontes locais de confirmação, recuperação e captura da beta 1.0.2 foram preservadas e incorporadas à branch `feat/premium-redesign` no ciclo Premium 2.0. O histórico do APK 1.0.2 abaixo permanece como referência; ele não contém o redesign atual.

## Importante antes de testar

- **Armazenamento local:** os dados ficam no próprio dispositivo. Não há sincronização entre celulares; duas instalações não compartilham os mesmos lançamentos.
- **Preservação dos dados:** desinstalar pode apagar o banco local. Ao atualizar o beta, instale o novo APK por cima da versão anterior e não desinstale o app.
- **Permissão de notificações:** a importação exige que o usuário conceda acesso nas configurações do Android. Só habilite se compreender essa permissão.
- **Compatibilidade:** notificações variam entre bancos e versões. Alguns avisos podem não ser reconhecidos ou podem não conter um valor confiável; revise tudo antes de confirmar.
- **Sem Open Finance:** não há integração oficial com contas bancárias.
- **Cartões:** recursos completos de fatura, fechamento e vencimento de cartão ainda não estão disponíveis.
- **Alertas:** os alertas internos do app não significam que notificações do sistema em segundo plano estejam garantidas.
- **Atualizações:** publicar código no GitHub não atualiza automaticamente um APK instalado. A distribuição e eventuais atualizações EAS precisam ser configuradas e validadas separadamente.

## APK beta 1.0.2

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

O projeto utiliza Expo Router para navegação e SQLite para persistência local. A importação de notificações depende do módulo nativo e deve ser testada em um APK Android compilado; o Expo Go e a versão web não substituem esse teste.

## Contribuição e segurança

Antes de abrir uma alteração, execute typecheck e lint e descreva o comportamento validado. Não publique APKs nem dados financeiros pessoais em issues, logs ou commits. Problemas de segurança devem ser reportados sem incluir credenciais, extratos ou informações identificáveis.

---

Feito para evoluir com testes reais, correções pequenas e validação cuidadosa.
