const STORAGE_KEY = 'story-architect.document.v1';

export interface StorageService {
  read(): string | null;
  /** 写入持久化数据，返回是否成功；空间不足、隐私模式等情况下返回 false。 */
  write(value: string): boolean;
}

export class BrowserStorageService implements StorageService {
  read(): string | null {
    return window.localStorage.getItem(STORAGE_KEY);
  }

  write(value: string): boolean {
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
      return true;
    } catch {
      return false;
    }
  }
}

export class MemoryStorageService implements StorageService {
  private value: string | null = null;

  read(): string | null {
    return this.value;
  }

  write(value: string): boolean {
    this.value = value;
    return true;
  }
}
