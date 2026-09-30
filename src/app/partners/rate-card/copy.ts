import type { Lang } from "../copy";

export const RATE_COPY = {
  en: {
    meta: {
      title: "Rate card - Git City",
      description: "Sponsor a Git City event or town. You pay in prizes for developers, not money.",
    },
    back: "Partners",
    kicker: "Git City",
    title: "Rate card",
    sub: "Your audience: 50,900 developers signed in with GitHub. You pay in prizes, not money.",
    cost: "Cost to your brand",
    gets: "You get",
    rows: [
      {
        what: "Event",
        length: "1 week",
        cost: "5 prizes",
        costNote:
          "One for each of the 5 developers who code the most in the event. You pick the prize.",
        gets: [
          "“Powered by YOUR BRAND” on the event page",
          "Your brand on the plaza monument",
          "Your brand in the launch email to 31,000+ developers",
          "Your brand in the winner announcement",
        ],
      },
      {
        what: "Town",
        length: "4 weeks",
        cost: "4 prizes",
        costNote:
          "One a week for the developer who codes the most in the town. You pick the prize.",
        gets: [
          "“Powered by YOUR BRAND” on the town page",
          "Your brand on the town's billboards, plane and blimp",
          "A mention every time the town wins the week",
        ],
      },
    ],
    bonus: { label: "On the house", text: "Your brand in the main city while you sponsor." },
    prizeNote: "Prizes: merch, months of your plan, credits or licenses.",
    how: {
      title: "How it works",
      steps: [
        "Pick an event or a town.",
        "Send your logo, your link and the prizes you'll give.",
        "We launch it. At the end we tell you who won.",
      ],
      delivery:
        "You send the prizes to the winners. If the prize is a code or a link, we hand it to them for you.",
    },
    cta: "Sponsor",
  },
  pt: {
    meta: {
      title: "Rate card - Git City",
      description:
        "Patrocine um evento ou uma town do Git City. Você paga em prêmios pros devs, não em dinheiro.",
    },
    back: "Parceiros",
    kicker: "Git City",
    title: "Rate card",
    sub: "Seu público: 50.900 devs logados com GitHub. Você paga em prêmios, não em dinheiro.",
    cost: "Custo pra sua marca",
    gets: "Você recebe",
    rows: [
      {
        what: "Evento",
        length: "1 semana",
        cost: "5 prêmios",
        costNote: "Um pra cada um dos 5 devs que mais codarem no evento. Você escolhe o prêmio.",
        gets: [
          "“Powered by SUA MARCA” na página do evento",
          "Sua marca no monumento da praça",
          "Sua marca no email de lançamento pra 31 mil devs",
          "Sua marca no anúncio do vencedor",
        ],
      },
      {
        what: "Town",
        length: "4 semanas",
        cost: "4 prêmios",
        costNote: "Um por semana pro dev que mais codar na town. Você escolhe o prêmio.",
        gets: [
          "“Powered by SUA MARCA” na página da town",
          "Sua marca nos billboards, no avião e no balão da town",
          "Menção toda vez que a town vencer a semana",
        ],
      },
    ],
    bonus: { label: "De brinde", text: "Sua marca na cidade principal enquanto patrocina." },
    prizeNote: "Prêmios: brindes, meses do seu plano, créditos ou licenças.",
    how: {
      title: "Como funciona",
      steps: [
        "Escolha um evento ou uma town.",
        "Mande seu logo, seu link e os prêmios que vai dar.",
        "A gente lança. No fim a gente te conta quem ganhou.",
      ],
      delivery:
        "Você envia os prêmios aos vencedores. Se o prêmio for um código ou link, a gente entrega por você.",
    },
    cta: "Patrocinar",
  },
} as const satisfies Record<Lang, unknown>;
