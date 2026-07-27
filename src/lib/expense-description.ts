const RELATED_EVENT_PREFIX = "[Compétition / déplacement] ";

export function serializeExpenseDescription(
  description: string,
  relatedEvent?: string,
) {
  const normalizedRelatedEvent = relatedEvent?.trim();

  if (!normalizedRelatedEvent) {
    return description.trim();
  }

  return `${RELATED_EVENT_PREFIX}${normalizedRelatedEvent}\n${description.trim()}`;
}

export function parseExpenseDescription(value: string) {
  if (!value.startsWith(RELATED_EVENT_PREFIX)) {
    return {
      description: value,
      relatedEvent: null,
    };
  }

  const separatorIndex = value.indexOf("\n");

  if (separatorIndex === -1) {
    return {
      description: "",
      relatedEvent: value.slice(RELATED_EVENT_PREFIX.length),
    };
  }

  return {
    description: value.slice(separatorIndex + 1),
    relatedEvent: value.slice(RELATED_EVENT_PREFIX.length, separatorIndex),
  };
}

