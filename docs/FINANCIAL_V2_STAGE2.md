# Wallet AI 2.1 — Etapa 2

## Arquitetura implementada

Pipeline local: arquivo em cache temporário → leitura OFX/CSV → linhas normalizadas com centavos e datas fornecidas → identificação conservadora → categorias por regras exatas/correções → deduplicação persistente → revisão → lote SQLite atômico.

1. Leitores independentes OFX SGML/XML e CSV configurável, com fixtures sintéticas e testes de entradas inválidas.
2. Identificação e categorias locais; regras aprendidas por estabelecimento equivalente, sem IA ou servidores.
3. Migração aditiva para recibos de importação e regras. Reutilizar o efeito financeiro da Etapa 1 dentro da mesma transação do lote; revalidar duplicatas no commit.
4. Tela Premium de seleção, mapeamento, revisão/edição e confirmação explícita; lista virtualizada, processamento em blocos e limites de tamanho.
5. Testes de persistência, interrupção, sobreposição, cartão/transferências/reservas, TypeScript, ESLint e revisão independente. Commit na branch atual, sem APK, merge, push ou Etapa 3.

Decisões: moeda diferente de BRL exige conversão fora deste importador e será recusada. Moeda ausente exige confirmação explícita de BRL. Pix/transferências e pagamentos de fatura ambíguos requerem resolução humana e, para movimentos próprios, indicação da outra conta. Somente metadados mínimos são persistidos; arquivos completos e linhas não confirmadas não são armazenados permanentemente.

## Módulos

- `statement-file.ts`: seletor do sistema, leitura local, SHA-256 dos bytes, conta de origem identificada por hash e exclusão apenas da cópia em cache. O documento original do usuário nunca é apagado.
- `statement-parsers.ts`: UTF-8 validado (BOM opcional), UTF-16 LE/BE com BOM e fallback Windows-1252; validação de estrutura, calendário, horários, valores e limites. Processamento cede ao event loop em blocos.
- `statement-rules.ts`: reconhecimento conservador de Pix, compras, transferência, pagamento de conta/fatura, tarifa, estorno e rendimento; normalização de estabelecimento, palavras completas e correções exatas priorizadas. Não usa IA ou APIs.
- `statement-import.service.ts`: prévia sem escrita, revisão de duplicidades antes/depois da edição e nova checagem sob a transação de confirmação. Reutiliza as operações financeiras existentes com a mesma conexão SQLite do lote.
- `app/statement-import.tsx`: conta/cartão, arquivo, confirmação do mapeamento, amostra, período, reconhecidas/duplicadas/pendentes, edição e seleção, confirmação final e resumo. Lista virtualizada, ações bloqueadas durante processamento e movimento reduzido respeitado.

## Formatos efetivamente suportados

OFX SGML 1.x e XML 2.x com um bloco de movimentações de uma conta ou cartão: `STMTTRN`, `FITID`, `DTPOSTED`, `TRNAMT`, `TRNTYPE`, `NAME`, `MEMO`, `BANKID`, `ACCTID` e `CURDEF`. Declaração XML, comentários e namespace OFX padrão (inclusive prefixo `ofx:`) são aceitos. XML minificado usa número lógico único de transação. Valores seguem sinal bancário; datas de dia permanecem `AAAA-MM-DD`. Hora/minuto ou segundos e offset são preservados somente se fornecidos. Não inferimos horário de compra.

CSV com cabeçalho e delimitador `;`, `,` ou tabulação; aspas escapadas, campos multilinha, nomes portugueses/ingleses e mapeamento manual obrigatório por confirmação. Suporta data brasileira `DD/MM/AAAA` ou ISO, valor com sinal (`1.234,56`, `1234.56`) OU colunas separadas de entrada/saída. Coluna inativa pode ser vazia ou zero; duas nãozero exigem correção. Cabeçalhos desconhecidos podem ser mapeados manualmente. Exemplos são sintéticos, sem dados de bancos reais.

As categorias adicionadas são Supermercado, Alimentação fora de casa, Transporte, Compras, Lazer, Saúde, Educação, Moradia, Assinaturas, Serviços, Transferências e Outros. Categorias já existentes continuam intactas. Correção aprendida só é gravada junto de uma despesa selecionada e com a opção de lembrar habilitada. Uma nova correção autorizada substitui a anterior para a mesma chave exata; não há aprendizado a partir de linhas canceladas.

## Deduplicação e recuperação

Recibos guardam conta local, escopo bancário em hash, ID bancário quando presente, hash do arquivo, posição lógica, data/centavos/descrição normalizada originais e referência à movimentação. Não guardam arquivo, nome de arquivo, caminho ou número bruto da conta bancária. Os recibos sobrevivem à exclusão de um lançamento: reimportar não recria automaticamente algo que foi excluído.

