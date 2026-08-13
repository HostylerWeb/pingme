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
