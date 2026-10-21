# Premium 2.0 — migração de telas

## Implementação

- Início: superfície de saldo com topografia e arcos, hierarquia de saldo/resumos/gastos/insights, espaçamento explícito entre cards, ícones vetoriais e barras de categorias animadas. Permanecem todas as ferramentas, contas, metas e movimentações reais.
- Histórico: lista virtualizada com cabeçalho rolável, busca, edição/exclusão/troca de categoria, botão de filtros e ação de nova transação. Preservadas as restrições de edição de transferências/aportes e os alertas de impacto financeiro.
- `TransactionFilterPanel`: rascunho isolado do filtro aplicado; combinar tipo, período, intervalo personalizado, origem, categoria, conta e cartão; limpar é provisório até Aplicar; fechar descarta alterações. Reutiliza `filterTransactions` sem alterar suas regras, inclusive a normalização de intervalo invertido.
- Contas/cartões, metas e seus formulários: Inter, cards e controles compartilhados, ícones originais, aportes/progresso em destaque, valores monetários sem reticências e medidas para telas estreitas. Preservados pagamentos, validações, exclusões e todos os campos.
- Relatórios: resumo e gráficos com os dados reais disponíveis (mês atual/anterior), categorias animadas. Não há dados fictícios de semanas ou filtros sem suporte no serviço.
- Orçamentos, recorrências e alertas: cards, hierarquia, estados e ações premium; formulários de planejamento usam o painel compartilhado.
- Configurações, revisão e auxiliares: aparência premium, permissões e opt-in de captura separados, mesmas preferências, confirmação explícita e recuperação de operações interrompidas. Formulário conserva data/hora capturada e edição manual.
- Onboarding: introdução premium e privacidade, preservando os quatro campos do cadastro financeiro original.

## Componentes e movimento

`PremiumSheet` oferece `{ visible, onClose, title, children, footer? }`, fecha pelo botão Voltar e permite rolar conteúdo com teclado aberto. Usa Modal nativo com scrim e entrada/saída Reanimated de 230ms, sem desmontar durante a animação de saída. O painel também respeita a preferência de redução de movimento.

Microinterações usam 130ms; abas/navegação 260ms; progresso 320ms. Entradas de listas são limitadas aos primeiros 12 itens e o atraso de blocos a 160ms. A geometria permanece estática. Nenhuma dependência nova ou alteração de serviços, repositórios, SQLite, migrações ou Kotlin.

Os SVGs específicos ficam em `assets/premium`. Busca, filtros, transferências, recorrências, recibos e sucesso estão centralizados em `WalletSymbol`; contas, metas e onboarding usam seus exports originais nas dimensões da referência.

## Evidências e limites

- Referências high fidelity com screenshots consultadas: Transações, Contas, Metas, Editar meta, Onboarding, Relatórios, Orçamentos, Recorrências e Alertas. Início e Novo lançamento reutilizam os contextos obtidos na etapa 1.
- O limite Starter do Figma bloqueou novas consultas de Filtros, Configurações e Revisão bancária. Estas seguem a fundação aprovada e os fluxos existentes; a comparação visual integral dessas referências continua pendente.
- Revisões estáticas cruzadas preservaram os handlers. Foram corrigidos alvos de toque, valores financeiros truncados, inset superior duplicado e encolhimento do painel ao abrir teclado.
- Verificação final aprovada: TypeScript e ESLint sem erros/avisos; 25 testes de UI/componentes/filtros e 102 testes pertinentes de persistência, transferências, cartões, recorrências, confirmação, recuperação e revisão aprovados. Os 24 SVGs locais foram conferidos como não vazios e XML válido.
- 224 arquivos locais anteriores de serviços, banco, repositórios, módulos nativos e testes permanecem idênticos ao início; somente o helper de renderização de contas foi adaptado aos novos componentes.
- Sem build, APK, merge ou push. Não houve renderização do aplicativo em navegador/dispositivo nesta sessão; 60 FPS, contraste percebido, layout com teclado e escalas de fonte ainda precisam de conferência em aparelho.
- O commit registra os arquivos de interface alterados nesta etapa, incluindo os auxiliares de interface da beta que ainda não estavam rastreados. As alterações anteriores de serviços, banco, módulos nativos e seus testes ficam preservadas no diretório de trabalho, fora do commit; esta entrega não as descarta nem as reescreve.

## Verificação reproduzível

```powershell
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js .
node --experimental-strip-types --test tests/transaction-filter-panel.test.mjs tests/premium-components.test.mjs tests/card-payment-ui.test.mjs tests/notification-confirmation-ui.test.mjs tests/notification-confirmation-datetime.test.mjs
node --experimental-strip-types --test tests/account-transfers.test.mjs tests/transactions-card.test.mjs tests/recurring.test.mjs tests/persistence.test.mjs tests/notification-confirmation-integration.test.mjs tests/notification-review.test.mjs tests/notification-financial-confirmation.test.mjs
```

Na próxima execução autorizada em aparelho: conferir os 14 fluxos em claro/escuro/sistema, 320–430px, fonte ampliada, teclado e recortes do sistema; confirmar rolagem de painéis, retorno/cancelamento, ausência de flashes e fluidez com histórico extenso. Não produzir APK nesta etapa.
