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

Esta auditoria foi feita a partir dos arquivos acessíveis na branch remota; não representa execução local dos comandos ou teste em dispositivo.
