# Wallet AI — auditoria inicial do redesign

Data da auditoria: 2026-10-19
Branch de trabalho: `redesign/phase-1-design-system`
Base analisada: `feature/premium-fintech-theme`

## Objetivo e limites

Redesenhar a experiência visual para uma fintech premium, clara e elegante, com verde-esmeralda como cor principal e tema claro/escuro alternável. A navegação principal será feita por abas inferiores, sem gestos horizontais entre abas.

O trabalho deve preservar regras financeiras, contratos entre telas/serviços/repositórios e o banco SQLite existente. Mudanças de esquema ou migrações não fazem parte do redesign visual.

## Estrutura identificada

- `app/`: rotas, telas, navegação e fluxos de formulários.
- `src/components/`: componentes visuais compartilhados.
- `src/theme/`: paletas, provider e estilos dependentes do tema.
- `src/hooks/`: estado e acesso a dados para telas.
- `src/services/`: operações e regras de negócio financeiras.
- `src/repositories/`: consultas e gravações SQLite.
- `src/database/`: inicialização e migrações do banco.

## Constatações

1. O sistema de tema já existe em `src/theme/colors.tsx`, com paletas `lightColors` e `darkColors`, `ThemeProvider` e hooks de leitura/alteração.
2. A preferência de tema é persistida em `app_preferences`, chave `theme`, dentro do SQLite. A tabela é criada com `CREATE TABLE IF NOT EXISTS`; a estrutura financeira não precisa ser alterada para suportar a preferência.
3. `app/_layout.tsx` fornece o tema ao navegador raiz e ajusta a cor da barra de status.
4. `app/(tabs)/_layout.tsx` define cinco abas (Início, Transações, Contas, Metas e Configurações), mas usa pontos como ícones e oculta os rótulos. Isso será tratado na fase de navegação.
5. Telas como Início, Transações, Contas e Metas têm arquivos grandes e estilos locais extensos. É preferível evoluí-las por etapas e extrair padrões repetidos apenas quando houver evidência de reutilização.
6. `src/components/SwipeableTabScreen.tsx` implementa navegação horizontal com `PanResponder`. A busca no código do GitHub não confirmou referências de uso; não remover o arquivo até validar todas as referências no checkout local. O requisito é remover o gesto de troca entre abas, sem confundir isso com rolagens horizontais locais de seletores.
7. `.github/workflows/quality.yml` executa `npm run typecheck` e `npm run lint`, mas não contém testes automatizados de regras financeiras.
8. `package.json` já inclui Expo Router, React Native, SQLite e safe-area context; a primeira fase não precisa introduzir dependências novas.

## Áreas protegidas

Evitar alterações em `src/database/database.ts`, `src/database/migrations.ts`, repositórios, serviços financeiros e cálculos de saldo. Só tocar nesses módulos se uma dependência estritamente necessária for descoberta e justificada.

## Estratégia por fases

### Fase 0 — auditoria e linha de base
- Registrar a estrutura e os riscos.
- Trabalhar em branch isolada.
- Identificar verificações existentes.
- Executar typecheck/lint no checkout local antes e depois das mudanças; a conexão GitHub usada para esta auditoria não executa comandos npm no checkout local.

### Fase 1 — fundação visual
- Consolidar tokens compartilhados de espaçamento, raios, tipografia, dimensões de controles e ícones.
- Manter paletas semânticas claro/escuro já existentes como fonte da verdade para cores.
- Não substituir estilos de todas as telas nesta fase; a aplicação gradual começa nas próximas fases.
- Não alterar esquema SQLite nem regras financeiras.

### Fases seguintes
- Navegação inferior com ícones e rótulos.
- Redesign de Início, Transações, Contas e Metas.
- Redesign de formulários, onboarding e configurações.
- Validação manual de fluxos financeiros, persistência, temas, telas pequenas, teclado e navegação.

## Validações pendentes no ambiente local

- `npm run typecheck`
- `npm run lint`
- Referências completas a `SwipeableTabScreen`
- Fluxos manuais de criação/edição/exclusão de transações e metas, saldo das contas e persistência do tema

