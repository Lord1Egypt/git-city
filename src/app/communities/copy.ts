export { langFromAcceptLanguage, type Lang } from "../partners/copy";

export const COPY = {
  en: {
    meta: {
      title: "Communities - Git City",
      description: "Your community codes. Brands pay the prizes. Create your community's town in Git City.",
    },
    back: "City",
    label: "For communities",
    kicker: "Git City for communities",
    title: "Your community codes.",
    accent: "Brands pay the prizes.",
    sub: "Create your community's town. Every week, the member who codes the most wins a prize from a brand. Git City keeps nothing.",
    cta: "Create your town",
    see: "See a town",
    members: "members",
    leads: "leads this week",
    contributions: "contributions",
    youTitle: "You",
    youSteps: ["Create the town with your logo", "Share one link in your Discord or Telegram", "Post the result every Monday"],
    themTitle: "Your members",
    themSteps: ["Join with GitHub, no setup", "Code like any other week", "The top coder wins the prize"],
    place: (rank: number) => `Place ${rank} this week`,
    perDev: "per dev",
    brandsTitle: "We bring the brands",
    brandsText: "Brands sponsor the most active towns first. The more your members code, the sooner your town gets a sponsor.",
  },
  pt: {
    meta: {
      title: "Comunidades - Git City",
      description: "Sua comunidade programa. As marcas pagam os prêmios. Crie a town da sua comunidade na Git City.",
    },
    back: "Cidade",
    label: "Para comunidades",
    kicker: "Git City para comunidades",
    title: "Sua comunidade programa.",
    accent: "As marcas pagam os prêmios.",
    sub: "Crie a town da sua comunidade. Toda semana, o membro que mais programa ganha um prêmio de uma marca. A Git City não fica com nada.",
    cta: "Criar sua town",
    see: "Ver uma town",
    members: "membros",
    leads: "lidera a semana",
    contributions: "contribuições",
    youTitle: "Você",
    youSteps: ["Cria a town com o seu logo", "Manda um link no Discord ou Telegram", "Posta o resultado toda segunda"],
    themTitle: "Seus membros",
    themSteps: ["Entram com o GitHub, sem configurar nada", "Programam como em qualquer semana", "Quem mais programou ganha o prêmio"],
    // The pixel font has no º, so no "4º lugar".
    place: (rank: number) => `Posição ${rank} na semana`,
    perDev: "por dev",
    brandsTitle: "A gente traz as marcas",
    brandsText: "As marcas patrocinam primeiro as towns mais ativas. Quanto mais seus membros programam, mais cedo sua town ganha um patrocinador.",
  },
};

export type Copy = (typeof COPY)["en"];
