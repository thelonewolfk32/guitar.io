# V1.4.42 validation

The reported `AMFIUnserializeXML: syntax error near line 1` places the failure at signing-entitlement parsing, before app replacement. The previous generic approval prompt closed the old app even on an ordinary signing failure. Source XML and packaged byte copies are valid under the general XML/ASAR reader; the reported Mac failure needs the stricter native signing path checked.

Validation targets: regression suite, TypeScript, production build, Mac controller failure/ready ordering, native macOS 15 and 26 packaged Electron updater execution, canonical entitlement signing and signature verification, old-app/profile preservation on invalid entitlements, rollback retention/activation and staging cleanup. Native tests use disposable profiles. Interactive Mac Gatekeeper/GUI relaunch remains a MacBook check.

Passed locally: TypeScript, production build, all 136 regression tests, shell syntax, and the focused Mac-controller/Windows-installer regression checks after the final installer changes. The controller test verifies specific handshake errors win over generic exit codes, failed signing does not request app quit, and the helper is launched detached without Terminal.
