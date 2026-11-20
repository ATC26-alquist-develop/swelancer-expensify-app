import {useNavigation} from '@react-navigation/native';
import {useCallback, useEffect} from 'react';
import type UseHtmlPaste from './types';

type TextSegment = {text: string; bold: boolean};

const insertByCommand = (text: string) => {
    document.execCommand('insertText', false, text);
};

const insertAtCaret = (target: HTMLElement, text: string) => {
    const selection = window.getSelection();
    if (selection?.rangeCount) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const node = document.createTextNode(text);
        range.insertNode(node);

        // Move caret to the end of the newly inserted text node.
        range.setStart(node, node.length);
        range.setEnd(node, node.length);
        selection.setBaseAndExtent(range.startContainer, range.startOffset, range.endContainer, range.endOffset);

        // Dispatch input event to trigger Markdown Input to parse the new text
        target.dispatchEvent(new Event('input', {bubbles: true}));
    } else {
        insertByCommand(text);
    }
};

// Elements whose contents are never meant to be pasted as visible text
const IGNORED_PASTE_TAGS = new Set(['STYLE', 'SCRIPT', 'META', 'TITLE', 'HEAD']);

/**
 * Determines whether a CSS font-weight value means bold.
 * Google Docs wraps copied content in <b style="font-weight:normal">, so the tag alone is not a reliable signal.
 */
const isBoldFontWeight = (fontWeight: string): boolean => {
    const weight = fontWeight.trim().toLowerCase();
    if (weight === 'bold' || weight === 'bolder') {
        return true;
    }
    const numericWeight = Number(weight);
    return !Number.isNaN(numericWeight) && numericWeight >= 600;
};

/**
 * Reads an explicit font-weight from an element's inline style attribute, or undefined if none is set.
 */
const getInlineFontWeight = (element: Element): string | undefined => {
    const styleAttribute = element.getAttribute('style');
    if (!styleAttribute) {
        return undefined;
    }
    const match = styleAttribute.match(/(?:^|;)\s*font-weight\s*:\s*([^;]+)/i);
    const value = match?.[1]?.trim().toLowerCase();
    // inherit/unset/initial mean "no explicit override", so the parent's boldness should carry through
    if (!value || value === 'inherit' || value === 'unset' || value === 'initial') {
        return undefined;
    }
    return value;
};

/**
 * Recursively walks parsed HTML and collects text segments tagged with whether they are bold.
 * An explicit inline font-weight takes precedence over the B/STRONG tag; bold is inherited by children.
 */
const collectPastedSegments = (node: Node, isParentBold: boolean, segments: TextSegment[]) => {
    if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent ?? '';
        if (text) {
            segments.push({text, bold: isParentBold});
        }
        return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
        return;
    }

    const element = node as Element;
    if (IGNORED_PASTE_TAGS.has(element.tagName)) {
        return;
    }

    let isBold = isParentBold;
    const explicitFontWeight = getInlineFontWeight(element);
    if (explicitFontWeight !== undefined) {
        isBold = isBoldFontWeight(explicitFontWeight);
    } else if (element.tagName === 'B' || element.tagName === 'STRONG') {
        isBold = true;
    }

    element.childNodes.forEach((child) => collectPastedSegments(child, isBold, segments));
};

/**
 * Wraps a bold run in markdown asterisks. Leading/trailing whitespace stays outside the markers,
 * because markdown bold delimiters must not be adjacent to whitespace.
 */
const wrapBoldRun = (text: string): string => {
    const core = text.trim();
    if (!core) {
        return text;
    }
    // core starts at the first non-whitespace character, so the first occurrence is its true position
    const start = text.indexOf(core);
    const leading = text.slice(0, start);
    const trailing = text.slice(start + core.length);
    return `${leading}**${core}**${trailing}`;
};

/**
 * Converts pasted HTML into text where only genuinely bold runs are marked up with markdown bold.
 * The HTML is parsed with DOMParser (inert document: no scripts run and no resources load) and only text content is used.
 */
const convertPastedHtmlToMarkdown = (html: string): string => {
    const parsed = new DOMParser().parseFromString(html, 'text/html');

    const segments: TextSegment[] = [];
    collectPastedSegments(parsed.body, false, segments);

    // Merge adjacent segments with the same boldness so a bold run split across nodes becomes one **...** pair
    const merged: TextSegment[] = [];
    segments.forEach((segment) => {
        const last = merged.length > 0 ? merged[merged.length - 1] : undefined;
        if (last && last.bold === segment.bold) {
            last.text += segment.text;
        } else {
            merged.push({...segment});
        }
    });

    return merged.map((segment) => (segment.bold ? wrapBoldRun(segment.text) : segment.text)).join('');
};

