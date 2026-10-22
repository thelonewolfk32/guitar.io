import 'react-native-url-polyfill/auto';
import 'fast-text-encoding';
import {install,Buffer} from 'react-native-quick-crypto';
install();
// Supabase PKCE uses WebCrypto + UTF-8. Never fall back to a plain verifier.
if(!global.crypto?.subtle?.digest||!global.TextEncoder)throw Error('Native authentication cryptography is unavailable. Rebuild with CocoaPods.');
if(!global.btoa)global.btoa=value=>Buffer.from(value,'binary').toString('base64');
if(!global.atob)global.atob=value=>Buffer.from(value,'base64').toString('binary');
