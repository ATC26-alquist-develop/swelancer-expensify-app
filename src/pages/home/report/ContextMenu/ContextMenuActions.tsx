import {Str} from 'expensify-common';
import type {MutableRefObject} from 'react';
import React from 'react';
import {InteractionManager} from 'react-native';
// eslint-disable-next-line no-restricted-imports
import type {GestureResponderEvent, Text, View} from 'react-native';
import type {OnyxEntry} from 'react-native-onyx';
import type {Emoji} from '@assets/emojis/types';
import * as Expensicons from '@components/Icon/Expensicons';
import MiniQuickEmojiReactions from '@components/Reactions/MiniQuickEmojiReactions';
import QuickEmojiReactions from '@components/Reactions/QuickEmojiReactions';
import addEncryptedAuthTokenToURL from '@libs/addEncryptedAuthTokenToURL';
import * as Browser from '@libs/Browser';
import Clipboard from '@libs/Clipboard';
import EmailUtils from '@libs/EmailUtils';
import * as Environment from '@libs/Environment/Environment';
import fileDownload from '@libs/fileDownload';
import getAttachmentDetails from '@libs/fileDownload/getAttachmentDetails';
import * as Localize from '@libs/Localize';
import ModifiedExpenseMessage from '@libs/ModifiedExpenseMessage';
import Navigation from '@libs/Navigation/Navigation';
import Parser from '@libs/Parser';
import ReportActionComposeFocusManager from '@libs/ReportActionComposeFocusManager';
import * as ReportActionsUtils from '@libs/ReportActionsUtils';
import * as ReportConnection from '@libs/ReportConnection';
import * as ReportUtils from '@libs/ReportUtils';
import * as TaskUtils from '@libs/TaskUtils';
import * as Download from '@userActions/Download';
import * as Report from '@userActions/Report';
import CONST from '@src/CONST';
import type {TranslationPaths} from '@src/languages/types';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type {Beta, Download as DownloadOnyx, OnyxInputOrEntry, ReportAction, ReportActionReactions, Transaction, User} from '@src/types/onyx';
import type IconAsset from '@src/types/utils/IconAsset';
import type {ContextMenuAnchor} from './ReportActionContextMenu';
import {hideContextMenu, showDeleteModal} from './ReportActionContextMenu';

/** Gets the HTML version of the message in an action */
function getActionHtml(reportAction: OnyxInputOrEntry<ReportAction>): string {
    const message = Array.isArray(reportAction?.message) ? reportAction?.message?.at(-1) ?? null : reportAction?.message ?? null;
    return message?.html ?? '';
}

/** Sets the HTML string to Clipboard */
function setClipboardMessage(content: string) {
    if (!Clipboard.canSetHtml()) {
        Clipboard.setString(Parser.htmlToMarkdown(content));
    } else {
        const anchorRegex = CONST.REGEX_LINK_IN_ANCHOR;
        const isAnchorTag = anchorRegex.test(content);
        const plainText = isAnchorTag ? Parser.htmlToMarkdown(content) : Parser.htmlToText(content);
        Clipboard.setHtml(content, plainText);
    }
}

type ShouldShow = (args: {
    type: string;
    reportAction: OnyxEntry<ReportAction>;
    isArchivedRoom: boolean;
    betas: OnyxEntry<Beta[]>;
    menuTarget: MutableRefObject<ContextMenuAnchor> | undefined;
    isChronosReport: boolean;
    reportID: string;
    isPinnedChat: boolean;
    isUnreadChat: boolean;
    isOffline: boolean;
    isMini: boolean;
    isProduction: boolean;
    moneyRequestAction: ReportAction | undefined;
    areHoldRequirementsMet: boolean;
    user: OnyxEntry<User>;
}) => boolean;

type ContextMenuActionPayload = {
    reportAction: ReportAction;
    transaction?: OnyxEntry<Transaction>;
    reportID: string;
    draftMessage: string;
    selection: string;
    close: () => void;
    openContextMenu: () => void;
    interceptAnonymousUser: (callback: () => void, isAnonymousAction?: boolean) => void;
    anchor?: MutableRefObject<HTMLDivElement | View | Text | null>;
    checkIfContextMenuActive?: () => void;
    openOverflowMenu: (event: GestureResponderEvent | MouseEvent, anchorRef: MutableRefObject<View | null>) => void;
    event?: GestureResponderEvent | MouseEvent | KeyboardEvent;
    setIsEmojiPickerActive?: (state: boolean) => void;
    anchorRef?: MutableRefObject<View | null>;
    moneyRequestAction: ReportAction | undefined;
    hasCard?: boolean;
};

