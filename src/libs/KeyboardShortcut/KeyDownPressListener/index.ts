import type {AddKeyDownPressListener, RemoveKeyDownPressListener} from './types';
import {setBlockAllModifiers} from '../getKeyEventModifiers';

let isMessaging = false;
let messageHandler: ((event: KeyboardEvent) => void) | null = null;

const blockEvent = (event: KeyboardEvent) => {
    // Stop the event in its tracks
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    
    // Cancel any pending composition
    if (event.target instanceof HTMLElement) {
        const input = event.target as HTMLInputElement;
        if (input.isContentEditable || input.tagName === 'INPUT' || input.tagName === 'TEXTAREA') {
            input.blur();
        }
    }
    
    return false;
};

const messageInputHandler = (event: KeyboardEvent) => {
    if (!isMessaging) return;

    // Block ALL keyboard events during messaging except basic text input
    const key = event.key.toLowerCase();
    
    // Always block any modifier key combinations
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
        return blockEvent(event);
    }

    // Only allow basic text input characters and essential editing keys
    const allowedKeys = [
        'backspace',
        'delete',
        'arrowleft',
        'arrowright',
        'enter'
    ];

    if (!allowedKeys.includes(key) && 
        !/^[a-zA-Z0-9\s.,!?]$/.test(key)) {
        return blockEvent(event);
    }

    // Block all other keys
    if (event.code.startsWith('F') || // Function keys
        event.code === 'Escape' ||
        event.code === 'Tab' ||
        event.code === 'CapsLock' ||
        event.code === 'PageUp' ||
        event.code === 'PageDown' ||
        event.code === 'Home' ||
        event.code === 'End' ||
        event.code === 'Insert' ||
        event.code === 'NumLock' ||
        event.code === 'ScrollLock' ||
        event.code === 'Pause' ||
        event.code === 'ContextMenu') {
        return blockEvent(event);
    }
};

// Capture phase listener to block events before they reach other handlers
const addKeyDownPressListener: AddKeyDownPressListener = (callbackFunction) => {
    document.addEventListener('keydown', callbackFunction, { 
        capture: true, 
        passive: false 
    });
};

const removeKeyDownPressListener: RemoveKeyDownPressListener = (callbackFunction) => {
    document.removeEventListener('keydown', callbackFunction, { 
        capture: true 
    });
};

// Function to enable/disable message mode
export const setMessageMode = (messaging: boolean) => {
    isMessaging = messaging;
    
    // Enable/disable global modifier blocking
    setBlockAllModifiers(isMessaging);
    
    // Clean up existing handler
    if (messageHandler) {
        document.removeEventListener('keydown', messageHandler, { capture: true });
        document.removeEventListener('keyup', blockEvent, { capture: true });
        messageHandler = null;
    }
    
    // Set up new handler if messaging is enabled
    if (isMessaging) {
        messageHandler = messageInputHandler;
        // Use capture phase to intercept events before they reach other handlers
        document.addEventListener('keydown', messageHandler, { 
            capture: true, 
            passive: false 
        });
        
        // Also block keyup events to prevent any keyup-based shortcuts
        document.addEventListener('keyup', blockEvent, { 
            capture: true, 
            passive: false 
        });
    }
};

export {addKeyDownPressListener, removeKeyDownPressListener};