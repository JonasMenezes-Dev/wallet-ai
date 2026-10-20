
from PIL import Image

arquivo = "assets/Captura de tela 2026-10-20 103251.png"
saida = "assets/wallet-icon.png"

imagem = Image.open(arquivo).convert("RGBA")
lado = max(imagem.width, imagem.height)

quadrada = Image.new("RGBA", (lado, lado), (0, 0, 0, 0))
posicao = (
    (lado - imagem.width) // 2,
    (lado - imagem.height) // 2,
)
quadrada.paste(imagem, posicao, imagem)
quadrada.save(saida)

print(f"Ícone criado: {saida} — {lado}x{lado}")