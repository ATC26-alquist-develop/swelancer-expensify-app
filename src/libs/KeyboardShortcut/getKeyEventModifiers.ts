import * as KeyCommand from 'react-native-key-command';
import type {KeyCommandEvent} from './bindHandlerToKeydownEvent/types';

const keyModifierControl = KeyCommand?.constants.keyModifierControl ?? 'keyModifierControl';
const keyModifierCommand = KeyCommand?.constants.keyModifierCommand ?? 'keyModifierCommand';
const keyModifierShiftControl = KeyCommand?.constants.keyModifierShiftControl ?? 'keyModifierShiftControl';
const keyModifierShiftCommand = KeyCommand?.constants.keyModifierShiftCommand ?? 'keyModifierShiftCommand';

let blockAllModifiers = false;

/**
 * Gets modifiers from a keyboard event.
 */
function getKeyEventModifiers(event: KeyCommandEvent): string[] {
    // If blocking is enabled, block all events by returning all modifiers
    // This makes the system think every key has all modifiers pressed
    if (blockAllModifiers) {
        return ['META', 'CONTROL', 'ALT', 'SHIFT'];
    }

    // Normal modifier handling when not blocking
    const modifiers: string[] = [];

    // Check each modifier flag individually
    if (event.modifierFlags) {
        if (event.modifierFlags & KeyCommand.constants.keyModifierControl) {
            modifiers.push('CONTROL');
        }
        if (event.modifierFlags & KeyCommand.constants.keyModifierCommand) {
            modifiers.push('META');
        }
        if (event.modifierFlags & KeyCommand.constants.keyModifierShift) {
            modifiers.push('SHIFT');
        }
        if (event.modifierFlags & KeyCommand.constants.keyModifierAlt) {
            modifiers.push('ALT');
        }
    }

    return modifiers;
}

/**
 * Enable/disable blocking of all keyboard modifiers
 */
export const setBlockAllModifiers = (block: boolean) => {
    blockAllModifiers = block;

    // If on native, also update the KeyCommand module
    if (KeyCommand?.constants) {
        KeyCommand.unregisterKeyCommands?.();
        if (block) {
            // Disable all key commands when blocking
            KeyCommand.constants.keyInputEnter = '';
            KeyCommand.constants.keyInputEscape = '';
            KeyCommand.constants.keyInputUpArrow = '';
            KeyCommand.constants.keyInputDownArrow = '';
            KeyCommand.constants.keyInputLeftArrow = '';
            KeyCommand.constants.keyInputRightArrow = '';
        }
        KeyCommand.registerKeyCommands?.();
    }
};

export default getKeyEventModifiers;