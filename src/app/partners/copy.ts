export type Lang = "en" | "pt";

/** Portuguese for any pt-* browser, English for everyone else. */
export function langFromAcceptLanguage(header: string | null): Lang {
  const first = header?.split(",")[0]?.trim().toLowerCase() ?? "";
  return first.startsWith("pt") ? "pt" : "en";
}

export const CONTACT_EMAIL = "samuel@thegitcity.com";

export const COPY = {
  en: {
    meta: {
      title: "Partners - Git City",
      description: "Put your brand in the city developers built. 87,600 GitHub developers live here as buildings.",
    },
    nav: { back: "City", label: "For brands" },
    hero: {
      kicker: "Git City for brands",
      titleStart: "Put your brand in the city",
      titleAccent: "developers built",
      sub: "87,600 GitHub developers live here as buildings. Sponsor a town war, light up a billboard or fly a plane or blimp over the skyline.",
      cta: "Become a partner",
      secondary: "See the city",
    },
    contact: {
      title: "Become a partner",
      sub: "Tell us who you are. Samuel replies within 2 business days.",
      name: "Name",
      email: "Work email",
      company: "Company",
      message: "Anything we should know?",
      optional: "optional",
      requiredNote: "Required",
      errors: {
        name: "Enter your name.",
        emailRequired: "Enter your work email.",
        emailInvalid: "This email looks wrong. Check it, like name@company.com.",
        company: "Enter your company name.",
      },
      submit: "Send",
      sending: "Sending...",
      sentTitle: "Got it!",
      sentText: "Samuel will reply to your email within 2 business days.",
      error: "Something went wrong. Email us at",
    },
  },
  pt: {
    meta: {
      title: "Parceiros - Git City",
      description: "Coloque sua marca na cidade que os devs construíram. 87.600 devs do GitHub vivem aqui como prédios.",
    },
    nav: { back: "Cidade", label: "Para marcas" },
    hero: {
      kicker: "Git City para marcas",
      titleStart: "Coloque sua marca na cidade que",
      titleAccent: "os devs construíram",
      sub: "87.600 devs do GitHub vivem aqui como prédios. Patrocine uma guerra de towns, acenda um billboard ou voe com um avião ou balão sobre o skyline.",
      cta: "Seja parceiro",
      secondary: "Ver a cidade",
    },
    contact: {
      title: "Seja parceiro",
      sub: "Conta quem você é. O Samuel responde em até 2 dias úteis.",
      name: "Nome",
      email: "Email de trabalho",
      company: "Empresa",
      message: "Algo que a gente deva saber?",
      optional: "opcional",
      requiredNote: "Obrigatório",
      errors: {
        name: "Digite seu nome.",
        emailRequired: "Digite seu email de trabalho.",
        emailInvalid: "Esse email parece errado. Confira, tipo nome@empresa.com.",
        company: "Digite o nome da sua empresa.",
      },
      submit: "Enviar",
      sending: "Enviando...",
      sentTitle: "Recebido!",
      sentText: "O Samuel responde no seu email em até 2 dias úteis.",
      error: "Algo deu errado. Mande um email para",
    },
  },
} as const;

export type Copy = (typeof COPY)[Lang];