## Fase 1 — fundação visual iniciada

Implementado nesta branch:
- `src/theme/tokens.ts`: escala compartilhada de espaçamento, raios, tipografia, dimensões de controles, ícones e duração de animações.
- `src/theme/index.ts`: exporta os tokens para consumo consistente pelas telas e componentes.
- `app/_layout.tsx`: aguarda o carregamento da preferência de tema antes de montar a navegação, exibindo um indicador simples com a cor do tema para reduzir o flash visual no arranque.

Decisões de segurança:
- As paletas semânticas existentes em `src/theme/colors.tsx` foram mantidas nesta primeira passagem; não havia evidência suficiente para substituir cores que já estão conectadas a toda a aplicação.
- Nenhum arquivo de banco, migração, serviço financeiro ou repositório foi alterado.
- Os tokens foram adicionados sem substituir em massa os estilos das telas. A adoção visual será incremental.

## Verificação desta entrega

Os arquivos foram gravados na branch remota `redesign/phase-1-design-system`. O conector GitHub permite inspecionar e editar os arquivos, mas não executa `npm run typecheck`, `npm run lint` nem abre o app em um emulador. Portanto, esses checks continuam pendentes no checkout local e não devem ser considerados aprovados.

Esta auditoria foi feita a partir dos arquivos acessíveis na branch remota; não representa execução local dos comandos ou teste em dispositivo.


## Fase 2 — componentes visuais compartilhados

Criados na branch:
- `src/components/AppCard.tsx`: superfície reutilizável com borda, raio e preenchimento coerentes com o tema.
- `src/components/AppButton.tsx`: botão primário, secundário ou discreto, com estados de acessibilidade e feedback de toque.
- `src/components/ScreenHeader.tsx`: cabeçalho padronizado com título, subtítulo, eyebrow e espaço opcional para ação.
- `src/components/SectionHeader.tsx`: cabeçalho compacto para seções e listas.

Os componentes consultam as cores do tema no momento da renderização e usam os tokens compartilhados. Não foram introduzidas dependências.

## Fase 3 — navegação e início

- A barra inferior agora exibe rótulos e símbolos por aba, com destaque visual discreto para a rota ativa.
- Os nomes acessíveis das cinco abas foram mantidos; o rótulo visual de Configurações foi encurtado para “Ajustes”.
- A tela Início passou a usar tokens compartilhados para espaçamento, raios e hierarquia tipográfica em pontos-chave, reduzindo diferenças entre estilos.
- Nenhum cálculo, hook de dados, serviço, repositório ou esquema SQLite foi alterado.

## Validação local necessária após as fases 2 e 3

No checkout local da branch, executar:
- `npm run typecheck`
- `npm run lint`
- `npx expo start` e conferir as cinco abas, os dois temas, o cabeçalho e o cartão de saldo em uma tela pequena.

A edição via GitHub não executa esses comandos. Até receber os resultados do checkout local, a validação de compilação e de interface permanece pendente.

## Fase 4 — telas de movimentações, contas, metas e preferências

- Padronizados os cabeçalhos de Transações, Contas, Metas e Configurações com o componente compartilhado `ScreenHeader`.
- Ajustados os espaçamentos superiores para aproveitar melhor a área útil abaixo da navegação.
- Cartões de transação e conta ganharam bordas semânticas consistentes com o restante do design system.
- A seção de aparência em Configurações mantém a seleção e persistência dos temas claro e escuro.

## Fase 5 — formulários de criação e edição

- Padronizados os cabeçalhos dos formulários de nova/edição de transação e nova/edição de meta.
- Reduzido o espaçamento superior excessivo nos formulários, mantendo rolagem, teclado, seletores, validações e ações existentes.
- Nenhuma regra financeira, chamada de serviço, repositório ou estrutura SQLite foi alterada nesta etapa.

## Validação local pendente

As alterações foram gravadas na branch remota; a integração do GitHub não executa comandos npm nem abre o app em um dispositivo. No checkout local desta branch, rodar `npm run typecheck` e `npm run lint`, depois abrir o app e conferir os fluxos de criação/edição de transações e metas, filtros de transações, contas/cartões e persistência dos temas.

