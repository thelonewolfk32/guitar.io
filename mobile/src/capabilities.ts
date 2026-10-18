import {NativeModules} from 'react-native';
const native=NativeModules.GuitarPlatform;
export const capabilities={profile:native?.profile||'local',shareInbox:native?.shareInbox===true,appleSignIn:native?.appleSignIn===true,googleSignIn:native?.googleSignIn===true,purchases:native?.purchases===true};
