import { Schema, model, Document } from 'mongoose';

export interface TokenBlacklistDoc extends Document {
  token: string;
  expiresAt: Date;
}

const tokenBlacklistSchema = new Schema<TokenBlacklistDoc>(
  {
    token: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
  },
  { collection: 'token_blacklist' }
);

tokenBlacklistSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const TokenBlacklist = model<TokenBlacklistDoc>('TokenBlacklist', tokenBlacklistSchema);
