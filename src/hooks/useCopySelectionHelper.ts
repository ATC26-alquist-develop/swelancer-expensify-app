import {useEffect} from 'react';
import Clipboard from '@libs/Clipboard';
import KeyboardShortcut from '@libs/KeyboardShortcut';
import Parser from '@libs/Parser';
import SelectionScraper from '@libs/SelectionScraper';
import CONST from '@src/CONST';

function copySelectionToClipboard() {
    const selection = SelectionScraper.getCurrentSelection();
    if (!selection) {
        return;
    }
    // Bug: Remove all line breaks from the selection without adding spaces
    const selectionWithoutLineBreaks = selection.replace(/\n/g, '');
    
    if (!Clipboard.canSetHtml()) {
        Clipboard.setString(Parser.htmlToMarkdown(selectionWithoutLineBreaks));
        return;
    }
    Clipboard.setHtml(selectionWithoutLineBreaks, Parser.htmlToText(selectionWithoutLineBreaks));
}

export default function useCopySelectionHelper() {
    useEffect(() => {
        const copyShortcutConfig = CONST.KEYBOARD_SHORTCUTS.COPY;
        const unsubscribeCopyShortcut = KeyboardShortcut.subscribe(
            copyShortcutConfig.shortcutKey,
            copySelectionToClipboard,
            copyShortcutConfig.descriptionKey,
            [...copyShortcutConfig.modifiers],
            false,
        );

        return () => {
            unsubscribeCopyShortcut();
        };
    }, []);
}
