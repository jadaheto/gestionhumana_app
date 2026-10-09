export interface PasswordResetProps {
  id: number;
  email: string;
  token: string;
  expiresAt: Date;
  usedAt: Date | null;
}

export class PasswordReset {
  constructor(readonly props: PasswordResetProps) {}

  isValid(now: Date): boolean {
    return this.props.usedAt === null && this.props.expiresAt.getTime() > now.getTime();
  }
}