const insertIntoTextInput = (textInputHTMLElement: HTMLElement, text: string) => {
    const selection = window.getSelection();
    if (selection?.rangeCount) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const textNode = document.createTextNode(text);
        range.insertNode(textNode);

        // Move cursor to end of inserted text
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        selection.removeAllRanges();
        selection.addRange(range);

        // Dispatch input event
        textInputHTMLElement.dispatchEvent(new Event('input', {bubbles: true}));
    }
};

const useHtmlPaste: UseHtmlPaste = (textInputRef, preHtmlPasteCallback, removeListenerOnScreenBlur = false) => {
    const navigation = useNavigation();

    /**
     * Set pasted text to clipboard
     * @param {String} text
     */
    const paste = useCallback((text: string) => {
        try {
            const textInputHTMLElement = textInputRef.current as HTMLElement;
            if (textInputHTMLElement?.hasAttribute('contenteditable')) {
                insertAtCaret(textInputHTMLElement, text);
            } else {
                insertByCommand(text);
            }

            // Pointer will go out of sight when a large paragraph is pasted on the web. Refocusing the input keeps the cursor in view.
            // To avoid the keyboard toggle issue in mWeb if using blur() and focus() functions, we just need to dispatch the event to trigger the onFocus handler
            // We need to trigger the bubbled "focusin" event to make sure the onFocus handler is triggered
            textInputHTMLElement.dispatchEvent(
                new FocusEvent('focusin', {
                    bubbles: true,
                }),
            );
            // eslint-disable-next-line no-empty
        } catch (e) {}
        // We only need to set the callback once.
        // eslint-disable-next-line react-compiler/react-compiler, react-hooks/exhaustive-deps
    }, []);

    /**
     * Manually place the pasted HTML into Composer, keeping only genuinely bold text as markdown bold
     *
     * @param {String} html - pasted HTML
     */
    const handlePastedHTML = useCallback(
        (html: string) => {
            const markdownText = convertPastedHtmlToMarkdown(html);
            const textInputHTMLElement = textInputRef.current as HTMLElement;
            if (textInputHTMLElement) {
                insertIntoTextInput(textInputHTMLElement, markdownText);
            }
        },
        [textInputRef],
    );

    /**
     * Paste the plaintext content into Composer.
     *
     * @param {ClipboardEvent} event
     */
    const handlePastePlainText = useCallback(
        (event: ClipboardEvent) => {
            const plainText = event.clipboardData?.getData('text/plain');
            if (plainText) {
                paste(plainText);
            }
        },
        [paste],
    );

    const handlePaste = useCallback(
        (event: ClipboardEvent) => {
            if (!textInputRef.current) {
                return;
            }

            if (preHtmlPasteCallback?.(event)) {
                return;
            }

            const isFocused = textInputRef.current?.isFocused();

            if (!isFocused) {
                return;
            }

            event.preventDefault();

            const TEXT_HTML = 'text/html';

            // If paste contains HTML
            if (event.clipboardData?.types?.includes(TEXT_HTML)) {
                const pastedHTML = event.clipboardData.getData(TEXT_HTML);

                const domparser = new DOMParser();
                const embeddedImages = domparser.parseFromString(pastedHTML, TEXT_HTML).images;

                // Exclude parsing img tags in the HTML, as fetching the image via fetch triggers a connect-src Content-Security-Policy error.
                if (embeddedImages.length > 0 && embeddedImages[0].src) {
                    // If HTML has emoji, then treat this as plain text.
                    if (embeddedImages[0].dataset && embeddedImages[0].dataset.stringifyType === 'emoji') {
                        handlePastePlainText(event);
                        return;
                    }
                }
                handlePastedHTML(pastedHTML);
                return;
            }
            handlePastePlainText(event);
        },
        // eslint-disable-next-line react-compiler/react-compiler, react-hooks/exhaustive-deps
        [handlePastedHTML, handlePastePlainText, preHtmlPasteCallback],
    );

    useEffect(() => {
        // we need to re-register listener on navigation focus/blur if the component (like Composer) is not unmounting
        // when navigating away to different screen (report) to avoid paste event on other screen being wrongly handled
        // by current screen paste listener
        let unsubscribeFocus: () => void;
        let unsubscribeBlur: () => void;
        if (removeListenerOnScreenBlur) {
            unsubscribeFocus = navigation.addListener('focus', () => document.addEventListener('paste', handlePaste, true));
            unsubscribeBlur = navigation.addListener('blur', () => document.removeEventListener('paste', handlePaste, true));
        }

        document.addEventListener('paste', handlePaste, true);

        return () => {
            if (removeListenerOnScreenBlur) {
                unsubscribeFocus();
                unsubscribeBlur();
            }
            document.removeEventListener('paste', handlePaste, true);
        };
        // eslint-disable-next-line react-compiler/react-compiler, react-hooks/exhaustive-deps
    }, []);
};

export default useHtmlPaste;
      };
        // eslint-disable-next-line react-compiler/react-compiler, react-hooks/exhaustive-deps
    }, []);
};

export default useHtmlPaste;
