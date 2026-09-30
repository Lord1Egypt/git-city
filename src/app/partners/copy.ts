export type Lang = "en" | "pt";

/** Portuguese for any pt-* browser, English for everyone else. */
export function langFromAcceptLanguage(header: string | null): Lang {
  const first = header?.split(",")[0]?.trim().toLowerCase() ?? "";
  return first.startsWith("pt") ? "pt" : "en";
}

export const CONTACT_EMAIL = "samuel@thegitcity.com";

// Viral posts about Git City. GitHub's post shows its best print and links all four platforms.
export const SOCIAL_SLIDES = [
  {
    author: "@github",
    image: "/partners/github-instagram.jpg",
    imageHref: "https://www.instagram.com/reel/DXn0azYFOnW/",
    links: [
      { name: "X", href: "https://x.com/github/status/2048494014383505661" },
      { name: "YouTube", href: "https://www.youtube.com/shorts/34nTbYNWm4c" },
      { name: "TikTok", href: "https://www.tiktok.com/@github/video/7633192200859340064" },
      { name: "Instagram", href: "https://www.instagram.com/reel/DXn0azYFOnW/" },
      {
        name: "LinkedIn",
        href: "https://www.linkedin.com/posts/have-you-visited-git-city-ugcPost-7454265382669930496-6cCR/",
      },
    ],
  },
  {
    author: "@parasmadan.in",
    image: "/partners/paras-madan.jpg",
    imageHref: "https://www.instagram.com/reel/DVbEJoUktVg/",
    links: [{ name: "Instagram", href: "https://www.instagram.com/reel/DVbEJoUktVg/" }],
  },
  {
    image: "/partners/om-patel.jpg",
    imageHref: "https://x.com/om_patel5/status/2026823955634393159",
    links: [{ name: "X", href: "https://x.com/om_patel5/status/2026823955634393159" }],
  },
  {
    image: "/partners/tyler-shukert.jpg",
    imageHref: "https://x.com/dshukertjr/status/2029542947306209372",
    links: [{ name: "X", href: "https://x.com/dshukertjr/status/2029542947306209372" }],
  },
];

export const PRESS = [
  {
    name: "The Next Web",
    href: "https://thenextweb.com/news/inside-the-mind-of-a-viral-indie-hacker",
  },
  {
    name: "Tecmundo",
    href: "https://www.tecmundo.com.br/mercado/413306-playbook-como-construir-uma-comunidade-de-80-mil-desenvolvedores-em-60-dias.htm",
  },
  { name: "WebGPU", href: "https://www.webgpu.com/showcase/git-city-github-3d-pixel-skyline/" },
];

export const COPY = {
  en: {
    meta: {
      title: "Partners - Git City",
      description:
        "Put your brand in the city developers built. 87,600 GitHub developers live here as buildings.",
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
    proof: {
      stats: [
        { value: "50,900", label: "developers signed in with GitHub" },
        { value: "87,600", label: "developers in the city" },
        { value: "5,800", label: "stars on GitHub" },
        { value: "1.5M+", label: "views on creator videos" },
      ],
      seenIn: "Featured in",
    },
    social: {
      carouselLabel: "Posts about Git City",
      pick: "Pick a post",
      open: "Open on",
      prev: "Previous post",
      next: "Next post",
      slides: [
        {
          source: "GitHub · official account",
          big: "2.7M followers",
          quote: "Have you visited Git City yet?",
          detail: "The home of 180M+ developers shared Git City in April 2026",
          imageAlt: "GitHub's post about Git City on Instagram",
        },
        {
          source: "Paras Madan · creator",
          big: "1.5M views",
          quote: "Every developer owns a skyscraper.",
          detail: "90.7K likes and 9.2K comments on Instagram",
          cta: "Watch the reel",
          imageAlt: "Paras Madan's Instagram reel about Git City",
        },
        {
          source: "Om Patel · @om_patel5",
          big: "467K views",
          quote: "Someone vibe coded a 3D city where every GitHub developer is a building.",
          detail: "6.8K likes · 1.4K bookmarks · 362 reposts · 164 replies",
          cta: "See the post",
          imageAlt: "Om Patel's post about Git City on X",
        },
        {
          source: "Tyler Shukert · @dshukertjr",
          big: "12.9K views",
          quote: "One of the most visually stunning apps that I have come across.",
          detail: "Developer relations at Supabase, the backend Git City runs on",
          cta: "See the post",
          imageAlt: "Tyler Shukert's post about Git City on X",
        },
      ],
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
      description:
        "Coloque sua marca na cidade que os devs construíram. 87.600 devs do GitHub vivem aqui como prédios.",
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
    proof: {
      stats: [
        { value: "50.900", label: "devs logados com GitHub" },
        { value: "87.600", label: "devs na cidade" },
        { value: "5.800", label: "stars no GitHub" },
        { value: "1,5M+", label: "views em vídeos de creators" },
      ],
      seenIn: "Na imprensa",
    },
    social: {
      carouselLabel: "Posts sobre o Git City",
      pick: "Escolha um post",
      open: "Abrir no",
      prev: "Post anterior",
      next: "Próximo post",
      slides: [
        {
          source: "GitHub · conta oficial",
          big: "2,7 mi de seguidores",
          quote: "Have you visited Git City yet?",
          detail: "A casa de 180 mi+ de devs compartilhou o Git City em abril de 2026",
          imageAlt: "Post do GitHub sobre o Git City no Instagram",
        },
        {
          source: "Paras Madan · creator",
          big: "1,5 mi de views",
          quote: "Every developer owns a skyscraper.",
          detail: "90,7 mil curtidas e 9,2 mil comentários no Instagram",
          cta: "Ver o reel",
          imageAlt: "Reel do Paras Madan sobre o Git City no Instagram",
        },
        {
          source: "Om Patel · @om_patel5",
          big: "467 mil views",
          quote: "Someone vibe coded a 3D city where every GitHub developer is a building.",
          detail: "6,8 mil curtidas · 1,4 mil salvos · 362 reposts · 164 respostas",
          cta: "Ver o post",
          imageAlt: "Post do Om Patel sobre o Git City no X",
        },
        {
          source: "Tyler Shukert · @dshukertjr",
          big: "12,9 mil views",
          quote: "One of the most visually stunning apps that I have come across.",
          detail: "DevRel da Supabase, o backend onde o Git City roda",
          cta: "Ver o post",
          imageAlt: "Post do Tyler Shukert sobre o Git City no X",
        },
      ],
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
