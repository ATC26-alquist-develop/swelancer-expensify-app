import type {AddKeyDownPressListener, RemoveKeyDownPressListener} from './types';
import {NativeEventEmitter, NativeModules, Platform} from 'react-native';
import {setBlockAllModifiers} from '../getKeyEventModifiers';
import * as KeyCommand from 'react-native-key-command';

let isMessaging = false;
let subscription: any = null;

const keyCommandEmitter = new NativeEventEmitter(NativeModules.KeyCommandModule);

const handleKeyCommand = (event: any) => {
    if (!isMessaging) return false;

    // Block ALL keyboard shortcuts while in message mode
    return true; // Always return true to indicate we've handled (blocked) the event
};

const addKeyDownPressListener: AddKeyDownPressListener = (callbackFunction) => {
    return keyCommandEmitter.addListener('KeyCommand', callbackFunction);
};

const removeKeyDownPressListener: RemoveKeyDownPressListener = (callbackFunction) => {
    if (callbackFunction?.remove) {
        callbackFunction.remove();
    }
};

// Function to enable/disable message mode
export const setMessageMode = (messaging: boolean) => {
    isMessaging = messaging;

    // Enable/disable global modifier blocking
    setBlockAllModifiers(isMessaging);
    
    // Clean up existing subscription
    if (subscription) {
        subscription.remove();
        subscription = null;
    }
    
    // Set up new handler if messaging is enabled
    if (isMessaging) {
        // Unregister existing key commands
        KeyCommand.unregisterKeyCommands?.();
        
        // Add aggressive event blocking
        subscription = keyCommandEmitter.addListener('KeyCommand', handleKeyCommand);
        
        if (Platform.OS === 'ios') {
            // Enable aggressive keyboard command blocking on iOS
            NativeModules.KeyCommandModule?.setEnabled(true);
            NativeModules.KeyCommandModule?.blockAllKeyCommands?.(true);
        }
    } else {
        // Re-register key commands when not messaging
        KeyCommand.registerKeyCommands?.();
        
        if (Platform.OS === 'ios') {
            NativeModules.KeyCommandModule?.blockAllKeyCommands?.(false);
        }
    }
};

export {addKeyDownPressListener, removeKeyDownPressListener};