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
      client.removeAllListeners();
      client.unbind(() => {});
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
