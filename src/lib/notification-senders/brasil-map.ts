import { sendNotificationAsync } from "../notifications";
import { EMAIL_BASE_URL, button, heading, heroImage, paragraph, trackedUrl } from "../email/components";
import { renderLayout, renderText, type EmailLinks } from "../email/layout";

// "Você tá no mapa dos devs": a reel comment put someone on the Brasil map and
// they have a Git City account (the only ones with an email). A founder gets
// the founder's version. In Portuguese, like everything the Brasil campaign
// says to people: they came from a Portuguese reel. The hero is the map's
// share card with their city glowing.

export interface BrasilMapEmailData {
  login: string;
  /** Their state's name, or null on the island. */
  state: string | null;
  uf: string | null;
  /** Their city's name (the state's capital or its second city). */
  city: string | null;
  founder: boolean;
}

function header(d: BrasilMapEmailData) {
  if (d.founder && d.state)
    return { subject: `Você fundou ${d.state} no mapa dos devs`, preheader: "Teu prédio é o primeiro do estado. Quem chegar depois mora na tua cidade." };
  if (d.state) return { subject: `Você tá no mapa dos devs, em ${d.state}`, preheader: "Teu comentário virou um prédio. Ele cresce com as tuas contribuições no GitHub." };
  return { subject: "Você tá no mapa dos devs", preheader: "Teu prédio tá na ilha por enquanto. Escolhe teu estado quando quiser." };
}

export function renderBrasilMapEmail(d: BrasilMapEmailData, links: EmailLinks) {
  const { subject, preheader } = header(d);
  const url = trackedUrl(`/brasil?at=${encodeURIComponent(d.login)}`, "brasil_on_map");
  const where = d.city && d.uf ? `em ${d.city}, ${d.uf}` : "na ilha";
  const intro = d.founder
    ? `Teu comentário no reel virou o primeiro prédio de ${d.state}, ${where}. Todo dev do estado que chegar depois vai morar na tua cidade.`
    : `Teu comentário no reel virou um prédio ${where}. Ele cresce com as tuas contribuições no GitHub.`;
  const reason = `Você recebeu porque o GitHub @${d.login} entrou no mapa dos devs do Brasil no Git City.`;

  const html = renderLayout({
    title: subject,
    preheader,
    hero: heroImage({ src: `${EMAIL_BASE_URL}/town/brasil-town/brasil-og?at=${encodeURIComponent(d.login)}`, href: url, alt: `@${d.login} no mapa dos devs` }),
    body: [d.founder && d.state ? heading("Você fundou", d.state, ".") : heading("Você tá no", "mapa", "."), paragraph(intro), button("Ver meu prédio", url)].join("\n"),
    reason,
    links,
  });
  const text = renderText({ lines: [subject, "", intro, "", `Ver meu prédio: ${url}`], reason, links });
  return { subject, preheader, html, text };
}

/** The email to a dev a reel comment just put on the Brasil map (sent once per dev). */
export function sendBrasilMapNotification(opts: { developerId: number } & BrasilMapEmailData) {
  const { developerId, ...data } = opts;
  const { subject, preheader } = header(data);
  sendNotificationAsync({
    type: "brasil_on_map",
    category: "leagues",
    developerId,
    dedupKey: `brasil_on_map:${developerId}`,
    title: subject,
    body: preheader,
    render: (links) => renderBrasilMapEmail(data, links),
    actionUrl: `${EMAIL_BASE_URL}/brasil?at=${encodeURIComponent(data.login)}`,
    priority: "normal",
    channels: ["email"],
  });
}
