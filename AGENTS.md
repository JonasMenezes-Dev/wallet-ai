# Regras de desenvolvimento — Wallet AI

## Objetivo
Desenvolver o Wallet AI com qualidade, segurança financeira e consumo moderado de tokens.

## 1. Economia de contexto
- Leia apenas os arquivos diretamente relacionados à tarefa.
- Não faça auditorias gerais do projeto sem solicitação.
- Não releia arquivos que já foram analisados, exceto quando necessário.
- Prefira buscas específicas em vez de listar arquivos inteiros.
- Não explore funcionalidades fora do escopo solicitado.
- Evite explicações extensas sobre operações internas.
'
## 2. Execução de comandos
- Priorize orientar o usuário a executar comandos simples no terminal.
- Forneça comandos prontos para copiar e colar.
- Solicite apenas a saída relevante para diagnosticar problemas.
- Execute comandos diretamente somente quando isso economizar trabalho significativo ou for necessário para implementar a tarefa.
- Não execute builds completos, geração de APK ou suítes extensas de testes automaticamente.

## 3. Testes e validações
- Crie testes automatizados quando a alteração justificar.
- Execute apenas os testes diretamente relacionados ao código alterado.
- Para verificações gerais, forneça os comandos para o usuário executar.
- Não repita testes que já passaram sem alterações posteriores relevantes.
- Nunca declare uma funcionalidade validada sem evidências.
- Para cálculos financeiros, persistência, transferências e migrações, priorize testes rigorosos e integridade dos dados.

## 4. Alterações de código
- Trabalhe somente no escopo solicitado.
- Não refatore arquivos não relacionados.
- Não adicione dependências sem necessidade.
- Preserve funcionalidades existentes.
- Prefira alterações pequenas e localizadas.
- Evite criar abstrações desnecessárias.
- Não reescreva arquivos inteiros quando uma alteração pontual resolver.

## 5. Comunicação
- Seja direto e econômico nas respostas.
- Não narre cada arquivo lido ou comando executado.
- Ao finalizar, informe apenas:
  1. O que foi alterado.
  2. Quais arquivos foram afetados.
  3. O que foi testado.
  4. O que o usuário precisa executar ou validar.
- Não gere relatórios extensos sem solicitação.

## 6. Autonomia
- Não implemente funcionalidades adicionais por iniciativa própria.
- Não execute tarefas secundárias fora do escopo.
- Quando identificar melhorias não solicitadas, apenas informe resumidamente.
- Se a tarefa crescer significativamente, interrompa e proponha uma divisão em etapas.
- Não faça commits, merges, pushes ou gere APKs sem autorização.

## 7. Prioridade absoluta
A economia de tokens nunca deve comprometer:
- Integridade dos dados financeiros.
- Correção dos saldos.
- Segurança das transações.
- Persistência dos dados.
- Migrações do banco de dados.
- Testes necessários para evitar regressões críticas.

Em tarefas simples, priorize velocidade e economia. Em tarefas financeiras críticas, priorize a correção e a segurança.