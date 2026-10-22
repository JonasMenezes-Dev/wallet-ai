# Wallet AI 2.1 — Etapa 1

## Dados e atualização

A migração 11 adiciona `transactions.goal_movement`, sem reescrever valores, contas, metas ou histórico. `NULL` nos aportes legados continua significando aporte. Novos registros de meta usam `type = transfer`, `goal_id` e direção `contribution` ou `withdrawal`; transferências próprias continuam usando os pares identificados por `transfer_id`.

Transações já confirmadas por notificações conservam IDs, origem, valor, data, metadados, conta e categoria. São lidas, editadas e excluídas pelos mesmos fluxos financeiros normais. Nenhuma migração apaga receitas, despesas, cartões, pagamentos, metas, transferências, orçamentos ou recorrências.

A tabela histórica `notification_confirmation_receipts` da migração 10 fica inativa. Mantemos a migração histórica para compatibilidade entre versões; nenhum código de captura, recuperação ou confirmação a consulta. Não fazemos DROP ou limpeza destrutiva no SQLite.

Fila nativa e preferências criptografadas antigas permanecem inertes no armazenamento privado de instalações atualizadas. O código que as lia, escrevia ou decriptava foi removido. Não há conversão automática de pendências em transações. Sua eventual limpeza deve ser uma migração futura específica e opcional, sem alcançar o SQLite financeiro ou chaves compartilhadas. Nesta etapa não limpamos arquivos privados nem removemos chaves do dispositivo.

Não é necessário limpar dados ou reinstalar. Quando uma versão nativa for distribuída, deve atualizar a instalação com a mesma assinatura. A remoção do serviço Android exige essa atualização nativa; uma atualização apenas de JavaScript não remove um serviço de um APK já instalado. Esta etapa não gerou APK nem publicou atualização.

## Regras dos saldos

- Aporte: conta livre diminui e meta aumenta pelo mesmo número de centavos.
- Resgate: meta diminui e conta livre aumenta. Não é receita nova.
- Aportes, resgates, transferências próprias e pagamentos vinculados de cartão não entram em receitas ou consumo. Compras no cartão continuam sendo despesas; seu pagamento não as duplica.
- Saldo livre: soma das contas comuns, já sem as reservas. Não é a diferença entre receitas e despesas do mês, nem inclui limite de crédito.
- Reservado: soma dos saldos das metas.
- Patrimônio: livre + reservado - dívida dos cartões. Mover dinheiro para reserva não altera esse total.
- Economia efetiva do período: receitas reais - despesas reais. Aportes/resgates são mostrados à parte e não alteram esse resultado.
- Reserva inicial de meta representa dinheiro que ainda não está registrado nas contas. Se o dinheiro já estiver em conta cadastrada, criar meta zerada e aportar. Saldos iniciais legados são preservados sem inferir sua origem.

Criar, editar valor/conta e excluir movimentações de meta usa transação SQLite isolada e aritmética em centavos. Falta de fundos, cartão como conta de reserva, centavos fracionários e estornos impossíveis são recusados sem mudanças parciais. Editar conserva meta, direção e data. Excluir um aporte que já foi resgatado nunca zera artificialmente a meta para criar dinheiro na conta.

## Remoções

- `modules/notification-listener/`: módulo Expo/Kotlin, serviço, manifestos, acesso especial, catálogo Android, autorização, fila e criptografia exclusivas da captura.
- `app/notification-import.tsx` e componentes `BankNotificationSettings`, `DevelopmentCaptureDiagnostics`, `NotificationConfirmationForm`.
- Serviços `notification-*`, parser `financial-notification-parser`, engine `src/notifications/bank-notification-engine` e repositório `notification-confirmation`.
- `tools/notification-fixture`, catálogo documental e testes/helpers exclusivos da captura.
- Referências na configuração visual, atalhos e serviços financeiros. O parser bancário de `open-finance.service` foi removido; o contrato independente existente foi preservado, sem implementar importador.

Não havia dependência direta `expo-notifications` no manifesto inicial. Nenhuma dependência compartilhada foi retirada; a solicitação de `POST_NOTIFICATIONS` para notificações próprias permanece. Premium 2.0 e alertas locais permanecem no projeto.

## Verificação

Verificações locais: **113 testes aprovados, zero falhas**, TypeScript, ESLint e `git diff --check` aprovados. Incluem transferências, cartões, receitas, despesas, aportes, resgates, edição entre contas, exclusão sem fundos, concorrência, falhas com rollback, migrações, registros confirmados legados, ausência da captura e reinício SQLite entre processos.

Comandos: `node --experimental-strip-types --test tests/*.test.mjs`, `node node_modules/typescript/bin/tsc --noEmit`, `node node_modules/eslint/bin/eslint.js .`. O uso direto de Node contorna um problema local de PATH nos wrappers do npm.

Testes automatizados usam SQLite real na fronteira Node, incluindo reinício entre processos. Isso não substitui validação em Android real: atualizar instalação existente, conferir registros legados, aporte/resgate/edição/exclusão, relatórios, navegação e ausência de acesso especial à captura. Roteiro em [BETA_TEST_PLAN.md](BETA_TEST_PLAN.md).

Sem OFX/CSV, novo onboarding, insights 2.0, merge, push ou APK nesta etapa.
