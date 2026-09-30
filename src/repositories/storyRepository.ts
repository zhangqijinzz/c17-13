import { createStarterStory, type StoryDocument } from '../models/story';
import { sanitizeStory } from '../models/storyRules';
import type { StorageService } from '../services/storageService';

export interface StoryRepository {
  load(): StoryDocument;
  save(story: StoryDocument): boolean;
}

export class LocalStoryRepository implements StoryRepository {
  constructor(private readonly storage: StorageService) {}

  load(): StoryDocument {
    const raw = this.storage.read();
    if (!raw) return createStarterStory();
    try {
      return sanitizeStory(JSON.parse(raw)) ?? createStarterStory();
    } catch {
      return createStarterStory();
    }
  }

  save(story: StoryDocument): boolean {
    return this.storage.write(JSON.stringify(story));
  }
}
