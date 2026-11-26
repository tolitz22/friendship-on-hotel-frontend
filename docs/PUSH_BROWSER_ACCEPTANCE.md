# PN-8.7 Browser acceptance

The manifest supplies standalone home-screen metadata and a push-only worker (no offline cache). HTTPS and a configured public VAPID key are required. On iOS/iPadOS 16.4 or newer, install the PMS using Add to Home Screen, launch it from the icon, then opt in from a user gesture. Browser/OS support and actual push delivery must be checked on devices; the manifest alone is not certification of installability.

Client Demo only, after PN-9 transport setup:
- Chrome and Edge desktop, Firefox desktop, Chrome Android, iOS/iPadOS Home Screen: enable, receive while logged in, sign out, close app, receive and tap; sign in and confirm correct property/record.
- Deny or revoke OS/browser permission, remove the subscription remotely, clear local storage, change account, rotate the VAPID key: verify status and explicit repair. Never automatically re-enable a remotely revoked registration.
- Two hotels and two admins: verify no private messages or records cross accounts; same-account logout preserves opt-in.
- Update service worker while tabs are open; verify normal PMS navigation and no cache of private API data.
- Test iOS installation icon/standalone experience, native notification presentation, focus and background behavior. A closed or force-stopped browser/OS may defer delivery.
- Existing local registrations without an endpoint fingerprint require explicit repair; rotating one browser endpoint can require repairing registrations in its other properties. No anonymous resubscription occurs in the service worker.

Automated tests exercise destination sanitation, lifecycle, key mismatch and subscription-change signaling. They do not send live push or certify OS background behavior.
