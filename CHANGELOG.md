# Histórico de alterações

As notas abaixo resumem o estado do projeto e não substituem a validação no dispositivo. Este histórico será atualizado conforme os betas forem testados.

## 2.1 — Etapa 2.5 (2026-10-22)

- PDF textual Itaú integrado ao mesmo pipeline OFX/CSV, revisão, categorias, deduplicação e confirmação atômica. Sem migração adicional ou alteração de saldos existentes.
- Extração local Android por módulo Expo/PDFBox: colunas por coordenadas, múltiplas páginas, datas de lançamento preservadas, linhas de saldo excluídas. Prévia exibe período, entradas/saídas, linhas ignoradas e possíveis falhas; exige conferência explícita da extração.
- Pix/TED permanecem ambíguos até revisão; devoluções Pix e rendimentos abreviados distinguem estorno de receita. Compras iguais permanecem revisáveis como operações distintas.
- Arquivo de referência privado excluído de Git/EAS; fixtures exclusivamente fictícias. Sem OCR ou envio externo. PDFs criptografados e sem texto são recusados.
- Requer nova development build Android. Preparação nativa, limites e validações em [Etapa 2.5](docs/FINANCIAL_V2_STAGE2_5.md). Nenhum APK, merge ou onboarding nesta entrega.

## 2.1 — Etapa 2 (2026-10-22)

- Pipeline local OFX SGML/XML e CSV configurável: seleção, decodificação, normalização, identificação, categorias, deduplicação, revisão e persistência atômica.
- Interface Premium com conta/cartão, amostra e mapeamento CSV, período, seleção múltipla, edição, resolução de ambiguidades e confirmação explícita.
- Deduplicação persistente por arquivo/linha, identificador bancário e correspondências conservadoras com registros existentes. Revisão atualizada após edição/conflito e tratamento de horários equivalentes entre fusos.
- Categorias iniciais adicionadas sem renomear categorias existentes; aprendizado por estabelecimento exato, somente mediante escolha do usuário.
- Migração 12 aditiva: recibos, regras e marcação de estorno. Estornos compensam consumo em relatórios/orçamento/dashboard sem gerar receita; compras, pagamentos de cartão, transferências e reservas preservados.
- Módulos Expo compatíveis para seleção local, leitura e SHA-256. Arquivos temporários removidos após leitura; sem APIs, IA generativa, envio de extratos ou logs de conteúdo financeiro.
- Limites: 5 MiB/10.000 registros, BRL, um extrato/conta por arquivo. [Formatos e limitações](docs/FINANCIAL_V2_STAGE2.md).
- Verificação local: 139 testes direcionados aprovados, TypeScript, ESLint e revisão independente; validação Android permanece pendente.
- Sem novo onboarding, insights 2.0, lembretes, APK, merge, push ou Etapa 3.

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
