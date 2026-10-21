# Wallet AI Premium 2.0 — etapa 2

**Objetivo:** aplicar a referência aprovada às telas existentes, mantendo dados reais e todas as ações da beta 1.0.2.
**Base:** feat/premium-redesign, b941ecf. Reutilizar a fundação da etapa 1, Expo SDK 57 e Reanimated instalados. Sem dependências novas, migrações, alterações de cálculos, APK, merge ou push.
**Referência:** Figma U4DFroIQnftdD9YH5cMcv4, página 4:2, frames 5:2 a 5:613. O conteúdo do código prevalece sobre os exemplos de dados do design.

## Grupos de implementação

- [x] Início, histórico, painel de filtros e componentes de movimento compartilhados. Filtros combináveis com rascunho/aplicar/cancelar/limpar, mantendo pesquisa e dados reais; lista virtualizada e contagens ativas.
- [x] Contas/cartões, metas, criação/edição de metas e onboarding. Preservar pagamentos, crédito, criação, exclusão e aportes; progresso animado e layout adaptável.
- [x] Relatórios, orçamentos, recorrências e alertas. Mesmos serviços e dados, hierarquia premium e ícones vetoriais; sem alterar cálculos.
- [x] Configurações, revisão bancária, criação/edição de transações e auxiliares de confirmação. Preservar permissões, preferências, horários, confirmação explícita e recuperação interrompida.
- [x] Integração e revisão estática de responsividade/teclado/safe area/acessibilidade; TypeScript, ESLint e 127 testes pertinentes aprovados; preparar commit na branch atual.
- [ ] Conferência visual/runtime em aparelho e comparação integral das referências bloqueadas pelo limite Figma, conforme docs/premium-stage2.md.

## Contratos e cuidados

- Usar PremiumScreen/PremiumAmbient atrás do conteúdo; formulários/configurações com ambient="subtle". Manter conteúdo de listas e formulários rolável.
- Estilos compartilhados da etapa 1 e fonte Inter; cards com margem consistente, controles com alvo mínimo 44, texto expansível, estados vazios/erro/carregamento e ações acessíveis.
- Reanimated: toque 130ms, menus 230ms, navegação 260ms, indicadores 320ms; redução de movimento desliga deslocamentos; sem animações contínuas de fundo.
- Agentes editam grupos disjuntos de telas; componentes/animadores compartilhados ficam sob responsabilidade do integrador. Não editar serviços, repositórios, banco ou módulos Kotlin.
- Arquivos locais anteriores registrados por SHA-256; arquivos financeiros e nativos devem permanecer idênticos. Nas telas já alteradas localmente, preservar os fluxos existentes integralmente ao atualizar aparência.
- Executar testes de filtros e os testes de UI/persistência/transferências/confirmação pertinentes. Não usar uma conferência estática como prova de desempenho em aparelho.
