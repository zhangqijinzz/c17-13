import { describe, expect, it } from 'vitest';
import { createStarterStory } from '../models/story';
import { LocalStoryRepository } from '../repositories/storyRepository';
import { MemoryStorageService, type StorageService } from '../services/storageService';
import { StoryViewModel } from '../viewmodels/storyViewModel';

/** 写入总是失败的存储，模拟空间不足 / 隐私模式。 */
class FailingStorageService implements StorageService {
  read(): string | null {
    return null;
  }
  write(): boolean {
    return false;
  }
}

/** 可在失败 / 正常之间切换的存储，用于验证“恢复后自动收回异常”。 */
class ToggleableStorageService implements StorageService {
  private value: string | null = null;
  constructor(private fail: boolean) {}
  setFail(fail: boolean): void {
    this.fail = fail;
  }
  read(): string | null {
    return this.value;
  }
  write(value: string): boolean {
    if (this.fail) return false;
    this.value = value;
    return true;
  }
}

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

  it('surfaces save failure instead of pretending the write succeeded', () => {
    const viewModel = new StoryViewModel(new LocalStoryRepository(new FailingStorageService()));
    viewModel.initialize();
    viewModel.addCharacter('阿洛', '修复师');
    expect(viewModel.snapshot.saveStatus).toBe('error');
    expect(viewModel.snapshot.error).not.toBe('');
    // 编辑内容仍保留在页面中，可继续操作
    expect(viewModel.snapshot.story?.characters.some((c) => c.name === '阿洛')).toBe(true);
  });

  it('clears the error on retry once storage recovers', () => {
    const storage = new ToggleableStorageService(true);
    const viewModel = new StoryViewModel(new LocalStoryRepository(storage));
    viewModel.initialize();
    viewModel.addCharacter('阿洛', '修复师');
    expect(viewModel.snapshot.saveStatus).toBe('error');

    storage.setFail(false);
    viewModel.retrySave();
    expect(viewModel.snapshot.saveStatus).toBe('saved');
    expect(viewModel.snapshot.error).toBe('');
  });

  it('clears the error automatically on any later successful write', () => {
    const storage = new ToggleableStorageService(true);
    const viewModel = new StoryViewModel(new LocalStoryRepository(storage));
    viewModel.initialize();
    viewModel.addCharacter('阿洛', '修复师');
    expect(viewModel.snapshot.saveStatus).toBe('error');

    storage.setFail(false);
    viewModel.addScene('地下档案室', '他们找到被隐藏的航海日志。');
    expect(viewModel.snapshot.saveStatus).toBe('saved');
    expect(viewModel.snapshot.error).toBe('');
  });

  it('does not silently reset when storage is failing', () => {
    const viewModel = new StoryViewModel(new LocalStoryRepository(new FailingStorageService()));
    viewModel.initialize();
    viewModel.addCharacter('阿洛', '修复师');
    const storyBeforeReset = viewModel.snapshot.story;
    viewModel.resetProject();
    // 失败时不覆盖当前编辑，也不假装已恢复
    expect(viewModel.snapshot.story).toBe(storyBeforeReset);
    expect(viewModel.snapshot.saveStatus).toBe('error');
    expect(viewModel.snapshot.notice).not.toContain('已恢复示例项目');
  });

  it('does not show a success notice when completing while storage is failing', () => {
    const viewModel = new StoryViewModel(new LocalStoryRepository(new FailingStorageService()));
    viewModel.initialize();
    viewModel.completeProject();
    expect(viewModel.snapshot.saveStatus).toBe('error');
    expect(viewModel.snapshot.notice).not.toContain('项目已标记为完成');
  });
});
