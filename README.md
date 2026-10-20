# Wallet.ai

Aplicativo de controle financeiro pessoal para Android, desenvolvido com **Expo, React Native e SQLite**. O objetivo é reunir contas, movimentações, metas e acompanhamento mensal em uma experiência simples, com dados armazenados localmente no dispositivo.

> **Status: beta privado / em validação.** O app ainda está sendo testado. Não use como única fonte de informação financeira e confira os lançamentos com o aplicativo ou extrato oficial do banco.

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

## Importante antes de testar

- **Armazenamento local:** os dados ficam no próprio dispositivo. Não há sincronização entre celulares; duas instalações não compartilham os mesmos lançamentos.
- **Preservação dos dados:** desinstalar pode apagar o banco local. Ao atualizar o beta, instale o novo APK por cima da versão anterior e não desinstale o app.
- **Permissão de notificações:** a importação exige que o usuário conceda acesso nas configurações do Android. Só habilite se compreender essa permissão.
- **Compatibilidade:** notificações variam entre bancos e versões. Alguns avisos podem não ser reconhecidos ou podem não conter um valor confiável; revise tudo antes de confirmar.
- **Sem Open Finance:** não há integração oficial com contas bancárias.
- **Cartões:** recursos completos de fatura, fechamento e vencimento de cartão ainda não estão disponíveis.
- **Alertas:** os alertas internos do app não significam que notificações do sistema em segundo plano estejam garantidas.
- **Atualizações:** publicar código no GitHub não atualiza automaticamente um APK instalado. A distribuição e eventuais atualizações EAS precisam ser configuradas e validadas separadamente.

## Gerar o APK de teste

Pré-requisito: Node.js compatível com a versão do projeto e acesso à conta Expo/EAS.

```bash
npm ci
npm run typecheck
npm run lint
npx eas-cli login
npx eas-cli build --platform android --profile preview
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
