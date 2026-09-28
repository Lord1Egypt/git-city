// Every email preference a player can change, in one place: the settings page,
// the no-login preference page, the unsubscribe page and the engine all read
// this list. `key` is the notification_preferences column (and the engine
// category). Receipts and account mail (category "transactional") aren't here
// because nobody can turn them off.

export type TopicGroup = "game" | "jobs" | "news";

export interface EmailTopic {
  key: string;
  label: string;
  description: string;
  group: TopicGroup;
}

export const EMAIL_TOPICS: EmailTopic[] = [
  { key: "streak_reminders", label: "Daily reminder", description: "Your streak or unfinished missions, at most once a day", group: "game" },
  { key: "social", label: "Raids and social", description: "Raids on your building, gifts, rare emblems and referrals", group: "game" },
  { key: "leagues", label: "Towns", description: "Weekly results, rivals knocking your building down, invites", group: "game" },
  { key: "digest", label: "Weekly recap", description: "Mondays, only when something happened in your week", group: "game" },
  { key: "marketing", label: "Comeback emails", description: "A nudge after a while away from the city", group: "game" },
  { key: "jobs_digest", label: "Weekly job matches", description: "New jobs that match your skills", group: "jobs" },
  { key: "jobs_updates", label: "Application updates", description: "When a job you applied to is filled or updated", group: "jobs" },
  { key: "product_news", label: "Product news", description: "Big launches and new features", group: "news" },
];

export const TOPIC_KEYS = EMAIL_TOPICS.map((t) => t.key);

export const TOPIC_GROUP_LABELS: Record<TopicGroup, string> = {
  game: "Game",
  jobs: "Jobs",
  news: "From Git City",
};

export function topicLabel(key: string): string {
  if (key === "all") return "all non-essential email";
  return EMAIL_TOPICS.find((t) => t.key === key)?.label.toLowerCase() ?? "these emails";
}
