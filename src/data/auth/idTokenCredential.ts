/**
 * What a native sign-in sheet hands back: the provider's ID token and, where the provider binds
 * one into the token, the raw nonce Supabase needs to verify that binding.
 */
export type IdTokenCredential = { token: string; nonce?: string };
