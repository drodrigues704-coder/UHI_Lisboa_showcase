# UHI Lisboa — Calor à superfície em Lisboa

**Demo:** https://drodrigues704-coder.github.io/UHI_Lisboa_showcase/

Quando é que Lisboa fica mais quente do que o campo à sua volta, e quando fica
mais fresca. Ilhas de calor urbano de superfície (SUHI) a partir da temperatura
da superfície medida pelo **ECOSTRESS**, a bordo da Estação Espacial
Internacional, nos verões (junho a setembro) de 2018 a 2025.

Este repositório é uma **demonstração pública**: contém a app já construída e
um instantâneo dos resultados, para correr sem servidor (GitHub Pages). O
pipeline de dados, os dados brutos e o histórico de desenvolvimento ficam num
repositório privado.

## O que a app mostra

- **Quatro camadas**, de dia e de noite: temperatura da superfície, ilha de
  calor face ao campo (SUHI), stress térmico (UTFVI, classes de Zhang et al.)
  e refúgios térmicos
- **Diagnóstico ao clicar** em qualquer ponto de Lisboa: os valores de dia e de
  noite, a classe e a freguesia
- **Gráficos por freguesia** (as 24 de Lisboa) e um gráfico que compara cada
  tipo de coberto com a cidade
- Três mapas de fundo: claro, escuro e satélite

## O resultado principal

| | Lisboa face ao campo |
|---|---|
| Dia (11 passagens) | **0,8 °C mais fresca** |
| Noite (21 passagens) | **2,8 °C mais quente** |

É o ciclo diário típico de uma cidade mediterrânica. À tarde, o restolho seco
do campo aquece mais depressa do que a cidade, e Lisboa fica 1,3 °C mais
fresca. De madrugada, o campo arrefece por radiação e a cidade fica 2,8 °C
acima. A ilha de calor de Lisboa é **noturna**.

## Metodologia (resumo)

- **Temperatura da superfície:** ECOSTRESS `ECO_L2T_LSTE.002`, 70 m, via
  AppEEARS. Controlo de qualidade pelas camadas QC e de nuvens, mais uma
  remoção de nuvens residuais por consistência temporal.
- **Dia e noite em separado**, pela elevação do sol (dia ≥ 30°, noite < −6°).
  A ISS passa a horas diferentes em cada dia, por isso os mapas juntam vários
  anos e a SUHI diurna também é mostrada por hora da passagem.
- **SUHI calculada passagem a passagem** (LST menos a mediana da referência
  nessa passagem) e só depois agregada pela mediana. Isto remove grande parte
  do efeito da hora de passagem.
- **Referência rural fora de Lisboa.** Lisboa não tem campo dentro dos seus
  limites, e o verde da cidade (Monsanto) não serve de referência: está
  rodeado de cidade e quase não arrefece de noite. A referência são 95 mil
  pontos de campo aberto, sobretudo na Lezíria do Tejo, com:
  - vegetação não urbana em pelo menos 70% do píxel (COS2025, DGT);
  - pelo menos 1 km de áreas construídas densas;
  - altitude igualada à da cidade, pesando cada píxel da referência para
    reproduzir a distribuição de altitude urbana (MDT 25 m, DGT).
- **Coberto do solo:** COS2025 (Carta de Uso e Ocupação do Solo, DGT).
  Urbano é pelo menos 70% de território artificializado, onde entram os
  espaços verdes urbanos.
- **UTFVI e refúgios térmicos** comparam cada ponto com o resto de Lisboa, não
  com o campo: são contrastes internos à cidade.

## Limitações

- É **temperatura da superfície**, não do ar: num dia de verão o asfalto pode
  estar 10 a 20 °C acima do ar.
- O dia assenta em 11 passagens de 4 verões, porque a faixa do satélite muitas
  vezes cobre Lisboa mas não a Lezíria. A noite tem 21 passagens de 7 verões.
- Com as áreas verdes de Lisboa como referência, o resultado seria o inverso
  (+2,9 °C de dia, +0,3 °C de noite). A app mostra os dois valores e explica a
  diferença.

## Créditos

ECOSTRESS (NASA JPL, LP DAAC/AppEEARS) · COS, CAOP e MDT 25 m (Direção-Geral do
Território) · mapas de fundo Esri · Leaflet · Chart.js

Autor: Daniel Rodrigues