Arquivo/posição já confirmados e ID bancário estável com valor/data correspondentes bloqueiam repetição. Dados divergentes para um mesmo ID, similaridades sem ID, correspondências manuais e o outro lado de transferência já registrada ficam para revisão explícita. IDs bancários distintos preservam compras legítimas do mesmo valor/estabelecimento/dia. A prévia e o commit usam a mesma ordem; instantes iguais com offsets diferentes são comparados como o mesmo instante.

O commit revalida os selecionados e grava saldos, transações, recibos e regras numa transação isolada. Qualquer falha reverte tudo. Se o app fechar antes da confirmação ou durante um lote não concluído, abra o arquivo novamente: prévias não são recuperadas como lançamentos automáticos, lotes revertidos podem ser tentados outra vez, lotes já confirmados são reconhecidos pelos recibos. Não se exige reinstalação ou limpeza de dados.

Migração 12 apenas adiciona tabelas/índices e `transactions.is_refund` com padrão zero. Não reescreve saldos ou históricos. Esse marcador permite restaurar caixa/dívida e compensar despesas de consumo, sem contar estorno como receita real. Edição e exclusão usam as regras normais da transação; receitas, transferências, pagamentos de cartão e aportes legados mantêm seu comportamento.

Consultas de período mantêm a data civil de registros sem horário ou sem offset. Somente horários com `Z`/offset explícito são convertidos ao mês local. Isso evita deslocar uma movimentação do primeiro dia para o mês anterior e não atribui um fuso que o extrato não forneceu.

## Resultados automatizados

- **139 testes direcionados aprovados, zero falhas**: 55 testes do importador e 84 regressões financeiras/remoção da captura.
- Leitores: 14 testes; regras: 11; importação SQLite: 21; seleção/leitura e cache: 5; interface: 3; recuperação entre seis processos: 1.
- Regressões: transferências, receitas/despesas, cartões/pagamentos, aportes/resgates, edição/exclusão, persistência/migrações e ausência da captura bancária.
- TypeScript (`tsc --noEmit`), ESLint e verificação de espaços aprovados. Revisão independente corrigiu os casos de fuso, FITID repetido em ordem inversa e revisão de duplicidade após edição/conflito tardio.

Comandos executados:

```powershell
node --experimental-strip-types --test tests/statement-*.test.mjs tests/account-transfers.test.mjs tests/transactions-card.test.mjs tests/goal-movements.test.mjs tests/persistence.test.mjs tests/capture-removal.test.mjs
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js .
git diff --check
```

## Limitações conhecidas e validação no aparelho

- BRL apenas, 5 MiB e 10.000 movimentações. CSV sem cabeçalho, arquivos XLS/XLSX/PDF/QFX e múltiplas contas OFX não são suportados.
- OFX com extensões XML arbitrárias, atributos não reconhecidos, DTD, entidades externas ou estrutura incompleta é recusado. Campos OFX de correção exigem revisão explícita; o importador não concilia automaticamente uma movimentação corrigida pelo banco.
- CSV não interpreta um saldo acumulado como valor da movimentação. Formatos com separador isolado e três casas (`1.234`/`1,234`) são ambíguos e não são presumidos como milhares. Erros podem ser corrigidos manualmente na revisão ou pelo mapeamento/arquivo.
- Classificação é sugestão, sem comprovação universal de layout bancário. Pix/transferências, aplicações, saques e operações incertas exigem decisão humana. Movimentos entre conta e meta continuam usando o fluxo dedicado da Etapa 1; não são inferidos de extratos.
- O usuário escolhe a conta correspondente e confere o saldo inicial. Importar um período que já esteja incluído somente no saldo inicial, sem lançamentos correspondentes, não pode ser detectado por deduplicação de transações. Não ajustamos saldos iniciais automaticamente.
- Estornos de compras anteriores podem deixar consumo líquido negativo no período; isso é mostrado sem transformar a devolução em renda. Gráficos limitam apenas a barra visual a zero, mantendo o valor financeiro.
- A limpeza da cópia em cache é tentada após leitura, inclusive em falhas; se o processo morrer durante leitura, o cache pode permanecer até a limpeza do sistema. O arquivo original nunca é removido.
- `expo-document-picker`, `expo-file-system` e `expo-crypto` devem estar na próxima versão nativa instalada. Não foi gerado APK nesta etapa. Testes Node substituem apenas a fronteira nativa e não comprovam o seletor, acessibilidade visual, fluidez ou atualização em Android real.

Validar em aparelho: atualizar com a mesma assinatura preservando dados, escolher OFX/CSV sintéticos do gerenciador de arquivos, conferir mapeamento/teclado/safe areas, editar linha, resolver Pix/transferência/fatura, confirmar lote, reabrir e reimportar períodos sobrepostos. Conferir conta, cartão, reservas e relatórios contra valores independentes.