## Fase 6 — acabamento visual premium

- Refinada a hierarquia do cabeçalho compartilhado para acomodar títulos, subtítulos e ações sem pressionar o conteúdo em larguras menores.
- Cartões compartilhados ganharam elevação discreta; cartões de transação e conta mantêm bordas e superfícies semânticas.
- Ajustados espaçamentos, cartões de resumo e exibição de valores monetários no dashboard para reduzir cortes em telas compactas.
- Ajustados os controles de busca, filtros, ações e seletores de metas/contas para uma interação mais confortável.
- A tela de Configurações agora usa o cartão compartilhado para a seção de aparência, com rótulos de acessibilidade para seleção de tema.

## Fase 7 — responsividade e acessibilidade

- A barra inferior adapta o tamanho dos rótulos em telas estreitas e distribui as cinco abas sem exigir largura mínima excessiva.
- Reduzidos os espaçamentos laterais de telas e formulários, preservando uma área confortável para o conteúdo.
- Ações principais e opções de seleção receberam áreas de toque maiores, com alvo mínimo próximo de 44 pontos quando aplicável.
- Formulários de criação e edição de transações/metas melhoram o comportamento com teclado, permitem dispensá-lo ao rolar e mantêm os controles utilizáveis.
- Os valores do dashboard podem reduzir a tipografia automaticamente para evitar corte de moeda em cartões estreitos.

## Validação local da fase 6/7

As alterações foram aplicadas na branch remota `redesign/phase-1-design-system`. Rodar no checkout local atualizado `npm run typecheck` e `npm run lint`; depois conferir em um aparelho estreito e em tema claro/escuro a barra inferior, valores longos, filtros, opções de toque e formulários com teclado aberto. A edição via GitHub não executa esses testes.
## Fase 8 — revisão funcional financeira

Revisão estática dos serviços e repositórios de transações, contas, metas e dashboard. Nenhum cálculo de saldo ou esquema SQLite foi alterado nesta fase.

### Ajuste aplicado

- As validações de metas agora rejeitam explicitamente valores não finitos (NaN/Infinity) e IDs que não sejam inteiros seguros positivos. Isso fecha uma brecha de validação de entrada sem mudar os fluxos válidos de criação, edição e aporte.

### Regras críticas revisadas

- Entradas e despesas alteram saldos de contas comuns em sentidos opostos; em cartão, despesas aumentam o valor utilizado e entradas o reduzem.
- Criação, edição e exclusão de transações atualizam o saldo dentro de transações SQLite.
- Aportes em metas descontam o saldo da conta, aumentam o valor guardado e registram uma transação; a exclusão do aporte deve reverter esses efeitos.
- Contas com transações não podem ser removidas; metas com valor guardado não podem ser removidas.
- Cartão armazena valor utilizado positivo; limite disponível não é exibido como valor negativo.

### Verificação ainda necessária no dispositivo

O projeto não possui atualmente um runner de testes automatizados configurado. Não foi adicionada uma dependência de testes só para esta fase, e a revisão estática não equivale à execução dos fluxos. Após atualizar a branch, validar manualmente:

1. Criar uma entrada e uma despesa em conta bancária e confirmar o saldo.
2. Criar uma despesa no cartão e confirmar o valor utilizado/disponível.
3. Editar uma transação alterando valor, tipo e conta; conferir os saldos das duas contas.
4. Excluir transação e confirmar o estorno correto.
5. Fazer aporte em meta, confirmar o saldo e progresso; excluir o aporte e confirmar a reversão.
6. Tentar lançar uma despesa maior que o saldo, aportar acima do saldo ou ultrapassar a meta; a operação deve ser recusada sem alterações parciais.
7. Fechar e reabrir o app para confirmar persistência de transações, contas, metas e preferência de tema.

A conexão GitHub permite alterar e revisar o código, mas não executa npm nem o aplicativo. Executar localmente `npm run typecheck` e `npm run lint` depois de puxar as alterações; a execução dos fluxos acima continua pendente até ser testada no app.
