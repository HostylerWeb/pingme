export enum UserStatus {
  Active = 'active',
  Suspended = 'suspended',
  Deleted = 'deleted',
  PendingVerification = 'pending_verification',
}

export enum AuthProvider {
  Email = 'email',
  Phone = 'phone',
  Google = 'google',
  Apple = 'apple',
}

export enum AvatarType {
  Photo = 'photo',
  Generated = 'generated',
}

export enum SubscriptionPlan {
  Free = 'free',
  Premium = 'premium',
}

export enum SubscriptionStatus {
  Active = 'active',
  Cancelled = 'cancelled',
  PastDue = 'past_due',
  Trialing = 'trialing',
}

export enum PaymentProvider {
  Manual = 'manual',
  Stripe = 'stripe',
  Paddle = 'paddle',
  Revenuecat = 'revenuecat',
}
