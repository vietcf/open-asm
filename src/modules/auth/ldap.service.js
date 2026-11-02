import ldap from 'ldapjs';

const LDAP_URL = process.env.LDAP_URL;
const LDAP_DOMAIN = process.env.LDAP_DOMAIN;
const LDAP_TIMEOUT_MS = parseInt(process.env.LDAP_TIMEOUT_MS, 10) || 5000;
const LDAP_TLS_REJECT_UNAUTHORIZED = process.env.LDAP_TLS_REJECT_UNAUTHORIZED !== 'false';

// Thrown when the AD/LDAP server itself can't be reached in time — distinct
// from a plain wrong-password result so the login page can tell the user
// "try again later" instead of "check your password".
export class LdapUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LdapUnavailableError';
  }
}

// Direct-bind auth against Active Directory: no service account/search step.
// Pre-created app users are matched to AD by sAMAccountName === app username,
// so binding as `${username}@${LDAP_DOMAIN}` (UPN) with the given password is
// sufficient proof of identity — a successful bind is the only thing checked.
export function authenticateLdap(username, password) {
  if (process.env.LDAP_ENABLED !== 'true') {
    return Promise.reject(new LdapUnavailableError('LDAP authentication is not enabled on this server'));
  }
  // Defense in depth: per RFC 4513, binding with a real DN/UPN but an empty
  // password is an "unauthenticated bind" — AD (and most LDAP servers)
  // return success without checking the password at all. The caller already
  // rejects empty passwords before reaching here, but that must never be the
  // only thing standing between an attacker and logging in as any LDAP user.
  if (!password) {
    return Promise.resolve(false);
  }
  return new Promise((resolve, reject) => {
    const client = ldap.createClient({
      url: LDAP_URL,
      timeout: LDAP_TIMEOUT_MS,
      connectTimeout: LDAP_TIMEOUT_MS,
      tlsOptions: { rejectUnauthorized: LDAP_TLS_REJECT_UNAUTHORIZED }
    });

    let settled = false;
    const finish = (fn, arg) => {
      if (settled) return;
      settled = true;
      // client.destroy() marks the client as destroyed so any in-flight
      // connect-retry callback (ldapjs retries the initial connection via
      // an internal backoff loop even without `reconnect` configured)
      // becomes a no-op instead of emitting a late 'error'. Keeping a
      // permanent no-op 'error' listener is a second line of defense —
      // Node treats an 'error' event with zero listeners as a fatal,
      // process-crashing exception, and a stray async error here would
      // otherwise take down the whole app, not just this request.
      client.removeAllListeners('error');
      client.removeAllListeners('connectTimeout');
      client.on('error', () => {});
      client.unbind(() => {});
      client.destroy();
      fn(arg);
    };

    client.on('error', (err) => {
      finish(reject, new LdapUnavailableError(`LDAP server unavailable: ${err.message}`));
    });

    client.on('connectTimeout', (err) => {
      finish(reject, new LdapUnavailableError(`LDAP server connection timed out: ${err ? err.message : ''}`));
    });

    const upn = `${username}@${LDAP_DOMAIN}`;
    client.bind(upn, password, (err) => {
      if (err) {
        if (err instanceof ldap.InvalidCredentialsError) {
          return finish(resolve, false);
        }
        return finish(reject, new LdapUnavailableError(`LDAP bind failed: ${err.message}`));
      }
      finish(resolve, true);
    });
  });
}
