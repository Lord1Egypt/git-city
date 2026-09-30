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
    sub: "Pay in prizes for developers, not money.",
    cols: { what: "Sponsorship", prize: "Prize", length: "Length" },
    rows: [
      {
        what: "Event",
        prize: "Top 5 developers",
        length: "1 week",
        gets: "Powered by on the event, the monument and the launch email to 31,000+ developers.",
      },
      {
        what: "Town",
        prize: "Top developer, every week",
        length: "4 weeks",
        gets: "Powered by on the town, its billboards, plane and blimp.",
      },
    ],
    bonus: "On the house: your brand in the main city while you sponsor.",
    prizeNote: "Prizes: merch, months of your plan, credits or licenses.",
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
    sub: "Pague em prêmios pros devs, não em dinheiro.",
    cols: { what: "Patrocínio", prize: "Prêmio", length: "Duração" },
    rows: [
      {
        what: "Evento",
        prize: "Top 5 devs",
        length: "1 semana",
        gets: "Powered by no evento, no monumento e no email de lançamento pra 31 mil devs.",
      },
      {
        what: "Town",
        prize: "Top 1 dev por semana",
        length: "4 semanas",
        gets: "Powered by na town, nos billboards, no avião e no balão dela.",
      },
    ],
    bonus: "De brinde: sua marca na cidade principal enquanto patrocina.",
    prizeNote: "Prêmios: brindes, meses do seu plano, créditos ou licenças.",
    cta: "Patrocinar",
  },
} as const satisfies Record<Lang, unknown>;
