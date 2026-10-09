export interface LoginHistoryEntry {
  id?: number;
  userId: number;
  device: string;
  location: string;
  ipAddress: string;
  loginTime?: Date;
}

export abstract class LoginHistoryRepository {
  abstract record(entry: LoginHistoryEntry): Promise<void>;
  abstract findRecent(userId: number, limit: number): Promise<LoginHistoryEntry[]>;
}
