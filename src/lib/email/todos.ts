// Email chores with a date, shown on /admin/emails so none depends on memory.
// Mark one done by setting `done` (and say when in the commit).

export interface EmailTodo {
  id: string;
  title: string;
  why: string;
  how: string;
  due: string; // YYYY-MM-DD
  done?: string; // YYYY-MM-DD it was done
}

export const EMAIL_TODOS: EmailTodo[] = [
  {
    id: "towns-launch-campaign",
    title: "Send the Towns launch campaign",
    why: "Launch day. Active players first, dormant ones get the permission email a week later.",
    how: "Campaigns tab: create towns-launch, send yourself a test, build with the start time, then start.",
    due: "2026-10-08",
  },
  {
    id: "dmarc-quarantine",
    title: "Raise DMARC to quarantine",
    why: "Stops others sending mail as thegitcity.com, and it's required for BIMI.",
    how: "Read ~2 weeks of DMARC reports (they arrive at samuel@thegitcity.com); if Resend and Google Workspace both pass, change _dmarc to p=quarantine in Cloudflare.",
    due: "2026-10-12",
  },
  {
    id: "bimi-record",
    title: "Publish the BIMI record",
    why: "Shows the Git City logo next to our emails in Yahoo and AOL (Gmail needs a certificate).",
    how: "After DMARC is on quarantine: host the logo as SVG Tiny-PS and add a default._bimi TXT record.",
    due: "2026-10-15",
  },
  {
    id: "towns-launch-sunset",
    title: "Sunset unconfirmed permission emails",
    why: "Dormant players who didn't click \"keep me posted\" stop getting product news, as the email promised.",
    how: "Campaigns tab: Sunset on towns-launch, 14 days after the last permission email went out.",
    due: "2026-10-29",
  },
  {
    id: "bimi-cmc",
    title: "Buy a CMC certificate for the Gmail logo",
    why: "Gmail shows brand logos only with a mark certificate; a CMC needs 12 months of public logo use.",
    how: "Buy a Common Mark Certificate (~US$650–990/yr), add it to the BIMI record's a= tag.",
    due: "2027-02-28",
  },
];
