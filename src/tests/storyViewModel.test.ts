import { describe, expect, it, vi } from 'vitest';
import { createStarterStory } from '../models/story';
import { LocalStoryRepository } from '../repositories/storyRepository';
import { MemoryStorageService } from '../services/storageService';
import { StoryViewModel } from '../viewmodels/storyViewModel';

describe('story view model', () => {
  it('initializes, edits, persists, and restores the main flow', () => {
    const repository = new LocalStoryRepository(new MemoryStorageService());
    const viewModel = new StoryViewModel(repository);
    viewModel.initialize();
    expect(viewModel.snapshot.status).toBe('ready');
    viewModel.addCharacter('阿洛', '修复师');
    viewModel.addScene('地下档案室', '他们找到被隐藏的航海日志。');
    const scene = viewModel.selectedScene;
    expect(scene?.title).toBe('地下档案室');
    viewModel.toggleCharacter(scene?.id ?? '', viewModel.snapshot.story?.characters[2]?.id ?? '');
    expect(viewModel.snapshot.stats.characters).toBe(3);

    const restored = new StoryViewModel(repository);
    restored.initialize();
    expect(restored.snapshot.story?.scenes.some((item) => item.title === '地下档案室')).toBe(true);
    expect(restored.snapshot.story?.characters.some((item) => item.name === '阿洛')).toBe(true);
  });

  it('shows recoverable validation feedback and resets corrupt storage', () => {
    const storage = new MemoryStorageService();
    storage.write('{broken');
    const viewModel = new StoryViewModel(new LocalStoryRepository(storage));
    viewModel.initialize();
    viewModel.addCharacter(' ', '');
    expect(viewModel.snapshot.notice).toContain('至少');
    viewModel.resetProject();
    expect(viewModel.snapshot.story?.id).toBe(createStarterStory().id);
  });

  it('surfaces save failures, keeps edits, and recovers after a successful write', () => {
    const storage = new MemoryStorageService();
    const viewModel = new StoryViewModel(new LocalStoryRepository(storage));
    viewModel.initialize();
    expect(viewModel.snapshot.saveState).toBe('saved');

    const failingWrite = vi.spyOn(storage, 'write').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    viewModel.addCharacter('阿洛', '修复师');
    expect(viewModel.snapshot.saveState).toBe('saveFailed');
    expect(viewModel.snapshot.error).toContain('保存失败');
    expect(viewModel.snapshot.story?.characters.some((character) => character.name === '阿洛')).toBe(true);

    viewModel.addScene('地下档案室', '他们找到被隐藏的航海日志。');
    expect(viewModel.snapshot.saveState).toBe('saveFailed');
    expect(viewModel.snapshot.error).toContain('保存失败');

    failingWrite.mockRestore();
    viewModel.addClue('罗盘上的刻痕', viewModel.snapshot.story?.scenes[0]?.id ?? '', '');
    expect(viewModel.snapshot.saveState).toBe('saved');
    expect(viewModel.snapshot.error).toBe('');
  });

  it('reports reset and complete failures through the same save state and supports retry', () => {
    const storage = new MemoryStorageService();
    const viewModel = new StoryViewModel(new LocalStoryRepository(storage));
    viewModel.initialize();

    const failingWrite = vi.spyOn(storage, 'write').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    viewModel.completeProject();
    expect(viewModel.snapshot.saveState).toBe('saveFailed');
    expect(viewModel.snapshot.error).toContain('保存失败');
    expect(viewModel.snapshot.notice).toBe('');

    viewModel.resetProject();
    expect(viewModel.snapshot.saveState).toBe('saveFailed');
    expect(viewModel.snapshot.error).toContain('保存失败');
    expect(viewModel.snapshot.notice).toBe('');
    expect(viewModel.snapshot.story?.id).toBe(createStarterStory().id);

    failingWrite.mockRestore();
    viewModel.retrySave();
    expect(viewModel.snapshot.saveState).toBe('saved');
    expect(viewModel.snapshot.error).toBe('');
  });
});
