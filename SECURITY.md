## Security Policy

**Project:** [formul.ai](https://github.com/opendexcom/formul.ai)  
**Status:** Early development (`0.x.x`)  
**License:** AGPL-3.0

---

### Supported Versions

The formul.ai project is under active development and currently in pre-release (`0.x.x`) stage. Security support is provided only for the latest commit on the `main` branch.

| Version | Supported |
|---------|-----------|
| `0.x.x` | ✅ Yes (main branch only) |
| `<0.x.x` | ❌ No |

---

### Reporting a Vulnerability

If you discover a vulnerability, please do not open a public GitHub issue. Instead, report it responsibly using one of the following methods:

- GitHub Security Advisories (preferred): [Create a confidential security advisory](https://github.com/opendexcom/formul.ai/security/advisories/new)

We aim to respond within 5 business days and will coordinate a fix and release schedule with you.

---

### Scope of Security Review

At this stage of development, we are focusing on the following:

- Authentication and authorization mechanisms (including JWT with RS256)
- Data integrity and confidentiality during form processing
- Avoidance of injection and SSRF vulnerabilities
- Proper validation and sanitization of user inputs
- Secure default configurations in Docker/Nginx deployments

---

### Out of Scope (for now)

Until formul.ai reaches a stable `1.0` release, the following are not guaranteed to be secure:

- Third-party integrations or plugins
- Backward compatibility with older schema formats
- Any self-hosted deployment scenario not using our official Docker images

---

### Responsible Disclosure Timeline

- Acknowledgement: within 5 business days  
- Fix: typically within 30 days, depending on severity  
- Disclosure: coordinated with the reporter once a fix is released

---

### Acknowledgements

We appreciate and recognize the efforts of the community in making formul.ai a safer tool. All confirmed reporters will be credited in our security disclosures unless anonymity is requested.
