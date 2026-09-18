import type { MessageKey } from "@/i18n/types";
import type vi from "@/i18n/locales/vi";

type CatalogKey = MessageKey<typeof vi>;
type Translate = (key: CatalogKey) => string;

const QUICK_PROMPT_MESSAGE_KEYS: Record<string, CatalogKey> = {
  Popular: "chat.quickPrompts.popular",
  "Add Data": "chat.quickPrompts.addData",
  "Add Visuals": "chat.quickPrompts.addVisuals",
  Structure: "chat.quickPrompts.structure",
  "Refine Content": "chat.quickPrompts.refine",
  "Generate a full presentation from my topic": "chat.quickPrompts.generateFull",
  "Improve this slide content": "chat.quickPrompts.improveContent",
  "Rewrite this content professionally": "chat.quickPrompts.rewriteProfessional",
  "Add speaker notes to this slide": "chat.quickPrompts.addSpeakerNotes",
  "Expand outline": "chat.quickPrompts.expandOutline",
  "Expand the outline": "chat.quickPrompts.expandOutline",
  "Shorten outline": "chat.quickPrompts.shortenOutline",
  "Make the outline shorter": "chat.quickPrompts.shortenOutline",
  "Reorder sections": "chat.quickPrompts.reorderSections",
  "Reorder the sections": "chat.quickPrompts.reorderSections",
  "Merge similar slides": "chat.quickPrompts.mergeSimilar",
  "Split large sections": "chat.quickPrompts.splitLarge",
  "Improve conclusion": "chat.quickPrompts.improveConclusion",
  "Improve the conclusion": "chat.quickPrompts.improveConclusion",
  "Improve introduction": "chat.quickPrompts.improveIntroduction",
  "Improve the introduction": "chat.quickPrompts.improveIntroduction",
  "Create an executive summary": "chat.quickPrompts.executiveSummary",
  "Strengthen the story flow": "chat.quickPrompts.storyFlow",
  "Add data and citations": "chat.quickPrompts.dataCitations",
  "Create speaker notes": "chat.quickPrompts.createSpeakerNotes",
  "Improve this slide's layout": "chat.quickPrompts.improveLayout",
  "Improve slide layout": "chat.quickPrompts.improveLayout",
  "Rewrite this slide for executives": "chat.quickPrompts.rewriteExecutives",
  "Rewrite for executives": "chat.quickPrompts.rewriteExecutives",
  "Add a supporting visual": "chat.quickPrompts.supportingVisual",
  "Make the deck visually consistent": "chat.quickPrompts.consistentDeck",
  "Make the deck consistent": "chat.quickPrompts.consistentDeck",
  "Add data and source citations": "chat.quickPrompts.sourceCitations",
  "Create speaker notes for this slide": "chat.quickPrompts.slideSpeakerNotes",
  "Make it shorter": "chat.quickPrompts.makeShorter",
  "Make this smaller": "chat.quickPrompts.makeSmaller",
  "Generate a new image and replace this one": "chat.quickPrompts.replaceImage",
  "Add a chart": "chat.quickPrompts.addChart",
  "Add a table": "chat.quickPrompts.addTable",
  "Make the outline concise": "chat.quickPrompts.conciseOutline",
};

export function localizeQuickPromptText(t: Translate, value: string) {
  const key = QUICK_PROMPT_MESSAGE_KEYS[value];
  return key ? t(key) : value;
}

export function localizeActivityLabelText(t: Translate, value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("could not") || normalized.includes("failed"))
    return t("chat.activity.failed");
  if (normalized.includes("planning") || normalized.includes("choosing"))
    return t("chat.activity.planning");
  if (normalized.includes("reading") || normalized.includes("reviewing"))
    return t("chat.activity.reading");
  if (normalized.includes("searching") || normalized.includes("looking"))
    return t("chat.activity.searching");
  if (normalized.includes("opening")) return t("chat.activity.opening");
  if (normalized.includes("checking") || normalized.includes("validating"))
    return t("chat.activity.checking");
  if (normalized.includes("generating") || normalized.includes("preparing visual"))
    return t("chat.activity.generating");
  if (normalized.includes("saving")) return t("chat.activity.saving");
  if (normalized.includes("applying") || normalized.includes("updating"))
    return t("chat.activity.applying");
  if (normalized.includes("deleting") || normalized.includes("removing"))
    return t("chat.activity.removing");
  if (
    normalized.includes("finished") ||
    normalized.includes("found") ||
    normalized.includes("applied") ||
    normalized.includes("updated") ||
    normalized.includes("prepared") ||
    normalized.includes("checked")
  )
    return t("chat.activity.completed");
  return value;
}
