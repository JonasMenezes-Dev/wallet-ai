# Extração local de texto PDF (Android)

Módulo Expo local `WalletStatementPdf`, descoberto pelo diretório `modules/` do autolinking. Usa o plugin Gradle do Expo instalado no projeto e PDFBox Android `2.0.27.0` do Maven Central. Não funciona no Expo Go nem em um aplicativo já instalado antes da inclusão do módulo; requer um novo development build Android. O adapter retorna um erro estático quando o módulo/plataforma não está disponível; OFX/CSV permanecem independentes.

- Aceita somente URI `file:` cujo caminho canônico está dentro de `context.cacheDir`, com arquivo regular legível entre 1 byte e 5 MiB. O chamador deve copiar a seleção para o cache privado e removê-la em `finally`.
- Parser estrito, até 30 páginas, 250 mil posições de glifos e 500 mil caracteres Unicode por documento. Scratch streams ficam em memória, limitada a 32 MiB; nenhum scratch externo é criado.
- Rejeita documentos protegidos/criptografados (inclusive senha vazia), sem texto extraível, geometrias inválidas ou texto vertical. Não executa OCR, não renderiza imagens e não envia conteúdo à rede.
- Retorna palavras/chunks com Unicode original e coordenadas em pontos, origem superior esquerda; `y` é a posição do topo estimada por `yDirAdj - heightDir`. A ordenação utiliza `sortByPosition` do PDFBox. Não interpreta nem persiste transações.
- Executa na fila assíncrona padrão do Expo, fora da UI. Documento, scratch e arquivo de acesso aleatório são fechados com `use`, inclusive em falhas. Erros expostos não mantêm causas ou caminhos do parser.

## Privacidade dos logs da dependência

O [PDFStreamEngine upstream](https://github.com/TomRoush/PdfBox-Android/blob/master/library/src/main/java/com/tom_roush/pdfbox/contentstream/PDFStreamEngine.java) pode registrar objetos de operandos de texto em PDFs inválidos; capturar exceções não elimina esse risco. Por isso `android/privacy-transform.gradle` registra um artifact transform específico para `com.tom-roush:pdfbox-android`. Ele redireciona referências de classe `android.util.Log` exclusivamente nas classes `com.tom_roush.*` do AAR para `PrivatePdfLog`, que descarta os argumentos. Não modifica logs globais ou regras R8 do aplicativo e mantém as dependências transitivas do componente.

A transformação preserva instruções, descritores e strings originais, verifica os métodos/descritivos suportados, reinspeciona o bytecode final e falha no build diante de métodos de logging desconhecidos, classes ausentes ou JARs adicionais inesperados. Alterações de versão da biblioteca precisam de nova revisão. O teste `:wallet-statement-pdf:verifyPdfPrivacyTransform` usa exclusivamente classes sintéticas: um Log que lança erro se for chamado, preservação do retorno e strings, idempotência e rejeição de método desconhecido. Nenhum PDF real é necessário.

`tests/PrivatePdfInputTest.kt` é um teste Kotlin standalone da política de acesso, com arquivos sintéticos temporários. A compilação Kotlin/Android e a execução em aparelho continuam necessárias para validar a integração e extração com PDFs sintéticos de texto/sem texto/protegidos/corrompidos. Este módulo não declara compatibilidade com todos os layouts de extrato.
