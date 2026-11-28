export class InputError extends Error {}

export interface ProfilePatch {
  displayName?: string;
  username?: string;
  preferredFoot?: 'left' | 'right' | 'both';
  preferredPositions?: string[];
  shirtNumber?: number | null;
  bio?: string;
}

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new InputError('Expected an object.');
  return value as Record<string, unknown>;
}

export function textField(value: unknown, min: number, max: number): string {
  if (typeof value !== 'string') throw new InputError('Expected text.');
  const text = value.trim().normalize('NFC');
  if (text.length < min || text.length > max || /[\u0000-\u001f\u007f]/u.test(text)) throw new InputError('Invalid text.');
  return text;
}

export function parseProfilePatch(value: unknown): ProfilePatch {
  const patch: ProfilePatch = {};
  const entries = Object.entries(record(value));
  if (!entries.length) throw new InputError('Choose a field to update.');
  for (const [key, raw] of entries) {
    switch (key) {
      case 'displayName': patch.displayName = textField(raw, 1, 80); break;
      case 'username': {
        const name = textField(raw, 3, 30).toLowerCase();
        if (!/^[a-z0-9_]+$/.test(name)) throw new InputError('Use letters, numbers or underscores for the Player ID.');
        patch.username = name;
        break;
      }
      case 'preferredFoot':
        if (raw !== 'left' && raw !== 'right' && raw !== 'both') throw new InputError('Invalid preferred foot.');
        patch.preferredFoot = raw;
        break;
      case 'preferredPositions':
        if (!Array.isArray(raw) || raw.length > 5) throw new InputError('Invalid positions.');
        patch.preferredPositions = [...new Set(raw.map(position => textField(position, 1, 24)))];
        break;
      case 'shirtNumber':
        if (raw !== null && (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 1 || raw > 99)) throw new InputError('Invalid shirt number.');
        patch.shirtNumber = raw;
        break;
      case 'bio': patch.bio = textField(raw, 0, 400); break;
      default: throw new InputError('Unsupported profile field.');
    }
  }
  return patch;
}
