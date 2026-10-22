# Histórico de alterações

As notas abaixo resumem o estado do projeto e não substituem a validação no dispositivo. Este histórico será atualizado conforme os betas forem testados.

## 2.1 — Etapa 1 (2026-10-22)

- Descontinuados módulo Kotlin, listener, permissão especial, catálogo, regras de interpretação, fila criptografada, autorização, serviços, central de revisão, componentes, emissor de testes e testes exclusivos da captura bancária.
- Premium 2.0, SQLite e permissão para notificações próprias preservados. Nenhuma dependência compartilhada removida; o manifesto inicial não tinha `expo-notifications` como dependência direta.
- Aportes e resgates parciais/totais movimentam conta e reserva atomicamente, em centavos, sem inflar receitas, consumo ou patrimônio. Estornos sem fundos são rejeitados; edição de valor/conta disponível no histórico.
- Dashboard separa patrimônio (incluindo reservas e descontando dívida), saldo livre e reservado. Relatórios separam aportes, resgates e economia efetiva.
- Migração 11 apenas adiciona direção opcional da movimentação. Históricos, saldos e transações confirmadas anteriormente permanecem intactos; metadados antigos ficam inativos. Estratégia em [Etapa 1](docs/FINANCIAL_V2_STAGE1.md).
- OFX/CSV, onboarding e insights 2.0 não fazem parte desta entrega. Sem APK, merge ou push.

## 2.0.0 — Premium beta (2026-10-21)

- 14 telas e auxiliares com fundação Premium, Inter, temas existentes, texturas estáticas e ícone Android centralizado.
- Filtros combináveis em painel com aplicar/limpar/cancelar; histórico virtualizado; microinterações e redução de movimento.
- Catálogo Android com 12 IDs verificados, incluindo carteiras e apps de pagamento; autorização individual permanece explícita e desligada por padrão.
- Reconhecimento local conservador de débito/crédito/Pix/transferências/estornos e canais explícitos; estados incompletos/ambíguos sem presumir valores.
- Bloqueio nativo de indicadores de credenciais antes da persistência; armazenamento criptografado e Keystore preservados.
- Defesa transacional persistente contra possíveis duplicatas entre confirmações diferentes e lançamentos manuais existentes; replay idempotente e recuperação sem gravação automática.
- Emissor fictício ampliado; simulação não comprova captura real de banco, carteira ou NFC.
- Fontes locais da confirmação e captura da beta 1.0.2 incorporadas, preservando commits anteriores. Android versionCode 4 permite atualização sobre code 3 com a mesma assinatura.
- Verificações locais: 312 testes automatizados, TypeScript e ESLint aprovados; 15 testes Kotlin puros e compilação Java do emissor fictício aprovados. Compilação completa e artefato EAS registrados em [Premium 2 beta](docs/PREMIUM_2_BETA.md).

### Pendências externas

- Captura e interpretação com aplicativos financeiros reais, NFC real, configurações de cada fabricante e atualização sobre instalação existente em aparelho real.
- Avaliação visual completa, contraste percebido e fluidez/60 FPS em aparelho; parte das referências Figma atingiu o limite de consultas do plano.
- Backup/restauração e sincronização não são recursos validados.

## 1.0.2 — Beta candidato

- Dashboard com ajustes visuais e animações.
- Revisões nos cálculos e apresentações financeiras do dashboard, orçamento, relatórios e insights.
- Tratamento mais robusto para importação de notificações.
- Fluxos de alertas internos relacionados a orçamento e vencimentos.
- Preparação do perfil EAS Preview para gerar APK de distribuição interna.

### Validação pendente

- Geração e instalação do APK em dispositivo real.
- Testes manuais de contas, movimentações, metas, orçamento, relatórios e recorrências.
- Testes de permissão, reconhecimento, revisão e duplicidade na importação de notificações.
- Verificação da persistência local após fechar/reabrir e atualizar o APK.

Não considere os itens acima validados apenas porque o código compila ou o CI passa.
