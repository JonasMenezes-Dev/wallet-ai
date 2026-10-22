# Wallet AI 2.1 — PDF textual, Etapa 2.5

## Arquitetura e dados

`statement-file` seleciona/copia para cache, limita tamanho e calcula SHA-256. `statement-pdf-extractor` chama o módulo Expo local `modules/statement-pdf`; o parser `statement-pdf-parser` transforma células geométricas em `ParsedStatement`. A partir daí são reutilizados categorização, revisão, deduplicação, recibos persistentes e gravação SQLite atômica de OFX/CSV. Não há segundo motor financeiro nem migração adicional. Contas, cartões, reservas e históricos existentes são preservados. Somente linhas selecionadas e confirmadas geram movimentações.

O layout suportado é o extrato conta/lançamentos Itaú textual com quatro colunas: data, lançamentos, valor e saldo. As coordenadas dos cabeçalhos delimitam as colunas; páginas seguintes mantêm a geometria. Datas completas e valores brasileiros com sinal são validados. A data anexada à descrição é preservada e não substitui a data de lançamento. Não se cria horário, nome de estabelecimento ou método de pagamento. Linhas SALDO DO DIA e demais saldos reconhecidos não viram transações.

A prévia separa entradas/saídas de receitas/despesas: sinal positivo não prova receita. Pix/TED exigem resolução do usuário; não há regra baseada no tamanho do valor. Devoluções Pix recebidas compensam consumo; rendimentos explícitos são receitas sugeridas. Compras iguais continuam como registros distintos e possíveis duplicidades exigem confirmação individual. Recibos impedem reimportar linhas já salvas do mesmo arquivo.

## Limites e revisão

- Android, PDFs sem criptografia com texto extraível, até 5 MiB/30 páginas/10.000 movimentações. Até 250 mil posições de glifos e 500 mil caracteres; scratch em memória até 32 MiB.
- Sem OCR, PDFs de imagem, senha, texto vertical, outros bancos/layouts ou correção automática de linhas perdidas. Documento misto pode conter páginas vazias: a prévia alerta e exige conferência manual.
- Células incompletas, datas inválidas e valores ambíguos permanecem inválidos. Valores sem data confiável não são convertidos; página/linha e motivo estático aparecem na revisão. É obrigatório conferir a extração e as linhas ignoradas antes de salvar.
- Moeda ausente exige confirmação BRL. O saldo inicial cadastrado não é substituído pelo saldo impresso: cada movimentação confirmada é aplicada ao saldo existente, como em OFX/CSV.

## Privacidade

Nenhum PDF ou texto é enviado para APIs. A cópia do seletor em cache é removida em `finally`; o documento original não é apagado. O módulo só abre arquivos canônicos dentro do cache privado. O PDF de referência real está excluído de Git e EAS e não integra fixtures, snapshots, documentação ou logs. Os testes usam exclusivamente pessoas, conta, datas e valores fictícios.

PDFBox pode emitir conteúdo de PDFs inválidos nos logs upstream. O transform Gradle específico da dependência redireciona suas chamadas de Log para um destino silencioso e falha diante de assinaturas desconhecidas. Não altera logs globais do aplicativo. Detalhes e testes em [módulo nativo](../modules/statement-pdf/README.md).

## Compatibilidade e futura development build

O projeto usa Expo SDK 57/React Native 0.86. O módulo usa `expo-module-gradle-plugin`, autolinking local padrão em `modules/`, API Expo assíncrona e biblioteca Java [PDFBox Android 2.0.27.0](https://github.com/TomRoush/PdfBox-Android), com suporte real a PDFTextStripper e inicialização de recursos Android. MinSdk do módulo: 24, igual à base React Native instalada. Não adiciona um wrapper de ponte React Native antigo.

É necessária uma nova development build Android com o módulo; não funciona no Expo Go ou binário instalado anteriormente. [Documentação Expo](https://docs.expo.dev/workflow/customizing/). Não gerar atualização OTA com suporte PDF sem um runtime nativo compatível. O projeto está preparado para a futura build, sem APK nesta etapa. Usar o perfil development existente e preservar assinatura/dados; não reinstalar nem limpar dados.

Antes de distribuir, validar em aparelho: atualização preservando SQLite; PDF sintético textual de uma/várias páginas; imagem; criptografia; documento inválido; cancelamento/limpeza de cache; prévia e confirmação; reimportação; regressão OFX/CSV. A inspeção privada do arquivo real em memória valida o reconhecimento do layout, mas não comprova o comportamento da extração no Android.