type OnPress = (closePopover: boolean, payload: ContextMenuActionPayload, selection?: string, reportID?: string, draftMessage?: string) => void;

type RenderContent = (closePopover: boolean, payload: ContextMenuActionPayload) => React.ReactElement;

type GetDescription = (selection?: string) => string | void;

type ContextMenuActionWithContent = {
    renderContent: RenderContent;
};

type ContextMenuActionWithIcon = {
    textTranslateKey: TranslationPaths;
    icon: IconAsset;
    successTextTranslateKey?: TranslationPaths;
    successIcon?: IconAsset;
    onPress: OnPress;
    getDescription: GetDescription;
};

type ContextMenuAction = (ContextMenuActionWithContent | ContextMenuActionWithIcon) & {
    isAnonymousAction: boolean;
    shouldShow: ShouldShow;
    shouldPreventDefaultFocusOnPress?: boolean;
    shouldDisable?: (download: OnyxEntry<DownloadOnyx>) => boolean;
};

// A list of all the context actions in this menu.
const ContextMenuActions: ContextMenuAction[] = [
    {
        isAnonymousAction: false,
        shouldShow: ({type, reportAction}) =>
            type === CONST.CONTEXT_MENU_TYPES.REPORT_ACTION && !!reportAction && 'message' in reportAction && !ReportActionsUtils.isMessageDeleted(reportAction),
        renderContent: (closePopover, {reportID, reportAction, close: closeManually, openContextMenu, setIsEmojiPickerActive}) => {
            const isMini = !closePopover;

            const closeContextMenu = (onHideCallback?: () => void) => {
                if (isMini) {
                    closeManually();
                    if (onHideCallback) {
                        onHideCallback();
                    }
                } else {
                    hideContextMenu(false, onHideCallback);
                }
            };

            const toggleEmojiAndCloseMenu = (emoji: Emoji, existingReactions: OnyxEntry<ReportActionReactions>) => {
                Report.toggleEmojiReaction(reportID, reportAction, emoji, existingReactions);
                closeContextMenu();
                setIsEmojiPickerActive?.(false);
            };

            if (isMini) {
                return (
                    <MiniQuickEmojiReactions
                        key="MiniQuickEmojiReactions"
                        onEmojiSelected={toggleEmojiAndCloseMenu}
                        onPressOpenPicker={() => {
                            openContextMenu();
                            setIsEmojiPickerActive?.(true);
                        }}
                        onEmojiPickerClosed={() => {
                            closeContextMenu();
                            setIsEmojiPickerActive?.(false);
                        }}
                        reportActionID={reportAction?.reportActionID}
                        reportAction={reportAction}
                    />
                );
            }

            return (
                <QuickEmojiReactions
                    key="BaseQuickEmojiReactions"
                    closeContextMenu={closeContextMenu}
                    onEmojiSelected={toggleEmojiAndCloseMenu}
                    reportActionID={reportAction?.reportActionID}
                    reportAction={reportAction}
                    setIsEmojiPickerActive={setIsEmojiPickerActive}
                />
            );
        },
    },
    {
        isAnonymousAction: false,
        textTranslateKey: 'reportActionContextMenu.replyInThread',
        icon: Expensicons.ChatBubbleReply,
        shouldShow: ({type, reportAction, reportID}) => {
            if (type !== CONST.CONTEXT_MENU_TYPES.REPORT_ACTION) {
                return false;
            }
            return !ReportUtils.shouldDisableThread(reportAction, reportID);
        },
        onPress: (closePopover, {reportAction, reportID}) => {
            const originalReportID = ReportUtils.getOriginalReportID(reportID, reportAction);
            if (closePopover) {
                hideContextMenu(false, () => {
                    InteractionManager.runAfterInteractions(() => {
                        // Normally the focus callback of the main composer doesn't focus when willBlurTextInputOnTapOutside
                        // is false, so we need to pass true here to override this condition.
                        ReportActionComposeFocusManager.focus(true);
                    });
                    Report.navigateToAndOpenChildReport(reportAction?.childReportID ?? '-1', reportAction, originalReportID);
                });
                return;
            }
            Report.navigateToAndOpenChildReport(reportAction?.childReportID ?? '-1', reportAction, originalReportID);
        },
        getDescription: () => {},
    },
    {
        isAnonymousAction: false,
        textTranslateKey: 'reportActionContextMenu.markAsUnread',
        icon: Expensicons.ChatBubbleUnread,
        shouldShow: ({type, isUnreadChat}) => type === CONST.CONTEXT_MENU_TYPES.REPORT_ACTION && !isUnreadChat,
        onPress: (closePopover, {reportAction, reportID}) => {
            // Intentionally not refocusing the composer
            Report.markAsUnread(reportID);
        },
        getDescription: () => undefined,
        shouldPreventDefaultFocusOnPress: true, // Add this line to prevent refocusing
    },
    {
        isAnonymousAction: false,
        textTranslateKey: 'reportActionContextMenu.markAsRead',
        icon: Expensicons.Mail,
        successIcon: Expensicons.Checkmark,
        shouldShow: ({type, isUnreadChat}) => type === CONST.CONTEXT_MENU_TYPES.REPORT && isUnreadChat,
        onPress: (closePopover, {reportID}) => {
            Report.readNewestAction(reportID, true);
            if (closePopover) {
                hideContextMenu(true, ReportActionComposeFocusManager.focus);
            }
        },
        getDescription: () => {},
    },
    {
        isAnonymousAction: false,
        textTranslateKey: 'reportActionContextMenu.editAction',
        icon: Expensicons.Pencil,
        shouldShow: ({type, reportAction, isArchivedRoom, isChronosReport}) =>
            type === CONST.CONTEXT_MENU_TYPES.REPORT_ACTION && ReportUtils.canEditReportAction(reportAction) && !isArchivedRoom && !isChronosReport,
        onPress: (closePopover, {reportID, reportAction, draftMessage}) => {
            if (ReportActionsUtils.isMoneyRequestAction(reportAction)) {
                hideContextMenu(false);
                const childReportID = reportAction?.childReportID ?? '-1';
                Report.openReport(childReportID);
                Navigation.navigate(ROUTES.REPORT_WITH_ID.getRoute(childReportID));
                return;
            }
            const editAction = () => {
                if (!draftMessage) {
                    Report.saveReportActionDraft(reportID, reportAction, Parser.htmlToMarkdown(getActionHtml(reportAction)));
                } else {
                    Report.deleteReportActionDraft(reportID, reportAction);
                }
            };

            if (closePopover) {
                // Hide popover, then call editAction
                hideContextMenu(false, editAction);
                return;
            }

            // No popover to hide, call editAction immediately
            editAction();
        },
        getDescription: () => {},
    },
    {
        isAnonymousAction: false,
        textTranslateKey: 'iou.unhold',
        icon: Expensicons.Stopwatch,
        shouldShow: ({type, moneyRequestAction, areHoldRequirementsMet}) =>
            type === CONST.CONTEXT_MENU_TYPES.REPORT_ACTION && areHoldRequirementsMet && ReportUtils.canHoldUnholdReportAction(moneyRequestAction).canUnholdRequest,
        onPress: (closePopover, {moneyRequestAction}) => {
            if (closePopover) {
                hideContextMenu(false, () => ReportUtils.changeMoneyRequestHoldStatus(moneyRequestAction));
                return;
            }

            // No popover to hide, call changeMoneyRequestHoldStatus immediately
            ReportUtils.changeMoneyRequestHoldStatus(moneyRequestAction);
        },
        getDescription: () => {},
    },
    {
        isAnonymousAction: false,
        textTranslateKey: 'iou.hold',
        icon: Expensicons.Stopwatch,
        shouldShow: ({type, moneyRequestAction, areHoldRequirementsMet}) =>
            type === CONST.CONTEXT_MENU_TYPES.REPORT_ACTION && areHoldRequirementsMet && ReportUtils.canHoldUnholdReportAction(moneyRequestAction).canHoldRequest,
        onPress: (closePopover, {moneyRequestAction}) => {
            if (closePopover) {
                hideContextMenu(false, () => ReportUtils.changeMoneyRequestHoldStatus(moneyRequestAction));
                return;
            }

            // No popover to hide, call changeMoneyRequestHoldStatus immediately
            ReportUtils.changeMoneyRequestHoldStatus(moneyRequestAction);
        },
        getDescription: () => {},
    },
    {
        isAnonymousAction: false,
        textTranslateKey: 'reportActionContextMenu.joinThread',
        icon: Expensicons.Bell,
        shouldShow: ({reportAction, isArchivedRoom, reportID}) => {
            const childReportNotificationPreference = ReportUtils.getChildReportNotificationPreference(reportAction);
            const isDeletedAction = ReportActionsUtils.isDeletedAction(reportAction);
            const shouldDisplayThreadReplies = ReportUtils.shouldDisplayThreadReplies(reportAction, reportID);
            const subscribed = childReportNotificationPreference !== 'hidden';
            const isThreadFirstChat = ReportUtils.isThreadFirstChat(reportAction, reportID);
            const isWhisperAction = ReportActionsUtils.isWhisperAction(reportAction) || ReportActionsUtils.isActionableTrackExpense(reportAction);
            const isExpenseReportAction = ReportActionsUtils.isMoneyRequestAction(reportAction) || ReportActionsUtils.isReportPreviewAction(reportAction);
            return !subscribed && !isWhisperAction && !isExpenseReportAction && !isThreadFirstChat && (shouldDisplayThreadReplies || (!isDeletedAction && !isArchivedRoom));
        },
        onPress: (closePopover, {reportAction, reportID}) => {
            const childReportNotificationPreference = ReportUtils.getChildReportNotificationPreference(reportAction);
            const originalReportID = ReportUtils.getOriginalReportID(reportID, reportAction);
            if (closePopover) {
                hideContextMenu(false, () => {
                    ReportActionComposeFocusManager.focus();
                    Report.toggleSubscribeToChildReport(reportAction?.childReportID ?? '-1', reportAction, originalReportID, childReportNotificationPreference);
                });
                return;
            }

            ReportActionComposeFocusManager.focus();
            Report.toggleSubscribeToChildReport(reportAction?.childReportID ?? '-1', reportAction, originalReportID, childReportNotificationPreference);
        },
        getDescription: () => {},
    },
    {
        isAnonymousAction: true,
        textTranslateKey: 'reportActionContextMenu.copyLink',
        icon: Expensicons.LinkCopy,
        shouldShow: ({type, reportAction, menuTarget}) => 
            type === CONST.CONTEXT_MENU_TYPES.REPORT_ACTION && !!reportAction && !!menuTarget,
        onPress: (closePopover, {reportAction, reportID}) => {
            // Existing copy link logic
            const reportActionLink = Environment.getReportActionLink(reportAction);
            Clipboard.setString(reportActionLink);
        },
        getDescription: () => undefined,
        shouldPreventDefaultFocusOnPress: true, // Add this line to prevent refocusing
    },
    {
        isAnonymousAction: true,
        textTranslateKey: 'reportActionContextMenu.copyEmailToClipboard',
        icon: Expensicons.Copy,
        successTextTranslateKey: 'reportActionContextMenu.copied',
        successIcon: Expensicons.Checkmark,
        shouldShow: ({type}) => type === CONST.CONTEXT_MENU_TYPES.EMAIL,
        onPress: (closePopover, {selection}) => {
            Clipboard.setString(EmailUtils.trimMailTo(selection));
            hideContextMenu(true, ReportActionComposeFocusManager.focus);
        },
        getDescription: (selection) => EmailUtils.prefixMailSeparatorsWithBreakOpportunities(EmailUtils.trimMailTo(selection ?? '')),
    },
    {
        isAnonymousAction: true,
        textTranslateKey: 'reportActionContextMenu.copyToClipboard',
        icon: Expensicons.Copy,
        shouldShow: ({type, reportAction}) => type === CONST.CONTEXT_MENU_TYPES.REPORT_ACTION && !!reportAction,
        onPress: (closePopover, {reportAction, transaction, selection, reportID, hasCard}) => {
            // Existing copy logic
            const actionHtml = getActionHtml(reportAction);
            const content = selection || actionHtml;
            setClipboardMessage(content);
            return true; // Indicates success
        },
        getDescription: () => undefined,
        shouldPreventDefaultFocusOnPress: true, // Add this line to prevent refocusing
    },

    {
        isAnonymousAction: true,
        textTranslateKey: 'reportActionContextMenu.copyLink',
        icon: Expensicons.LinkCopy,
        successIcon: Expensicons.Checkmark,
        successTextTranslateKey: 'reportActionContextMenu.copied',
        shouldShow: ({type, reportAction, menuTarget}) => {
            const isAttachment = ReportActionsUtils.isReportActionAttachment(reportAction);

            // Only hide the copylink menu item when context menu is opened over img element.
            const isAttachmentTarget = menuTarget?.current && 'tagName' in menuTarget.current && menuTarget?.current.tagName === 'IMG' && isAttachment;
            return type === CONST.CONTEXT_MENU_TYPES.REPORT_ACTION && !isAttachmentTarget && !ReportActionsUtils.isMessageDeleted(reportAction);
        },
        onPress: (closePopover, {reportAction, reportID}) => {
            const originalReportID = ReportUtils.getOriginalReportID(reportID, reportAction);
            Environment.getEnvironmentURL().then((environmentURL) => {
                const reportActionID = reportAction?.reportActionID;
                Clipboard.setString(`${environmentURL}/r/${originalReportID}/${reportActionID}`);
            });
            hideContextMenu(true, ReportActionComposeFocusManager.focus);
        },
        getDescription: () => {},
    },
    {
        isAnonymousAction: false,
        textTranslateKey: 'common.pin',
        icon: Expensicons.Pin,
        shouldShow: ({type, isPinnedChat}) => type === CONST.CONTEXT_MENU_TYPES.REPORT && !isPinnedChat,
        onPress: (closePopover, {reportID}) => {
            Report.togglePinnedState(reportID, false);
            if (closePopover) {
                hideContextMenu(false, ReportActionComposeFocusManager.focus);
            }
        },
        getDescription: () => {},
    },
    {
        isAnonymousAction: false,
        textTranslateKey: 'common.unPin',
        icon: Expensicons.Pin,
        shouldShow: ({type, isPinnedChat}) => type === CONST.CONTEXT_MENU_TYPES.REPORT && isPinnedChat,
        onPress: (closePopover, {reportID}) => {
            Report.togglePinnedState(reportID, true);
            if (closePopover) {
                hideContextMenu(false, ReportActionComposeFocusManager.focus);
            }
        },
        getDescription: () => {},
    },
    {
        isAnonymousAction: false,
        textTranslateKey: 'reportActionContextMenu.flagAsOffensive',
        icon: Expensicons.Flag,
        shouldShow: ({type, reportAction, isArchivedRoom, isChronosReport, reportID}) =>
            type === CONST.CONTEXT_MENU_TYPES.REPORT_ACTION &&
            ReportUtils.canFlagReportAction(reportAction, reportID) &&
            !isArchivedRoom &&
            !isChronosReport &&
            reportAction?.actorAccountID !== CONST.ACCOUNT_ID.CONCIERGE,
        onPress: (closePopover, {reportID, reportAction}) => {
            const activeRoute = Navigation.getActiveRoute();
            if (closePopover) {
                hideContextMenu(false, () => Navigation.navigate(ROUTES.FLAG_COMMENT.getRoute(reportID, reportAction?.reportActionID, activeRoute)));
                return;
            }

            Navigation.navigate(ROUTES.FLAG_COMMENT.getRoute(reportID, reportAction?.reportActionID, activeRoute));
        },
        getDescription: () => {},
    },
    {
        isAnonymousAction: true,
        textTranslateKey: 'common.download',
        icon: Expensicons.Download,
        successTextTranslateKey: 'common.download',
        successIcon: Expensicons.Download,
        shouldShow: ({reportAction, isOffline}) => {
            const isAttachment = ReportActionsUtils.isReportActionAttachment(reportAction);
            const html = getActionHtml(reportAction);
            const isUploading = html.includes(CONST.ATTACHMENT_OPTIMISTIC_SOURCE_ATTRIBUTE);
            return isAttachment && !isUploading && !!reportAction?.reportActionID && !ReportActionsUtils.isMessageDeleted(reportAction) && !isOffline;
        },
        onPress: (closePopover, {reportAction}) => {
            const html = getActionHtml(reportAction);
            const {originalFileName, sourceURL} = getAttachmentDetails(html);
            const sourceURLWithAuth = addEncryptedAuthTokenToURL(sourceURL ?? '');
            const sourceID = (sourceURL?.match(CONST.REGEX.ATTACHMENT_ID) ?? [])[1];
            Download.setDownload(sourceID, true);
            const anchorRegex = CONST.REGEX_LINK_IN_ANCHOR;
            const isAnchorTag = anchorRegex.test(html);
            fileDownload(sourceURLWithAuth, originalFileName ?? '', '', isAnchorTag && Browser.isMobileSafari()).then(() => Download.setDownload(sourceID, false));
            if (closePopover) {
                hideContextMenu(true, ReportActionComposeFocusManager.focus);
            }
        },
        getDescription: () => {},
        shouldDisable: (download) => download?.isDownloading ?? false,
    },
    {
        isAnonymousAction: true,
        textTranslateKey: 'reportActionContextMenu.copyOnyxData',
        icon: Expensicons.Copy,
        successTextTranslateKey: 'reportActionContextMenu.copied',
        successIcon: Expensicons.Checkmark,
        shouldShow: ({type, isProduction}) => type === CONST.CONTEXT_MENU_TYPES.REPORT && !isProduction,
        onPress: (closePopover, {reportID}) => {
            const report = ReportConnection.getAllReports()?.[`${ONYXKEYS.COLLECTION.REPORT}${reportID}`];
            Clipboard.setString(JSON.stringify(report, null, 4));
            hideContextMenu(true, ReportActionComposeFocusManager.focus);
        },
        getDescription: () => {},
    },
    {
        isAnonymousAction: true,
        textTranslateKey: 'debug.debug',
        icon: Expensicons.Bug,
        shouldShow: ({type, user}) => type === CONST.CONTEXT_MENU_TYPES.REPORT && !!user?.isDebugModeEnabled,
        onPress: (closePopover, {reportID}) => {
            Navigation.navigate(ROUTES.DEBUG_REPORT.getRoute(reportID));
            hideContextMenu(false, ReportActionComposeFocusManager.focus);
        },
        getDescription: () => {},
    },
    {
        isAnonymousAction: false,
        textTranslateKey: 'reportActionContextMenu.deleteAction',
        icon: Expensicons.Trashcan,
        shouldShow: ({type, reportAction, isArchivedRoom, isChronosReport, reportID}) =>
            // Until deleting parent threads is supported in FE, we will prevent the user from deleting a thread parent
            type === CONST.CONTEXT_MENU_TYPES.REPORT_ACTION &&
            ReportUtils.canDeleteReportAction(reportAction, reportID) &&
            !isArchivedRoom &&
            !isChronosReport &&
            !ReportActionsUtils.isMessageDeleted(reportAction),
        onPress: (closePopover, {reportID, reportAction}) => {
            if (closePopover) {
                // Hide popover, then call showDeleteConfirmModal
                hideContextMenu(false, () => showDeleteModal(reportID, reportAction));
                return;
            }

            // No popover to hide, call showDeleteConfirmModal immediately
            showDeleteModal(reportID, reportAction);
        },
        getDescription: () => {},
    },
    {
        isAnonymousAction: true,
        textTranslateKey: 'reportActionContextMenu.menu',
        icon: Expensicons.ThreeDots,
        shouldShow: ({isMini}) => isMini,
        onPress: (closePopover, {openOverflowMenu, event, openContextMenu, anchorRef}) => {
            openOverflowMenu(event as GestureResponderEvent | MouseEvent, anchorRef ?? {current: null});
            openContextMenu();
        },
        getDescription: () => {},
        shouldPreventDefaultFocusOnPress: false,
    },
];

const restrictedReadOnlyActions: TranslationPaths[] = [
    'reportActionContextMenu.replyInThread',
    'reportActionContextMenu.editAction',
    'reportActionContextMenu.joinThread',
    'reportActionContextMenu.deleteAction',
];

const RestrictedReadOnlyContextMenuActions: ContextMenuAction[] = ContextMenuActions.filter(
    (action) => 'textTranslateKey' in action && restrictedReadOnlyActions.includes(action.textTranslateKey),
);

export {RestrictedReadOnlyContextMenuActions};
export default ContextMenuActions;
export type {ContextMenuActionPayload, ContextMenuAction};
