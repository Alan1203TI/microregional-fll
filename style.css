export const TEAMS_DEFAULT = ["MODELO 1", "MODELO 2", "MODELO 3", "MODELO 4", "MODELO 5", "MODELO 6"];

export const MISSIONS = [
  { id: "inspecao", title: "INSPEÇÃO", type: "checks", items: [
    { id: "q3", text: "O robô da equipe e todos os equipamentos couberam completamente em apenas uma área de lançamento e tiveram, no máximo, 12 pol. (305mm) durante a inspeção.", points: 20 }
  ]},
  { id: "m1", title: "MISSÃO 1 - A CAPTURA DOS GAFANHOTOS", type: "checks", items: [
    { id: "q4", text: "O primeiro gafanhoto não está tocando mais o suporte", points: 10 },
    { id: "q5", text: "O segundo gafanhoto não está tocando mais o suporte", points: 10 }
  ]},
  { id: "m2", title: "MISSÃO 2 - O MANEJO DOS GAFANHOTOS", type: "checks", items: [
    { id: "q6", text: "O primeiro gafanhoto está em contato com a planta carnívora, sem tocar o tapete em qualquer ponto", points: 15 },
    { id: "q7", text: "O segundo gafanhoto está em contato com a planta carnívora, sem tocar o tapete em qualquer ponto", points: 15 }
  ]},
  { id: "m3", title: "MISSÃO 3 - PLANTA DO AR", type: "single", items: [
    { id: "q8", text: "A planta está erguida parcialmente", points: 15 },
    { id: "q9", text: "OU a planta está erguida totalmente", points: 30 }
  ]},
  { id: "m4", title: "MISSÃO 4 - TEIA EM EQUILÍBRIO", type: "checks", items: [
    { id: "q10", text: "A teia está desprendida do galho da árvore", points: 15 }
  ]},
  { id: "m5", title: "MISSÃO 5 - REFLORESTAMENTO", type: "checks", items: [
    { id: "q11", text: "A árvore está totalmente levantada", points: 20 }
  ]},
  { id: "m6", title: "MISSÃO 6 - FOLHAS DO OUTONO", type: "checks", items: [
    { id: "q12", text: "As duas folhas se desprenderam da árvore e caíram no tapete após acionamento da pá", points: 10 }
  ]},
  { id: "m7", title: "MISSÃO 7 - DE VOLTA ÀS RAÍZES", type: "checks", items: [
    { id: "q13", text: "A camada de terra foi abaixada e ficou em contato com o tapete, exibindo as raízes", points: 15 }
  ]},
  { id: "m8", title: "MISSÃO 8 - TUTORAMENTO DA ÁRVORE", type: "checks", items: [
    { id: "q14", text: "A árvore está totalmente levantada e encostada na base", points: 15 }
  ]},
  { id: "m9", title: "MISSÃO 9 - PONTO DE TENSÃO", type: "checks", items: [
    { id: "q15", text: "A contenção está totalmente derrubada, em contato com o tapete", points: 15 }
  ]},
  { id: "m10", title: "MISSÃO 10 - COLHEITA DOS FRUTOS", type: "checks", items: [
    { id: "q16", text: "O Fruto 1 não está tocando mais a haste de suporte da missão", points: 10 },
    { id: "q17", text: "O Fruto 2 não está tocando mais a haste de suporte da missão", points: 10 }
  ]},
  { id: "m11", title: "MISSÃO 11 - CONSERVAÇÃO DA FLORA", type: "checks", items: [
    { id: "q18", text: "O Fruto 1 está totalmente dentro do reservatório", points: 15 },
    { id: "q19", text: "O Fruto 2 está totalmente dentro do reservatório", points: 15 },
    { id: "q20", text: "A Folha 1 está totalmente dentro do reservatório", points: 15 },
    { id: "q21", text: "A Folha 2 está totalmente dentro do reservatório", points: 15 }
  ]},
  { id: "precision", title: "DISCOS DE PRECISÃO", type: "single", items: [
    { id: "d1", text: "1 disco restante", points: 10 },
    { id: "d2", text: "2 discos restantes", points: 15 },
    { id: "d3", text: "3 discos restantes", points: 25 },
    { id: "d4", text: "4 discos restantes", points: 35 },
    { id: "d5", text: "5 discos restantes", points: 50 },
    { id: "d6", text: "6 discos restantes", points: 50 }
  ]}
];

export function calculateScore(answers = {}) {
  let total = 0;
  for (const mission of MISSIONS) {
    for (const item of mission.items) {
      if (answers[item.id] === true) total += item.points;
    }
  }
  return total;
}
