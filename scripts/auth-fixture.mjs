// Only imported by local checks and the loopback preview, never by the Worker.
export const fixtureCookie = id => '__Host-gh-access=fixture-' + encodeURIComponent(id);
export const fixtureAuth = {
  SUPABASE_URL: 'https://fixture.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'test-only-public-key',
  AUTH_PROVIDERS: 'google',
  AUTH_FETCH: async (url, options) => {
    const token = options.headers.authorization || '';
    if (url !== 'https://fixture.supabase.co/auth/v1/user' || !token.startsWith('Bearer fixture-')) {
      return Response.json({error_code:'bad_jwt'}, {status:401});
    }
    const id = decodeURIComponent(token.slice('Bearer fixture-'.length));
    return Response.json({id, email: id + '@example.test', email_confirmed_at: 'verified', user_metadata: {full_name:id}});
  }
};
