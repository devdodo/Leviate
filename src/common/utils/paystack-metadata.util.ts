/**
 * Paystack returns metadata as a flat object, JSON string, or custom_fields array depending on API version/channel.
 */
export function parsePaystackMetadata(raw: unknown): Record<string, string> {
  if (raw == null) {
    return {};
  }

  let obj: Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  } else if (typeof raw === 'object') {
    obj = raw as Record<string, unknown>;
  } else {
    return {};
  }

  if (typeof obj.taskId === 'string' || typeof obj.userId === 'string') {
    return stringifyMetadataValues(obj);
  }

  const customFields = obj.custom_fields;
  if (Array.isArray(customFields)) {
    const out: Record<string, string> = {};
    for (const field of customFields) {
      if (!field || typeof field !== 'object') continue;
      const entry = field as Record<string, unknown>;
      const key =
        (typeof entry.variable_name === 'string' && entry.variable_name) ||
        (typeof entry.display_name === 'string' && entry.display_name);
      if (key && entry.value != null) {
        out[key] = String(entry.value);
      }
    }
    return out;
  }

  return stringifyMetadataValues(obj);
}

function stringifyMetadataValues(obj: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value != null && typeof value !== 'object') {
      out[key] = String(value);
    }
  }
  return out;
}
