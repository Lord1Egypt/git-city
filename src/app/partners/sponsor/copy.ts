import type { Lang } from "../copy";

export const SPONSOR_COPY = {
  en: {
    meta: {
      title: "Sponsor - Git City",
      description:
        "Sponsor a Git City event or town. You give prizes to developers, your brand gets the stage.",
    },
    nav: { back: "Partners", label: "Sponsor" },
    hero: {
      kicker: "Git City sponsorship",
      titleStart: "Put your brand on the",
      titleAccent: "town war",
      sub: "No money involved. You give prizes to the developers who code the most, and Git City puts your brand on the stage.",
      cta: "Sponsor with us",
    },
    offers: {
      kicker: "Two ways to sponsor",
      you: "You give",
      get: "You get",
      length: "Length",
      items: [
        {
          id: "event",
          name: "An event",
          example: "Claude vs Codex, powered by YOUR BRAND",
          give: ["Prizes for the 5 developers who code the most in the event"],
          get: [
            "“Powered by” on the event page and the plaza monument",
            "Your brand in the launch email to 31,000+ developers",
            "Your brand in the winner email and post",
            "Samuel's posts on X, Instagram and LinkedIn",
          ],
          length: "The event, usually one week",
        },
        {
          id: "town",
          name: "A town",
          example: "FullDev town, powered by YOUR BRAND",
          give: ["A weekly prize for the developer who codes the most in that town"],
          get: [
            "“Powered by” on the town page",
            "Your brand on the town's billboards, plane and blimp",
            "A mention every time the town wins the week",
          ],
          length: "At least 4 weeks",
        },
      ],
    },
    bonus: {
      label: "On the house",
      text: "While you sponsor, your brand also flies over the main city: billboards, rooftop signs, the plane and the blimp.",
    },
    towns: {
      kicker: "Towns you can sponsor",
      title: "Most visited this week",
    },
    prizes: {
      label: "What counts as a prize",
      text: "Anything a developer wants from you: merch, months of your plan, credits, licenses, courses. You send it straight to the winners.",
    },
    cta: { title: "Pick your event or town", button: "Talk to Samuel" },
  },
  pt: {
    meta: {
      title: "Patrocínio - Git City",
      description:
        "Patrocine um evento ou uma town do Git City. Você dá prêmios pros devs, sua marca ganha o palco.",
    },
    nav: { back: "Parceiros", label: "Patrocínio" },
    hero: {
      kicker: "Patrocínio Git City",
      titleStart: "Coloque sua marca na",
      titleAccent: "guerra das towns",
      sub: "Sem dinheiro. Você dá prêmios pros devs que mais codam, e o Git City coloca sua marca no palco.",
      cta: "Quero patrocinar",
    },
    offers: {
      kicker: "Duas formas de patrocinar",
      you: "Você dá",
      get: "Você recebe",
      length: "Duração",
      items: [
        {
          id: "event",
          name: "Um evento",
          example: "Claude vs Codex, powered by SUA MARCA",
          give: ["Prêmios pros 5 devs que mais codarem no evento"],
          get: [
            "“Powered by” na página do evento e no monumento da praça",
            "Sua marca no email de lançamento pra mais de 31 mil devs",
            "Sua marca no email e no post do vencedor",
            "Posts do Samuel no X, Instagram e LinkedIn",
          ],
          length: "O evento, normalmente uma semana",
        },
        {
          id: "town",
          name: "Uma town",
          example: "Town FullDev, powered by SUA MARCA",
          give: ["Um prêmio por semana pro dev que mais codar naquela town"],
          get: [
            "“Powered by” na página da town",
            "Sua marca nos billboards, no avião e no balão da town",
            "Menção toda vez que a town vencer a semana",
          ],
          length: "No mínimo 4 semanas",
        },
      ],
    },
    bonus: {
      label: "De brinde",
      text: "Enquanto você patrocina, sua marca também voa sobre a cidade principal: billboards, letreiros, o avião e o balão.",
    },
    towns: {
      kicker: "Towns pra patrocinar",
      title: "As mais visitadas da semana",
    },
    prizes: {
      label: "O que vale como prêmio",
      text: "Qualquer coisa que um dev queira da sua marca: brindes, meses do seu plano, créditos, licenças, cursos. Você envia direto pros vencedores.",
    },
    cta: { title: "Escolha seu evento ou town", button: "Falar com o Samuel" },
  },
} as const satisfies Record<Lang, unknown>;
